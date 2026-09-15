import { MAX_STRIKES, MIN_TEAMS } from './gameTypes';
import type { FeudAnswer, FeudRound, GamePhase, GameState, Multiplier } from './gameTypes';

export const STORAGE_KEY = 'class-feud.game-state';
export const PERSIST_VERSION = 3;

const VALID_PHASES: GamePhase[] = [
  'setup',
  'tossup',
  'playing',
  'steal',
  'roundOver',
  'gameOver',
];

const VALID_MULTIPLIERS: Multiplier[] = [1, 2, 3];

type PersistedEnvelope = {
  version: number;
  state: GameState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isValidMultiplier(value: unknown): value is Multiplier {
  return typeof value === 'number' && VALID_MULTIPLIERS.includes(value as Multiplier);
}

function isValidTeam(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    isNonNegativeNumber(value.score)
  );
}

function isValidAnswer(value: unknown): value is FeudAnswer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === 'string') &&
    isNonNegativeNumber(value.points) &&
    typeof value.revealed === 'boolean'
  );
}

function isValidRound(value: unknown): value is FeudRound {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    typeof value.prompt === 'string' &&
    isValidMultiplier(value.multiplier) &&
    Array.isArray(value.answers) &&
    value.answers.length > 0 &&
    value.answers.every(isValidAnswer)
  );
}

function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const phase = value.phase;
  if (!VALID_PHASES.includes(phase as GamePhase)) return false;

  const teams = value.teams;
  if (!Array.isArray(teams) || teams.length < MIN_TEAMS || !teams.every(isValidTeam)) {
    return false;
  }
  const teamIds = new Set((teams as Array<{ id: string }>).map((team) => team.id));

  const strikes = value.strikes;
  if (!isNonNegativeInteger(strikes) || strikes > MAX_STRIKES) return false;

  const roundPot = value.roundPot;
  if (!isNonNegativeNumber(roundPot)) return false;

  const activeTeamId = value.activeTeamId;
  if (activeTeamId !== null && typeof activeTeamId !== 'string') return false;
  if (typeof activeTeamId === 'string' && !teamIds.has(activeTeamId)) return false;

  const stealTeamId = value.stealTeamId;
  if (stealTeamId !== null && typeof stealTeamId !== 'string') return false;
  if (typeof stealTeamId === 'string' && !teamIds.has(stealTeamId)) return false;

  const roundWinnerId = value.roundWinnerId;
  if (roundWinnerId !== null && typeof roundWinnerId !== 'string') return false;
  if (typeof roundWinnerId === 'string' && !teamIds.has(roundWinnerId)) return false;

  const roundLibrary = value.roundLibrary;
  if (
    !Array.isArray(roundLibrary) ||
    roundLibrary.length === 0 ||
    !roundLibrary.every(isValidRound)
  ) {
    return false;
  }
  const libraryIds = new Set(
    (roundLibrary as Array<{ id: string }>).map((round) => round.id),
  );

  const rounds = value.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0 || !rounds.every(isValidRound)) {
    return false;
  }
  const roundIds = (rounds as Array<{ id: string }>).map((round) => round.id);
  if (!roundIds.every((id) => libraryIds.has(id))) return false;

  const currentRoundIndex = value.currentRoundIndex;
  if (!isNonNegativeInteger(currentRoundIndex)) return false;
  if (currentRoundIndex >= rounds.length) return false;

  return true;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function savePersistedState(state: GameState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const envelope: PersistedEnvelope = { version: PERSIST_VERSION, state };
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage may be unavailable or full; persistence is best-effort.
  }
}

export function loadPersistedState(): GameState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== PERSIST_VERSION) return null;
    if (!isValidGameState(parsed.state)) return null;
    return parsed.state;
  } catch {
    return null;
  }
}
