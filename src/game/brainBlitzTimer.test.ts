import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import type { FeudAnswer, GameState } from './gameTypes';
import type { BrainBlitzConfig } from './brainBlitzTypes';

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

function playToGameOver(): GameState {
  let s = loadBlitzGame();
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  return s;
}

function startPlayer1(mode: 'one' | 'two' = 'two'): GameState {
  let s = playToGameOver();
  s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: mode });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  return s;
}

describe('Brain Blitz timer', () => {
  it('start sets the timer running at the configured duration', () => {
    const s = startPlayer1();
    expect(s.brainBlitz?.timerRunning).toBe(true);
    expect(s.brainBlitz?.remainingSeconds).toBe(30);
  });

  it('start decrements on tick', () => {
    const started = startPlayer1();
    const s = gameReducer(started, { type: 'BRAIN_BLITZ_TICK' });
    expect(s.brainBlitz?.remainingSeconds).toBe(29);
    expect(s.brainBlitz?.timerRunning).toBe(true);
  });

  it('pause stops decrement', () => {
    let s = startPlayer1();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_PAUSE' });
    expect(s.brainBlitz?.timerRunning).toBe(false);
    const afterTick = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(afterTick).toBe(s); // tick is a no-op while paused
    expect(afterTick.brainBlitz?.remainingSeconds).toBe(30);
  });

  it('resume continues decrement', () => {
    let s = startPlayer1();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_PAUSE' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESUME' });
    expect(s.brainBlitz?.timerRunning).toBe(true);
    expect(s.brainBlitz?.timerExpired).toBe(false);
    const ticked = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(ticked.brainBlitz?.remainingSeconds).toBe(29);
  });

  it('timer never goes negative', () => {
    let s = startPlayer1();
    for (let i = 0; i < 40; i += 1) {
      s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    }
    expect(s.brainBlitz?.remainingSeconds).toBe(0);
    // Further ticks stay clamped at zero.
    const after = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(after.brainBlitz?.remainingSeconds).toBe(0);
  });

  it('zero expires exactly once', () => {
    let s = startPlayer1();
    // Drive down to 1 second remaining.
    for (let i = 0; i < 29; i += 1) {
      s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    }
    expect(s.brainBlitz?.remainingSeconds).toBe(1);
    const expired = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(expired.brainBlitz?.remainingSeconds).toBe(0);
    expect(expired.brainBlitz?.timerExpired).toBe(true);
    expect(expired.brainBlitz?.timerRunning).toBe(false);
    // Expiry happened once: no further transition is possible.
    const again = gameReducer(expired, { type: 'BRAIN_BLITZ_TICK' });
    expect(again).toBe(expired);
  });

  it('player completion clears the timer', () => {
    const s = gameReducer(startPlayer1('two'), { type: 'BRAIN_BLITZ_END_PLAYER' });
    expect(s.brainBlitz?.status).toBe('player1Complete');
    expect(s.brainBlitz?.timerRunning).toBe(false);
  });

  it('Brain Blitz completion clears the timer', () => {
    let s = startPlayer1('one');
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'x', resolution: 'skipped' });
    expect(s.brainBlitz?.status).toBe('complete');
    expect(s.brainBlitz?.timerRunning).toBe(false);
  });

  it('tick while not running is a no-op', () => {
    let s = playToGameOver();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    // setup status, not running yet
    expect(s.brainBlitz?.timerRunning).toBe(false);
    expect(gameReducer(s, { type: 'BRAIN_BLITZ_TICK' })).toBe(s);
  });
});
