import { getCurrentRound, getEligibleStealTeams, getRoundValue, getWinner } from './gameSelectors';
import { DEFAULT_ROUND_IDS, ROUND_LIBRARY } from './roundLibrary';
import { DEFAULT_TEAMS } from './sampleData';
import { MAX_STRIKES, MAX_TEAMS, MIN_TEAMS, TEAM_COLORS } from './gameTypes';
import type { FeudRound, GameAction, GameState, Team, TeamId } from './gameTypes';
import { cloneBrainBlitzConfig, isBrainBlitzEnabled } from './brainBlitzTypes';
import type {
  BrainBlitzConfig,
  BrainBlitzPlayer,
  BrainBlitzPlayerMode,
  BrainBlitzResponse,
  BrainBlitzState,
} from './brainBlitzTypes';

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
    noAnswerTeamIds: [],
    brainBlitzConfig: null,
    brainBlitz: null,
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
    noAnswerTeamIds: [],
    rounds: state.rounds.map((round, index) =>
      index === state.currentRoundIndex ? cloneRound(round) : round,
    ),
  };
}

/**
 * Enter the steal phase. Auto-select the opponent only when there is exactly
 * one eligible team (a two-team match); otherwise the teacher must choose.
 *
 * When NO team is eligible to steal (every opponent was marked NO ANSWER), the
 * controlling team keeps the round rather than entering a dead-end steal phase
 * with no selectable team. This mirrors the "steal failed" outcome.
 */
function enterSteal(state: GameState): GameState {
  const eligible = getEligibleStealTeams(state);
  if (eligible.length === 0) {
    if (state.activeTeamId === null) return state;
    return awardRound(state, state.activeTeamId, getRoundValue(state));
  }
  const stealTeamId = eligible.length === 1 ? eligible[0].id : null;
  return { ...state, phase: 'steal', stealTeamId };
}

function isSetupActionAllowed(state: GameState): boolean {
  return state.phase === 'setup';
}

