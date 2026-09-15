import type { GamePhase, GameState } from './gameTypes';

export const STORAGE_KEY = 'class-feud.game-state.v1';

const PERSIST_VERSION = 1;

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

function isValidTeam(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    typeof value.score === 'number'
  );
}

function isValidAnswer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === 'string') &&
    typeof value.points === 'number' &&
    typeof value.revealed === 'boolean'
  );
}

function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (!VALID_PHASES.includes(value.phase as GamePhase)) return false;
  if (!Array.isArray(value.teams) || !value.teams.every(isValidTeam)) return false;
  if (typeof value.strikes !== 'number') return false;
  if (typeof value.roundPot !== 'number') return false;
  if (value.activeTeamId !== null && typeof value.activeTeamId !== 'string') return false;
  if (value.stealTeamId !== null && typeof value.stealTeamId !== 'string') return false;

  const round = value.currentRound;
  if (!isRecord(round)) return false;
  if (
    typeof round.id !== 'string' ||
    typeof round.prompt !== 'string' ||
    typeof round.category !== 'string' ||
    typeof round.multiplier !== 'number' ||
    !Array.isArray(round.answers) ||
    !round.answers.every(isValidAnswer)
  ) {
    return false;
  }
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

export function clearPersistedState(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
