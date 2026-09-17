import type { FeudRound, GameState, Team, TeamId } from './gameTypes';
import type {
  BrainBlitzConfig,
  BrainBlitzQuestion,
  BrainBlitzResponse,
} from './brainBlitzTypes';

export function getCurrentRound(state: GameState): FeudRound {
  return state.rounds[state.currentRoundIndex] ?? state.rounds[0];
}

export function getNextRound(state: GameState): FeudRound | null {
  return state.rounds[state.currentRoundIndex + 1] ?? null;
}

export function hasNextRound(state: GameState): boolean {
  return state.currentRoundIndex + 1 < state.rounds.length;
}

export function getTeamById(state: GameState, teamId: TeamId | null): Team | undefined {
  if (teamId === null) return undefined;
  return state.teams.find((team) => team.id === teamId);
}

export function getActiveTeam(state: GameState): Team | null {
  return getTeamById(state, state.activeTeamId) ?? null;
}

export function getStealTeam(state: GameState): Team | null {
  return getTeamById(state, state.stealTeamId) ?? null;
}

/** The team that received the most recently resolved round award. */
export function getRoundWinner(state: GameState): Team | null {
  return getTeamById(state, state.roundWinnerId) ?? null;
}

/** Teams eligible to attempt a steal (everyone except the controlling team and no-answer teams). */
export function getEligibleStealTeams(state: GameState): Team[] {
  return state.teams.filter(
    (team) => team.id !== state.activeTeamId && !state.noAnswerTeamIds.includes(team.id),
  );
}

/** Authored rounds in the library that are not currently in the play queue (spares for + EXTRA BOARD). */
export function getSpareRounds(state: GameState): FeudRound[] {
  const selected = new Set(state.rounds.map((round) => round.id));
  return state.roundLibrary.filter((round) => !selected.has(round.id));
}

export function getRevealedCount(state: GameState): number {
  return getCurrentRound(state).answers.filter((answer) => answer.revealed).length;
}

export function getAllRevealed(state: GameState): boolean {
  const answers = getCurrentRound(state).answers;
  return answers.length > 0 && answers.every((answer) => answer.revealed);
}

/** Permanent points a team receives for the current round pot (single source of truth). */
export function getRoundValue(state: GameState): number {
  return state.roundPot * getCurrentRound(state).multiplier;
}

/**
 * Teams tied for the highest permanent score. Empty when no tie exists
 * (including the single-team case). Deterministic: preserves team order.
 */
export function getTiedTeams(state: GameState): Team[] {
  const teams = state.teams;
  if (teams.length < 2) return [];
  const maxScore = Math.max(...teams.map((team) => team.score));
  const tied = teams.filter((team) => team.score === maxScore);
  return tied.length > 1 ? tied : [];
}

/** The single highest-scoring team, or null when tied or no teams exist. */
export function getWinner(state: GameState): Team | null {
  if (getTiedTeams(state).length > 0) return null;
  if (state.teams.length === 0) return null;
  return state.teams.reduce((best, team) => (team.score > best.score ? team : best));
}

// ---------------------------------------------------------------- Brain Blitz --

export function getBrainBlitzConfig(state: GameState): BrainBlitzConfig | null {
  return state.brainBlitzConfig;
}

/** The ordered Brain Blitz questions, or an empty list when unavailable. */
export function getBrainBlitzQuestions(state: GameState): BrainBlitzQuestion[] {
  return state.brainBlitzConfig?.questions ?? [];
}

/** The current Brain Blitz question, or null when not in a live round. */
export function getBrainBlitzCurrentQuestion(state: GameState): BrainBlitzQuestion | null {
  const blitz = state.brainBlitz;
  if (!blitz) return null;
  return state.brainBlitzConfig?.questions[blitz.currentQuestionIndex] ?? null;
}

/** Responses for the current player (player 1 or 2). */
export function getBrainBlitzPlayerResponses(state: GameState): BrainBlitzResponse[] {
  const blitz = state.brainBlitz;
  if (!blitz) return [];
  return blitz.currentPlayer === 1 ? blitz.player1Responses : blitz.player2Responses;
}

/** Combined Brain Blitz score (player 1 + player 2). */
export function getBrainBlitzTotalScore(state: GameState): number {
  const blitz = state.brainBlitz;
  if (!blitz) return 0;
  return blitz.player1Score + blitz.player2Score;
}

/** Whether the Brain Blitz round has reached its target score. */
export function getBrainBlitzAchieved(state: GameState): boolean {
  const blitz = state.brainBlitz;
  if (!blitz) return false;
  return getBrainBlitzTotalScore(state) >= blitz.targetScore;
}

/** The finalist team (the normal-game winner, or the teacher-chosen tie winner). */
export function getBrainBlitzFinalistTeam(state: GameState): Team | null {
  const blitz = state.brainBlitz;
  if (!blitz || blitz.finalistTeamId === null) return null;
  return getTeamById(state, blitz.finalistTeamId) ?? null;
}

/**
 * Whether Player 1 already accepted the given answer for the given question.
 * Player 2 cannot score a canonical answer Player 1 already used (duplicate rule).
 */
export function isBrainBlitzAnswerUsedByPlayer1(
  state: GameState,
  questionId: string,
  answerId: string,
): boolean {
  const blitz = state.brainBlitz;
  if (!blitz) return false;
  return blitz.player1Responses.some(
    (response) =>
      response.questionId === questionId &&
      response.status === 'accepted' &&
      response.answerId === answerId,
  );
}