/** Create the live Brain Blitz runtime state from an enabled config. */
function createBrainBlitzState(
  config: BrainBlitzConfig,
  finalistTeamId: TeamId | null,
  exhibition = false,
): BrainBlitzState {
  return {
    status: 'setup',
    finalistTeamId,
    playerMode: 'two',
    currentPlayer: 1,
    currentQuestionIndex: 0,
    player1Responses: [],
    player2Responses: [],
    player1Score: 0,
    player2Score: 0,
    targetScore: config.targetScore,
    timerSeconds: config.timerSeconds,
    remainingSeconds: config.timerSeconds,
    timerRunning: false,
    timerExpired: false,
    exhibition,
  };
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

    case 'LOAD_GAME_ROUNDS': {
      // Populate the active game from authored content. The incoming rounds are
      // cloned so session edits (exclusion/reorder/multiplier) never mutate the
      // saved source definitions. Starts a fresh `setup` configuration.
      if (action.rounds.length === 0) return state;
      const base = createInitialState();
      return {
        ...base,
        roundLibrary: action.roundLibrary.map(cloneRound),
        rounds: action.rounds.map(cloneRound),
        brainBlitzConfig: action.brainBlitzConfig
          ? cloneBrainBlitzConfig(action.brainBlitzConfig)
          : null,
      };
    }

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
        noAnswerTeamIds: [],
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
      // Reveal is allowed during `playing` and during `steal` so a confirmed
      // steal guess can contribute its answer to the round pot exactly once
      // before the steal is resolved. Awarding still happens only via
      // RESOLVE_STEAL / AWARD_ROUND.
      if (state.phase !== 'playing' && state.phase !== 'steal') return state;
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

    // -------- Face-off no-answer rule --------

    case 'MARK_NO_ANSWER': {
      // Only meaningful before the board resolves (tossup/playing/steal). Marks
      // a team as ineligible to steal this board. No point penalty.
      if (
        state.phase !== 'tossup' &&
        state.phase !== 'playing' &&
        state.phase !== 'steal'
      ) {
        return state;
      }
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      if (state.noAnswerTeamIds.includes(action.teamId)) return state;
      return { ...state, noAnswerTeamIds: [...state.noAnswerTeamIds, action.teamId] };
    }

    case 'CLEAR_NO_ANSWER': {
      if (!state.noAnswerTeamIds.includes(action.teamId)) return state;
      return {
        ...state,
        noAnswerTeamIds: state.noAnswerTeamIds.filter((id) => id !== action.teamId),
      };
    }

    // -------- Extra-time teacher escape hatches (gameOver only) --------

    case 'EXTRA_BOARD': {
      // Launch a spare authored board after the normal game has ended. Reopens
      // gameplay cleanly on the spare round; the winner is recomputed from
      // scores afterward. Never auto-launched.
      if (state.phase !== 'gameOver') return state;
      const definition = state.roundLibrary.find((round) => round.id === action.roundId);
      if (!definition) return state;
      if (state.rounds.some((round) => round.id === action.roundId)) return state;
      const rounds = [...state.rounds, cloneRound(definition)];
      const currentRoundIndex = rounds.length - 1;
      return {
        ...state,
        phase: 'tossup',
        activeTeamId: null,
        stealTeamId: null,
        strikes: 0,
        roundPot: 0,
        roundWinnerId: null,
        noAnswerTeamIds: [],
        rounds,
        currentRoundIndex,
      };
    }

    // -------- Brain Blitz final round (optional) --------

    case 'BRAIN_BLITZ_ENTER': {
      if (state.phase !== 'gameOver') return state;
      const config = state.brainBlitzConfig;
      if (!isBrainBlitzEnabled(config)) return state;
      const winner = getWinner(state);
      const exhibition = action.exhibition ?? false;
      const finalistId = action.teamId ?? (winner ? winner.id : null);
      return {
        ...state,
        phase: 'brainBlitz',
        brainBlitz: createBrainBlitzState(config, finalistId, exhibition),
      };
    }

    case 'BRAIN_BLITZ_SET_FINALIST': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz || blitz.status !== 'setup') return state;
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      return { ...state, brainBlitz: { ...blitz, finalistTeamId: action.teamId } };
    }

    case 'BRAIN_BLITZ_SET_PLAYER_MODE': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz || blitz.status !== 'setup') return state;
      const playerMode: BrainBlitzPlayerMode = action.playerMode;
      return {
        ...state,
        brainBlitz: {
          ...blitz,
          playerMode,
          status: 'player1Ready',
          currentPlayer: 1,
          currentQuestionIndex: 0,
          player1Responses: [],
          player2Responses: [],
          player1Score: 0,
          player2Score: 0,
          remainingSeconds: blitz.timerSeconds,
          timerRunning: false,
          timerExpired: false,
        },
      };
    }

    case 'BRAIN_BLITZ_BEGIN_PLAYER': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz) return state;
      if (blitz.status === 'player1Ready' || blitz.status === 'player2Ready') {
        return {
          ...state,
          brainBlitz: {
            ...blitz,
            status: blitz.status === 'player1Ready' ? 'player1Active' : 'player2Active',
            timerRunning: true,
            timerExpired: false,
            remainingSeconds: blitz.timerSeconds,
          },
        };
      }
      return state;
    }

    case 'BRAIN_BLITZ_NEXT_PLAYER': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz || blitz.status !== 'player1Complete') return state;
      if (blitz.playerMode !== 'two') return state;
      return {
        ...state,
        brainBlitz: {
          ...blitz,
          status: 'player2Ready',
          currentPlayer: 2,
          currentQuestionIndex: 0,
          remainingSeconds: blitz.timerSeconds,
          timerRunning: false,
          timerExpired: false,
        },
      };
    }

    case 'BRAIN_BLITZ_PAUSE': {
      const blitz = state.brainBlitz;
      if (!blitz || !blitz.timerRunning) return state;
      return { ...state, brainBlitz: { ...blitz, timerRunning: false } };
    }

    case 'BRAIN_BLITZ_RESUME': {
      const blitz = state.brainBlitz;
      if (!blitz || blitz.timerRunning) return state;
      const isActive = blitz.status === 'player1Active' || blitz.status === 'player2Active';
      if (!isActive || blitz.remainingSeconds <= 0) return state;
      return { ...state, brainBlitz: { ...blitz, timerRunning: true, timerExpired: false } };
    }

    case 'BRAIN_BLITZ_TICK': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz || !blitz.timerRunning) return state;
      if (blitz.remainingSeconds <= 0) return state;
      const remainingSeconds = blitz.remainingSeconds - 1;
      const expired = remainingSeconds <= 0;
      return {
        ...state,
        brainBlitz: {
          ...blitz,
          remainingSeconds,
          timerRunning: !expired,
          timerExpired: expired,
        },
      };
    }

    case 'BRAIN_BLITZ_RESOLVE': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz) return state;
      if (blitz.status !== 'player1Active' && blitz.status !== 'player2Active') return state;
      const config = state.brainBlitzConfig;
      if (!config) return state;
      const question = config.questions[blitz.currentQuestionIndex];
      if (!question) return state;

      const player: BrainBlitzPlayer = blitz.currentPlayer;
      const resolution = action.resolution;

      let status: BrainBlitzResponse['status'];
      let answerId: string | null = null;
      let points = 0;

      if (resolution === 'accepted') {
        const resolvedId = action.answerId ?? null;
        const answer = resolvedId ? question.answers.find((a) => a.id === resolvedId) : undefined;
        if (!answer) return state; // accepted without a valid answer id is a no-op
        const isDuplicate =
          player === 2 &&
          blitz.player1Responses.some(
            (r) => r.questionId === question.id && r.status === 'accepted' && r.answerId === resolvedId,
          );
        status = isDuplicate ? 'duplicate' : 'accepted';
        answerId = resolvedId;
        points = isDuplicate ? 0 : answer.points;
      } else {
        status = resolution;
      }

      const response: BrainBlitzResponse = {
        questionId: question.id,
        rawResponse: action.rawResponse,
        answerId,
        points,
        status,
      };

      const player1Responses = player === 1 ? [...blitz.player1Responses, response] : blitz.player1Responses;
      const player2Responses = player === 2 ? [...blitz.player2Responses, response] : blitz.player2Responses;
      const player1Score = player === 1 ? blitz.player1Score + points : blitz.player1Score;
      const player2Score = player === 2 ? blitz.player2Score + points : blitz.player2Score;

      const finished = blitz.currentQuestionIndex + 1 >= config.questions.length;
      const nextStatus =
        finished
          ? player === 1 && blitz.playerMode === 'two'
            ? 'player1Complete'
            : 'complete'
          : blitz.status;

      return {
        ...state,
        brainBlitz: {
          ...blitz,
          status: nextStatus,
          currentQuestionIndex: finished ? blitz.currentQuestionIndex : blitz.currentQuestionIndex + 1,
          player1Responses,
          player2Responses,
          player1Score,
          player2Score,
          timerRunning: finished ? false : blitz.timerRunning,
        },
      };
    }

    case 'BRAIN_BLITZ_END_PLAYER': {
      const blitz = state.brainBlitz;
      if (state.phase !== 'brainBlitz' || !blitz) return state;
      if (blitz.status !== 'player1Active' && blitz.status !== 'player2Active') return state;
      const nextStatus =
        blitz.currentPlayer === 1 && blitz.playerMode === 'two' ? 'player1Complete' : 'complete';
      return { ...state, brainBlitz: { ...blitz, status: nextStatus, timerRunning: false } };
    }

    case 'BRAIN_BLITZ_EXIT': {
      if (state.phase !== 'brainBlitz') return state;
      return { ...state, phase: 'gameOver', brainBlitz: null };
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
  if (action.type === 'BRAIN_BLITZ_TICK') {
    // The timer countdown is transient: applying it must not pollute the undo
    // stack (otherwise every second becomes an "Undo" step). This is the single
    // documented boundary between normal-game history and Brain Blitz history.
    const next = gameReducer(history.present, action);
    return next === history.present ? history : { past: history.past, present: next };
  }
  const next = gameReducer(history.present, action);
  if (next === history.present) return history;
  return { past: [...history.past, history.present], present: next };
}
