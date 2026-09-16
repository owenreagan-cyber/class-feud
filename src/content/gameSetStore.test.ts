import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_SETS_STORAGE_KEY,
  GAME_SETS_VERSION,
  deleteGameSet,
  getGameSet,
  isValidSavedGameSet,
  loadGameSets,
  saveGameSet,
} from './gameSetStore';
import { BUILT_IN_GAME_SETS } from './builtInGameSets';
import { duplicateGameSet } from './gameSet';
import type { SavedGameSet } from './gameSet';

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeSet(overrides: Partial<SavedGameSet> = {}): SavedGameSet {
  return {
    id: 'game-1',
    title: 'Fractions Review',
    description: '',
    source: 'custom',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    rounds: [
      {
        id: 'r1',
        title: 'Fractions',
        category: 'Math',
        prompt: 'Name a fraction.',
        multiplier: 1,
        answers: [
          { id: 'a1', text: 'One half', points: 40, aliases: ['half'] },
          { id: 'a2', text: 'One quarter', points: 30, aliases: ['quarter'] },
        ],
      },
    ],
    ...overrides,
  };
}

describe('game set store', () => {
  it('saves and loads a game set', () => {
    vi.stubGlobal('localStorage', makeStorage());
    saveGameSet(makeSet());
    const loaded = loadGameSets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('game-1');
    expect(getGameSet('game-1')?.title).toBe('Fractions Review');
  });

  it('returns empty when nothing is stored', () => {
    vi.stubGlobal('localStorage', makeStorage());
    expect(loadGameSets()).toEqual([]);
    expect(getGameSet('nope')).toBeNull();
  });

  it('updates an existing game set in place', () => {
    vi.stubGlobal('localStorage', makeStorage());
    saveGameSet(makeSet());
    saveGameSet(makeSet({ title: 'Fractions (updated)' }));
    const loaded = loadGameSets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('Fractions (updated)');
  });

  it('preserves createdAt and changes updatedAt on update', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const first = makeSet({ createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    saveGameSet(first);
    saveGameSet({ ...first, updatedAt: '2026-02-02T00:00:00.000Z' });
    const loaded = loadGameSets()[0];
    expect(loaded.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(loaded.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('deletes a custom game', () => {
    vi.stubGlobal('localStorage', makeStorage());
    saveGameSet(makeSet({ id: 'g1' }));
    saveGameSet(makeSet({ id: 'g2', title: 'Second' }));
    deleteGameSet('g1');
    const loaded = loadGameSets();
    expect(loaded.map((set) => set.id)).toEqual(['g2']);
  });

  it('duplicate gets a new game id', () => {
    const source = makeSet();
    const copy = duplicateGameSet(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toContain('Copy');
    expect(copy.source).toBe('custom');
  });

  it('duplicated rounds get new ids', () => {
    const source = makeSet();
    const copy = duplicateGameSet(source);
    expect(copy.rounds[0].id).not.toBe(source.rounds[0].id);
  });

  it('duplicated answers get new ids', () => {
    const source = makeSet();
    const copy = duplicateGameSet(source);
    expect(copy.rounds[0].answers.map((a) => a.id)).not.toEqual(
      source.rounds[0].answers.map((a) => a.id),
    );
  });

  it('duplication does not share mutable references', () => {
    const source = makeSet();
    const copy = duplicateGameSet(source);
    copy.rounds[0].answers[0].text = 'Mutated';
    expect(source.rounds[0].answers[0].text).toBe('One half');
  });

  it('malformed stored content is rejected safely', () => {
    vi.stubGlobal('localStorage', makeStorage());
    localStorage.setItem(GAME_SETS_STORAGE_KEY, '{not json');
    expect(loadGameSets()).toEqual([]);
  });

  it('a structurally invalid record is skipped, valid records preserved', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const good = makeSet({ id: 'good' });
    const bad = { id: 'bad', title: 'Broken' }; // missing fields
    localStorage.setItem(
      GAME_SETS_STORAGE_KEY,
      JSON.stringify({ version: GAME_SETS_VERSION, gameSets: [good, bad] }),
    );
    const loaded = loadGameSets();
    expect(loaded.map((set) => set.id)).toEqual(['good']);
  });

  it('an unsupported storage version is handled intentionally', () => {
    vi.stubGlobal('localStorage', makeStorage());
    localStorage.setItem(
      GAME_SETS_STORAGE_KEY,
      JSON.stringify({ version: 999, gameSets: [makeSet()] }),
    );
    expect(loadGameSets()).toEqual([]);
  });

  it('isValidSavedGameSet accepts a complete set and rejects malformed ones', () => {
    expect(isValidSavedGameSet(makeSet())).toBe(true);
    expect(isValidSavedGameSet(null)).toBe(false);
    expect(isValidSavedGameSet({ id: 'x' })).toBe(false);
    expect(isValidSavedGameSet({ ...makeSet(), source: 'weird' })).toBe(false);
  });

  it('built-in game is not mutated by duplication', () => {
    const builtin = BUILT_IN_GAME_SETS[0];
    const snapshot = JSON.stringify(builtin);
    const copy = duplicateGameSet(builtin);
    expect(copy.id).not.toBe(builtin.id);
    expect(copy.source).toBe('custom');
    expect(JSON.stringify(builtin)).toBe(snapshot);
  });
});
