import { getCurrentRound, getEligibleStealTeams, getRoundValue } from './gameSelectors';
import { DEFAULT_TEAMS, SAMPLE_ROUNDS } from './sampleData';
import { MAX_STRIKES } from './gameTypes';
import type { FeudRound, GameAction, GameState, TeamId } from './gameTypes';

/** Deep-clone a round and reset every answer to unrevealed. */
export function cloneRound(round: FeudRound): FeudRound {
  return {
    ...round,
    answers: round.answers.map((answer) => ({ ...answer, revealed: false })),
  };
}

export function createInitialState(): GameState {
  return {
    phase: 'setup',
    teams: DEFAULT_TEAMS.map((team) => ({ ...team, score: 0 })),
    activeTeamId: null,
    stealTeamId: null,
    strikes: 0,
    roundPot: 0,
    rounds: SAMPLE_ROUNDS.map(cloneRound),
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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UNDO':
      // Handled by the history wrapper; a no-op at this level.
      return state;

    case 'RESET_GAME':
      return createInitialState();

    case 'UPDATE_TEAMS':
      // Team structure is locked once the game has started.
      if (state.phase !== 'setup') return state;
      return { ...state, teams: action.teams };

    case 'START_GAME':
      if (state.phase !== 'setup' && state.phase !== 'gameOver') return state;
      return resetRound({
        ...state,
        currentRoundIndex: 0,
        teams: state.teams.map((team) => ({ ...team, score: 0 })),
      });

    case 'NEXT_ROUND': {
      if (state.phase !== 'roundOver') return state;
      if (state.currentRoundIndex + 1 >= state.rounds.length) {
        return { ...state, phase: 'gameOver', stealTeamId: null };
      }
      return resetRound({ ...state, currentRoundIndex: state.currentRoundIndex + 1 });
    }

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
