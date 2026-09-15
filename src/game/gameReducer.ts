import { getCurrentRound, getEligibleStealTeams, getRoundValue } from './gameSelectors';
import { DEFAULT_ROUND_IDS, ROUND_LIBRARY } from './roundLibrary';
import { DEFAULT_TEAMS } from './sampleData';
import { MAX_STRIKES, MAX_TEAMS, MIN_TEAMS, TEAM_COLORS } from './gameTypes';
import type { FeudRound, GameAction, GameState, Team, TeamId } from './gameTypes';

/** Deep-clone a round and reset every answer to unrevealed. */
export function cloneRound(round: FeudRound): FeudRound {
  return {
    ...round,
    answers: round.answers.map((answer) => ({ ...answer, revealed: false })),
  };
}

/** Deterministically pick the next unused `team-N` id. */
function nextTeamId(teams: Team[]): TeamId {
  let n = 1;
  while (teams.some((team) => team.id === `team-${n}`)) n += 1;
  return `team-${n}`;
}

function buildSelectedRounds(roundIds: string[], library: FeudRound[]): FeudRound[] {
  const byId = new Map(library.map((round) => [round.id, round]));
  return roundIds.flatMap((id) => {
    const definition = byId.get(id);
    return definition ? [cloneRound(definition)] : [];
  });
}

export function createInitialState(): GameState {
  return {
    phase: 'setup',
    teams: DEFAULT_TEAMS.map((team) => ({ ...team, score: 0 })),
    activeTeamId: null,
    stealTeamId: null,
    strikes: 0,
    roundPot: 0,
    roundWinnerId: null,
    roundLibrary: ROUND_LIBRARY.map(cloneRound),
    rounds: buildSelectedRounds(DEFAULT_ROUND_IDS, ROUND_LIBRARY),
    currentRoundIndex: 0,
  };
}

/** Award the round pot value to a team and end the round. */
function awardRound(state: GameState, teamId: TeamId | null, value: number): GameState {
  const teams = state.teams.map((team) =>
    team.id === teamId ? { ...team, score: team.score + value } : team,
  );
  return {
    ...state,
    teams,
    phase: 'roundOver',
    stealTeamId: null,
    roundWinnerId: teamId,
  };
}

/** Reset per-round state for a fresh toss-up on the current round index. */
function resetRound(state: GameState): GameState {
  return {
    ...state,
    phase: 'tossup',
    activeTeamId: null,
    stealTeamId: null,
    strikes: 0,
    roundPot: 0,
    roundWinnerId: null,
    rounds: state.rounds.map((round, index) =>
      index === state.currentRoundIndex ? cloneRound(round) : round,
    ),
  };
}

/**
 * Enter the steal phase. Auto-select the opponent only when there is exactly
 * one eligible team (a two-team match); otherwise the teacher must choose.
 */
function enterSteal(state: GameState): GameState {
  const eligible = getEligibleStealTeams(state);
  const stealTeamId = eligible.length === 1 ? eligible[0].id : null;
  return { ...state, phase: 'steal', stealTeamId };
}

