import type { GameState, Team, TeamId } from './gameTypes';

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

/** The team that would receive a steal attempt next (rotates after the active team). */
export function getNextTeam(state: GameState): Team | null {
  const teams = state.teams;
  if (teams.length === 0) return null;
  const index = teams.findIndex((team) => team.id === state.activeTeamId);
  if (index === -1) return teams[0];
  return teams[(index + 1) % teams.length];
}

export function getNextTeamId(state: GameState): TeamId | null {
  return getNextTeam(state)?.id ?? null;
}

export function getRevealedCount(state: GameState): number {
  return state.currentRound.answers.filter((answer) => answer.revealed).length;
}

export function getAllRevealed(state: GameState): boolean {
  return (
    state.currentRound.answers.length > 0 &&
    state.currentRound.answers.every((answer) => answer.revealed)
  );
}

/** Permanent points a team would receive for the current round pot (single source of truth). */
export function getRoundValue(state: GameState): number {
  return state.roundPot * state.currentRound.multiplier;
}
