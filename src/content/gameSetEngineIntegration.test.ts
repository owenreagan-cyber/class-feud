import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchAnswer } from '../game/answerMatcher';
import { createInitialState, gameReducer } from '../game/gameReducer';
import { getCurrentRound, getRoundValue } from '../game/gameSelectors';
import { loadPersistedState, savePersistedState } from '../game/gamePersistence';
import { toFeudRounds } from './gameSet';
import type { SavedGameSet } from './gameSet';

function makeSet(): SavedGameSet {
  return {
    id: 'custom-game-1',
    title: 'Sample Review',
    description: '',
    source: 'custom',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    rounds: [
      {
        id: 'custom-r1',
        title: 'Fractions',
        category: 'Math',
        prompt: 'Name a fraction.',
        multiplier: 1,
        answers: [
          { id: 'a1', text: 'One half', points: 40, aliases: ['half', '1/2'] },
          { id: 'a2', text: 'One quarter', points: 30, aliases: ['quarter', '1/4'] },
          { id: 'a3', text: 'Three quarters', points: 20, aliases: ['3/4'] },
        ],
      },
      {
        id: 'custom-r2',
        title: 'Geometry',
        category: 'Math',
        prompt: 'Name a shape.',
        multiplier: 2,
        answers: [
          { id: 'b1', text: 'Triangle', points: 50, aliases: ['triangles'] },
          { id: 'b2', text: 'Square', points: 40, aliases: ['squares'] },
        ],
      },
    ],
  };
}

function startCustomGame(set: SavedGameSet) {
  const rounds = toFeudRounds(set.rounds);
  let state = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: rounds,
    rounds,
  });
  state = gameReducer(state, { type: 'START_GAME' });
  return state;
}

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

describe('custom game engine integration', () => {
  it('custom game starts through the normal engine', () => {
    const state = startCustomGame(makeSet());
    expect(state.phase).toBe('tossup');
    expect(getCurrentRound(state).id).toBe('custom-r1');
  });

  it('custom round answer can be revealed', () => {
    let state = startCustomGame(makeSet());
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'a1' });
    expect(state.roundPot).toBe(40);
  });

  it('custom aliases work through answerMatcher', () => {
    const state = startCustomGame(makeSet());
    const result = matchAnswer('half', getCurrentRound(state).answers);
    expect(result.quality).toBe('alias');
    expect(result.answerId).toBe('a1');
  });

  it('fuzzy match works with custom answers', () => {
    const state = startCustomGame(makeSet());
    const result = matchAnswer('one quater', getCurrentRound(state).answers);
    expect(result.quality).toBe('fuzzy');
    expect(result.answerId).toBe('a2');
  });

  it('custom multiplier applies once', () => {
    let state = startCustomGame(makeSet());
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'a1' }); // pot 40
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(40);

    // Round 2 has a 2x multiplier.
    state = gameReducer(state, { type: 'NEXT_ROUND' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'b1' }); // pot 50
    expect(getRoundValue(state)).toBe(100);
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(140);
  });

  it('next round advances the custom round queue', () => {
    let state = startCustomGame(makeSet());
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    state = gameReducer(state, { type: 'NEXT_ROUND' });
    expect(getCurrentRound(state).id).toBe('custom-r2');
    expect(getCurrentRound(state).multiplier).toBe(2);
  });

  it('custom game survives active-game reload', () => {
    vi.stubGlobal('localStorage', makeStorage());

    let state = startCustomGame(makeSet());
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'a1' });
    savePersistedState(state);

    const restored = loadPersistedState()!;
    expect(restored.phase).toBe('playing');
    expect(getCurrentRound(restored).id).toBe('custom-r1');
    expect(getCurrentRound(restored).answers.find((a) => a.id === 'a1')?.revealed).toBe(true);
  });

  it('saved source remains unchanged by runtime reveals', () => {
    const set = makeSet();
    const snapshot = JSON.stringify(set);
    let state = startCustomGame(set);
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'a1' });
    expect(state.roundPot).toBe(40);
    expect(JSON.stringify(set)).toBe(snapshot);
  });

  it('session round exclusion does not mutate saved source', () => {
    const set = makeSet();
    const snapshot = JSON.stringify(set);
    const rounds = toFeudRounds(set.rounds);
    let state = gameReducer(createInitialState(), {
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary: rounds,
      rounds,
    });
    state = gameReducer(state, { type: 'TOGGLE_ROUND', roundId: 'custom-r2' });
    expect(state.rounds.some((r) => r.id === 'custom-r2')).toBe(false);
    expect(JSON.stringify(set)).toBe(snapshot);
    expect(set.rounds).toHaveLength(2);
  });

  it('session reorder does not mutate saved source', () => {
    const set = makeSet();
    const snapshot = JSON.stringify(set);
    const rounds = toFeudRounds(set.rounds);
    let state = gameReducer(createInitialState(), {
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary: rounds,
      rounds,
    });
    state = gameReducer(state, { type: 'REORDER_ROUNDS', roundIds: ['custom-r2', 'custom-r1'] });
    expect(state.rounds.map((r) => r.id)).toEqual(['custom-r2', 'custom-r1']);
    expect(JSON.stringify(set)).toBe(snapshot);
    expect(set.rounds.map((r) => r.id)).toEqual(['custom-r1', 'custom-r2']);
  });

  it('deleting the source set does not corrupt an active game', () => {
    const set = makeSet();
    const state = startCustomGame(set);
    const stateSnapshot = JSON.stringify(state);
    // Simulate source deletion by mutating the source object afterward.
    set.title = 'Deleted';
    set.rounds[0].title = 'Gone';
    expect(JSON.stringify(state)).toBe(stateSnapshot);
    expect(getCurrentRound(state).title).toBe('Fractions');
  });
});