function isSetupActionAllowed(state: GameState): boolean {
  return state.phase === 'setup';
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UNDO':
      // Handled by the history wrapper; a no-op at this level.
      return state;

    case 'RESET_GAME':
      return createInitialState();

    // -------- Team structure (setup only) --------

    case 'UPDATE_TEAMS':
      if (!isSetupActionAllowed(state)) return state;
      return { ...state, teams: action.teams };

    case 'ADD_TEAM': {
      if (!isSetupActionAllowed(state)) return state;
      if (state.teams.length >= MAX_TEAMS) return state;
      const id = nextTeamId(state.teams);
      const color = TEAM_COLORS[state.teams.length % TEAM_COLORS.length].value;
      const team: Team = {
        id,
        name: `Team ${state.teams.length + 1}`,
        color,
        score: 0,
      };
      return { ...state, teams: [...state.teams, team] };
    }

    case 'REMOVE_TEAM': {
      if (!isSetupActionAllowed(state)) return state;
      if (state.teams.length <= MIN_TEAMS) return state;
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      return { ...state, teams: state.teams.filter((team) => team.id !== action.teamId) };
    }

    case 'RENAME_TEAM': {
      if (!isSetupActionAllowed(state)) return state;
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.teamId ? { ...team, name: action.name } : team,
        ),
      };
    }

    case 'SET_TEAM_COLOR': {
      if (!isSetupActionAllowed(state)) return state;
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.teamId ? { ...team, color: action.color } : team,
        ),
      };
    }

    case 'REORDER_TEAMS': {
      if (!isSetupActionAllowed(state)) return state;
      const current = state.teams.map((team) => team.id);
      const ids = action.teamIds;
      const sameSet =
        ids.length === current.length && ids.every((id) => current.includes(id));
      if (!sameSet) return state;
      const byId = new Map(state.teams.map((team) => [team.id, team]));
      const teams = ids.flatMap((id) => {
        const team = byId.get(id);
        return team ? [team] : [];
      });
      return { ...state, teams };
    }

    // -------- Round selection (setup only) --------

    case 'TOGGLE_ROUND': {
      if (!isSetupActionAllowed(state)) return state;
      const exists = state.rounds.some((round) => round.id === action.roundId);
      if (exists) {
        if (state.rounds.length <= 1) return state; // keep at least one round
        return {
          ...state,
          rounds: state.rounds.filter((round) => round.id !== action.roundId),
        };
      }
      const definition = state.roundLibrary.find((round) => round.id === action.roundId);
      if (!definition) return state;
      return { ...state, rounds: [...state.rounds, cloneRound(definition)] };
    }

    case 'REORDER_ROUNDS': {
      if (!isSetupActionAllowed(state)) return state;
      const current = state.rounds.map((round) => round.id);
      const ids = action.roundIds;
      const sameSet =
        ids.length === current.length && ids.every((id) => current.includes(id));
      if (!sameSet) return state;
      const byId = new Map(state.rounds.map((round) => [round.id, round]));
      const rounds = ids.flatMap((id) => {
        const round = byId.get(id);
        return round ? [round] : [];
      });
      return { ...state, rounds };
    }

    case 'SET_ROUND_MULTIPLIER': {
      if (!isSetupActionAllowed(state)) return state;
      return {
        ...state,
        rounds: state.rounds.map((round) =>
          round.id === action.roundId
            ? { ...round, multiplier: action.multiplier }
            : round,
        ),
      };
    }

    // -------- Lifecycle --------

    case 'START_GAME': {
      if (state.phase !== 'setup' && state.phase !== 'gameOver') return state;
      if (state.teams.length < MIN_TEAMS || state.rounds.length === 0) return state;
      return {
        ...state,
        phase: 'tossup',
        activeTeamId: null,
        stealTeamId: null,
        strikes: 0,
        roundPot: 0,
        roundWinnerId: null,
        currentRoundIndex: 0,
        teams: state.teams.map((team) => ({ ...team, score: 0 })),
        rounds: state.rounds.map(cloneRound),
      };
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'roundOver') return state;
      if (state.currentRoundIndex + 1 >= state.rounds.length) {
        return { ...state, phase: 'gameOver', stealTeamId: null };
      }
      return resetRound({ ...state, currentRoundIndex: state.currentRoundIndex + 1 });
    }

    case 'END_GAME': {
      if (
        state.phase !== 'playing' &&
        state.phase !== 'steal' &&
        state.phase !== 'roundOver'
      ) {
        return state;
      }
      return { ...state, phase: 'gameOver', stealTeamId: null };
    }

    // -------- Gameplay --------

    case 'SET_ACTIVE_TEAM': {
      if (state.phase !== 'tossup' && state.phase !== 'playing') return state;
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      return {
        ...state,
        activeTeamId: action.teamId,
        phase: state.phase === 'tossup' ? 'playing' : state.phase,
      };
    }

    case 'REVEAL_ANSWER': {
      if (state.phase !== 'playing') return state;
      const round = getCurrentRound(state);
      const answer = round.answers.find((a) => a.id === action.answerId);
      if (!answer || answer.revealed) return state;
      const answers = round.answers.map((a) =>
        a.id === action.answerId ? { ...a, revealed: true } : a,
      );
      return {
        ...state,
        roundPot: state.roundPot + answer.points,
        rounds: state.rounds.map((r, index) =>
          index === state.currentRoundIndex ? { ...r, answers } : r,
        ),
      };
    }

    case 'ADD_STRIKE': {
      if (state.phase !== 'playing' || state.strikes >= MAX_STRIKES) return state;
      const strikes = state.strikes + 1;
      if (strikes >= MAX_STRIKES) {
        return enterSteal({ ...state, strikes });
      }
      return { ...state, strikes };
    }

    case 'REMOVE_STRIKE': {
      if (state.phase !== 'playing' && state.phase !== 'steal') return state;
      if (state.strikes <= 0) return state;
      const strikes = state.strikes - 1;
      const leavingSteal = state.phase === 'steal';
      return {
        ...state,
        strikes,
        phase: leavingSteal ? 'playing' : state.phase,
        stealTeamId: leavingSteal ? null : state.stealTeamId,
      };
    }

    case 'START_STEAL': {
      if (state.phase !== 'playing') return state;
      return enterSteal(state);
    }

    case 'SET_STEAL_TEAM': {
      if (state.phase !== 'steal') return state;
      if (action.teamId === state.activeTeamId) return state;
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      return { ...state, stealTeamId: action.teamId };
    }

    case 'RESOLVE_STEAL': {
      if (state.phase !== 'steal') return state;
      if (state.stealTeamId === null || state.activeTeamId === null) return state;
      const winnerId = action.success ? state.stealTeamId : state.activeTeamId;
      return awardRound(state, winnerId, getRoundValue(state));
    }

    case 'AWARD_ROUND': {
      if (state.phase !== 'playing') return state;
      const teamId = action.teamId ?? state.activeTeamId;
      return awardRound(state, teamId, getRoundValue(state));
    }

    default:
      return state;
  }
}

export type HistoryState = {
  past: GameState[];
  present: GameState;
};

export function createHistory(initial: GameState): HistoryState {
  return { past: [], present: initial };
}

export function historyReducer(history: HistoryState, action: GameAction): HistoryState {
  if (action.type === 'UNDO') {
    if (history.past.length === 0) return history;
    const present = history.past[history.past.length - 1];
    const past = history.past.slice(0, -1);
    return { past, present };
  }
  const next = gameReducer(history.present, action);
  if (next === history.present) return history;
  return { past: [...history.past, history.present], present: next };
}
