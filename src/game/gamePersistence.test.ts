import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './gameReducer';
import { loadPersistedState, savePersistedState, STORAGE_KEY } from './gamePersistence';

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

describe('game persistence', () => {
  it('round-trips a game state through persistence', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const state = createInitialState();
    savePersistedState(state);
    expect(loadPersistedState()).toEqual(state);
  });

  it('returns null when nothing is stored', () => {
    vi.stubGlobal('localStorage', makeStorage());
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for malformed stored JSON', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    vi.stubGlobal('localStorage', storage);
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for an unknown version', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 999, state: {} }));
    vi.stubGlobal('localStorage', storage);
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for a structurally invalid state', () => {
    const storage = makeStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, state: { phase: 'nonsense' } }),
    );
    vi.stubGlobal('localStorage', storage);
    expect(loadPersistedState()).toBeNull();
  });
});
