import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { loadPersistedState, savePersistedState, STORAGE_KEY } from './gamePersistence';
import type { FeudAnswer, GameState } from './gameTypes';
import type { BrainBlitzConfig } from './brainBlitzTypes';

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

function makeConfig(): BrainBlitzConfig {
  return {
    enabled: true,
    timerSeconds: 30,
    targetScore: 200,
    questions: [
      {
        id: 'q1',
        prompt: 'Name a punctuation mark.',
        category: 'ELA',
        answers: [
          { id: 'a1', text: 'Period', aliases: ['full stop'], points: 35 },
          { id: 'a2', text: 'Comma', aliases: [], points: 25 },
        ],
      },
      {
        id: 'q2',
        prompt: 'Name a part of speech.',
        category: 'ELA',
        answers: [{ id: 'b1', text: 'Noun', aliases: [], points: 40 }],
      },
    ],
  };
}

const ROUND: FeudAnswer[] = [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }];

function loadBlitzGame(config: BrainBlitzConfig = makeConfig()): GameState {
  return gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    rounds: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    brainBlitzConfig: config,
  });
}

function startPlayer1(): GameState {
  let s = loadBlitzGame();
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  return s;
}

describe('Brain Blitz persistence', () => {
  it('active Brain Blitz saves', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const s = startPlayer1();
    savePersistedState(s);
    const restored = loadPersistedState();
    expect(restored?.phase).toBe('brainBlitz');
    expect(restored?.brainBlitz).not.toBeNull();
  });

  it('active Brain Blitz restores', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const s = startPlayer1();
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.status).toBe('player1Active');
    expect(restored.brainBlitz?.currentPlayer).toBe(1);
    expect(restored.brainBlitz?.currentQuestionIndex).toBe(0);
    expect(restored.brainBlitz?.finalistTeamId).toBe('team-red');
  });

  it('remaining seconds restore', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let s = startPlayer1();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' }); // 30 -> 29
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.remainingSeconds).toBe(29);
  });

  it('restore returns paused', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const s = startPlayer1(); // timerRunning === true
    expect(s.brainBlitz?.timerRunning).toBe(true);
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.timerRunning).toBe(false);
  });

  it('reload does not auto-start the timer', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const s = startPlayer1();
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.timerRunning).toBe(false);
    expect(restored.brainBlitz?.timerExpired).toBe(false);
  });

  it('responses restore', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let s = startPlayer1();
    s = gameReducer(s, {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.player1Responses).toHaveLength(1);
    expect(restored.brainBlitz?.player1Responses[0].status).toBe('accepted');
    expect(restored.brainBlitz?.player1Responses[0].answerId).toBe('a1');
  });

  it('scores restore', () => {
    vi.stubGlobal('localStorage', makeStorage());
    let s = startPlayer1();
    s = gameReducer(s, {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitz?.player1Score).toBe(35);
  });

  it('custom Brain Blitz survives runtime reload', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const config = makeConfig();
    config.timerSeconds = 45;
    config.targetScore = 250;
    config.questions[0].category = 'Custom';
    let s = loadBlitzGame(config);
    s = gameReducer(s, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    savePersistedState(s);
    const restored = loadPersistedState()!;
    expect(restored.brainBlitzConfig?.timerSeconds).toBe(45);
    expect(restored.brainBlitzConfig?.targetScore).toBe(250);
    expect(restored.brainBlitzConfig?.questions[0].category).toBe('Custom');
    expect(restored.brainBlitz?.timerSeconds).toBe(45);
    expect(restored.brainBlitz?.targetScore).toBe(250);
  });

  it('malformed Brain Blitz persistence is rejected safely', () => {
    vi.stubGlobal('localStorage', makeStorage());
    const storage = localStorage;
    const s = startPlayer1();
    savePersistedState(s);
    const raw = storage.getItem(STORAGE_KEY)!;
    const parsed = JSON.parse(raw) as { state: { brainBlitz: { status: string } } };
    parsed.state.brainBlitz.status = 'bogus';
    storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    expect(loadPersistedState()).toBeNull();
  });
});
