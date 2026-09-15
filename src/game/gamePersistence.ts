import { MAX_STRIKES } from './gameTypes';
import type { FeudAnswer, FeudRound, GamePhase, GameState } from './gameTypes';

export const STORAGE_KEY = 'class-feud.game-state';

const PERSIST_VERSION = 2;

const VALID_PHASES: GamePhase[] = [
  'setup',
  'tossup',
  'playing',
  'steal',
  'roundOver',
  'gameOver',
];

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
    typeof value.prompt === 'string' &&
    typeof value.category === 'string' &&
    typeof value.multiplier === 'number' &&
    Number.isFinite(value.multiplier) &&
    value.multiplier > 0 &&
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
  if (!Array.isArray(teams) || teams.length === 0 || !teams.every(isValidTeam)) return false;

  const strikes = value.strikes;
  if (!isNonNegativeInteger(strikes) || strikes > MAX_STRIKES) return false;

  const roundPot = value.roundPot;
  if (!isNonNegativeNumber(roundPot)) return false;

  const activeTeamId = value.activeTeamId;
  if (activeTeamId !== null && typeof activeTeamId !== 'string') return false;

  const stealTeamId = value.stealTeamId;
  if (stealTeamId !== null && typeof stealTeamId !== 'string') return false;

  const rounds = value.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0 || !rounds.every(isValidRound)) return false;

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
