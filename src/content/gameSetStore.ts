import type { AnswerDefinition, RoundDefinition, SavedGameSet } from './gameSet';

/**
 * Local persistence for authored custom game sets. Built-in sets are module
 * constants and are never stored here. Versioned envelope with safe parsing:
 * malformed records are skipped rather than crashing the app.
 */

export const GAME_SETS_STORAGE_KEY = 'class-feud.game-sets';
export const GAME_SETS_VERSION = 1;

type Envelope = {
  version: number;
  gameSets: SavedGameSet[];
};

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidAnswerDefinition(value: unknown): value is AnswerDefinition {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.text) &&
    isNumber(value.points) &&
    Array.isArray(value.aliases) &&
    value.aliases.every(isString)
  );
}

export function isValidRoundDefinition(value: unknown): value is RoundDefinition {
  if (!isRecord(value)) return false;
  if (
    !isString(value.id) ||
    !isString(value.title) ||
    !isString(value.category) ||
    !isString(value.prompt)
  ) {
    return false;
  }
  if (value.multiplier !== 1 && value.multiplier !== 2 && value.multiplier !== 3) {
    return false;
  }
  if (!Array.isArray(value.answers) || !value.answers.every(isValidAnswerDefinition)) {
    return false;
  }
  return true;
}

export function isValidSavedGameSet(value: unknown): value is SavedGameSet {
  if (!isRecord(value)) return false;
  if (
    !isString(value.id) ||
    !isString(value.title) ||
    !isString(value.description) ||
    !isString(value.createdAt) ||
    !isString(value.updatedAt)
  ) {
    return false;
  }
  if (value.source !== 'builtin' && value.source !== 'custom') {
    return false;
  }
  if (!Array.isArray(value.rounds) || !value.rounds.every(isValidRoundDefinition)) {
    return false;
  }
  if (value.brainBlitz !== undefined && !isValidBrainBlitzConfig(value.brainBlitz)) {
    return false;
  }
  return true;
}

function isValidBrainBlitzConfig(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    isNumber(value.timerSeconds) &&
    isNumber(value.targetScore) &&
    Array.isArray(value.questions)
  );
}

export function loadGameSets(): SavedGameSet[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(GAME_SETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== GAME_SETS_VERSION) return [];
    if (!Array.isArray(parsed.gameSets)) return [];
    return parsed.gameSets.filter(isValidSavedGameSet);
  } catch {
    return [];
  }
}

export function persistGameSets(sets: SavedGameSet[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const envelope: Envelope = { version: GAME_SETS_VERSION, gameSets: sets };
    storage.setItem(GAME_SETS_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage may be unavailable or full; persistence is best-effort.
  }
}

export function getGameSet(id: string): SavedGameSet | null {
  return loadGameSets().find((set) => set.id === id) ?? null;
}

export function saveGameSet(set: SavedGameSet): void {
  const sets = loadGameSets();
  const index = sets.findIndex((existing) => existing.id === set.id);
  if (index === -1) {
    sets.push(set);
  } else {
    sets[index] = set;
  }
  persistGameSets(sets);
}

export function deleteGameSet(id: string): void {
  persistGameSets(loadGameSets().filter((set) => set.id !== id));
}
