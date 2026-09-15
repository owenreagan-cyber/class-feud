import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { getCurrentRound } from './gameSelectors';
import { loadPersistedState, PERSIST_VERSION, savePersistedState, STORAGE_KEY } from './gamePersistence';

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
  points: number;
  revealed: unknown;
  aliases: unknown;
};

type MutableRound = {
  id: string;
  title: unknown;
  multiplier: number;
  answers: MutableAnswer[];
};

type MutableState = {
  teams: Array<{ id: string; name: string; color: string; score: number }>;
  rounds: MutableRound[];
  roundLibrary: MutableRound[];
  currentRoundIndex: number;
  strikes: number;
  roundPot: number;
  activeTeamId: unknown;
  stealTeamId: unknown;
  roundWinnerId: unknown;
};

/** Serialize an initial state, corrupted by the given mutation, as a current-version envelope. */
function corrupt(mutate: (state: MutableState) => void): string {
  const state = createInitialState() as unknown as MutableState;
  mutate(state);
  return JSON.stringify({ version: PERSIST_VERSION, state });
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
    storedRaw(makeStorage(), JSON.stringify({ version: 1, state: createInitialState() }));
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for the legacy version-2 schema', () => {
    storedRaw(makeStorage(), JSON.stringify({ version: 2, state: createInitialState() }));
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null for a structurally invalid state', () => {
    storedRaw(makeStorage(), JSON.stringify({ version: PERSIST_VERSION, state: { phase: 'nonsense' } }));
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

  it('rejects an invalid (non 1/2/3) multiplier', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].multiplier = 4;
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a missing round title', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].title = null;
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

  it('rejects an invalid active-team reference', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.activeTeamId = 'nope';
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects an invalid steal-team reference', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.stealTeamId = 'nope';
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects an invalid round-winner reference', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.roundWinnerId = 'nope';
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a malformed round reference (id not in library)', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.rounds[0].id = 'not-in-library';
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a missing round library', () => {
    storedRaw(
      makeStorage(),
      corrupt((state) => {
        state.roundLibrary = [];
      }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it('setup configuration survives a reload', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' }); // 3 teams
    state = gameReducer(state, { type: 'RENAME_TEAM', teamId: 'team-red', name: 'Lions' });
    state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier: 2 });
    const ids = state.rounds.map((round) => round.id);
    const reordered = [ids[2], ids[0], ids[1], ids[3]];
    state = gameReducer(state, { type: 'REORDER_ROUNDS', roundIds: reordered });
    savePersistedState(state);

    const restored = loadPersistedState()!;
    expect(restored.phase).toBe('setup');
    expect(restored.teams.map((team) => team.id)).toEqual(state.teams.map((team) => team.id));
    expect(restored.teams.find((team) => team.id === 'team-red')?.name).toBe('Lions');
    expect(restored.rounds.map((round) => round.id)).toEqual(reordered);
    expect(restored.rounds.find((round) => round.id === 'round-1')?.multiplier).toBe(2);
  });

  it('an active multi-round game survives a reload', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let state = createInitialState();
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    savePersistedState(state);

    const restored = loadPersistedState()!;
    expect(restored.phase).toBe('playing');
    expect(restored.roundPot).toBe(35);
    expect(restored.activeTeamId).toBe('team-red');
    expect(getCurrentRound(restored).answers.find((a) => a.id === 'water')?.revealed).toBe(true);
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
