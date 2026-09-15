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

/** Teams eligible to attempt a steal (everyone except the controlling team). */
export function getEligibleStealTeams(state: GameState): Team[] {
  return state.teams.filter((team) => team.id !== state.activeTeamId);
}

/** The next team in rotation after the active team (used for possession switching). */
export function getNextTeam(state: GameState): Team | null {
  const teams = state.teams;
  if (teams.length === 0) return null;
  const index = teams.findIndex((team) => team.id === state.activeTeamId);
  if (index === -1) return teams[0];
  return teams[(index + 1) % teams.length];
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

/** The team with the highest permanent score (ties resolve to the first). */
export function getWinner(state: GameState): Team | null {
  if (state.teams.length === 0) return null;
  return state.teams.reduce((best, team) => (team.score > best.score ? team : best));
}
