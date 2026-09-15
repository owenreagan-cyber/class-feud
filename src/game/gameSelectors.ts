import type { FeudRound, GameState, Team, TeamId } from './gameTypes';

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

/** Teams eligible to attempt a steal (everyone except the controlling team). */
export function getEligibleStealTeams(state: GameState): Team[] {
  return state.teams.filter((team) => team.id !== state.activeTeamId);
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
