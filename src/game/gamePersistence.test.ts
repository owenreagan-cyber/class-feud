import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
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

type MutableAnswer = {
  points: unknown;
  revealed: unknown;
  aliases: unknown;
};

type MutableState = {
  rounds: Array<{ answers: MutableAnswer[]; multiplier: unknown }>;
  currentRoundIndex: unknown;
  strikes: unknown;
};

/** Serialize an initial state, corrupted by the given mutation, as a version-2 envelope. */
function corrupt(mutate: (state: MutableState) => void): string {
  const state = createInitialState() as unknown as MutableState;
  mutate(state);
  return JSON.stringify({ version: 2, state });
}

function storedRaw(storage: Storage, raw: string): void {
  storage.setItem(STORAGE_KEY, raw);
  vi.stubGlobal('localStorage', storage);
}

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
    storedRaw(makeStorage(), '{not json');
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for an unknown version', () => {
    storedRaw(makeStorage(), JSON.stringify({ version: 999, state: {} }));
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for the legacy version-1 schema', () => {
    storedRaw(
      makeStorage(),
      JSON.stringify({ version: 1, state: createInitialState() }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for a structurally invalid state', () => {
    storedRaw(
      makeStorage(),
      JSON.stringify({ version: 2, state: { phase: 'nonsense' } }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a negative answer point value', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].answers[0].points = -10;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a non-boolean revealed flag', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].answers[0].revealed = 'yes';
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects null aliases', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].answers[0].aliases = null;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a non-positive round multiplier', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].multiplier = 0;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects an out-of-range current round index', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.currentRoundIndex = 99;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects strikes above the maximum', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.strikes = 5;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('reset overwrites a persisted active game with the initial state', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let state = createInitialState();
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    savePersistedState(state);
    expect(loadPersistedState()?.phase).toBe('playing');

    const reset = gameReducer(state, { type: 'RESET_GAME' });
    savePersistedState(reset);
    expect(loadPersistedState()?.phase).toBe('setup');
    expect(loadPersistedState()).toEqual(createInitialState());
  });
});
