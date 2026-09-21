// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, GameState } from '../game/gameTypes';
import { usePresenterBroadcast } from './usePresenterBroadcast';
import { PRESENTER_CHANNEL } from './presenterSync';
import type { PresenterSnapshot } from './presenterSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  name: string;
  posted: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  close() {}
}

const ROUND: FeudAnswer[] = [{ id: 'a1', text: 'Pizza', aliases: [], points: 32, revealed: false }];

function state(): GameState {
  let s = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ id: 'r1', title: 'R1', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    rounds: [{ id: 'r1', title: 'R1', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
  });
  s = gameReducer(s, { type: 'START_GAME' });
  return s;
}

const IDLE_ANSWER_TIMER = { status: 'idle' as const, teamId: null, durationSeconds: 5 as const, remainingSeconds: 5 };

function Harness({
  state,
  answerTimer,
  wrongAnswer,
}: {
  state: GameState;
  answerTimer: typeof IDLE_ANSWER_TIMER;
  wrongAnswer: { id: number; strong: boolean } | null;
}) {
  usePresenterBroadcast(state, answerTimer, wrongAnswer);
  return null;
}

describe('usePresenterBroadcast', () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('posts the full snapshot on the presenter channel with a monotonic seq', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Harness state={state()} answerTimer={IDLE_ANSWER_TIMER} wrongAnswer={null} />);
    });

    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.name).toBe(PRESENTER_CHANNEL);
    expect(channel.posted.length).toBeGreaterThanOrEqual(1);
    const last = channel.posted[channel.posted.length - 1] as PresenterSnapshot;
    expect(last.state.phase).toBe('tossup');
    expect(last.answerTimer).toBe(IDLE_ANSWER_TIMER);
    expect(last.wrongAnswer).toBeNull();
    expect(typeof last.seq).toBe('number');
    act(() => root.unmount());
  });

  it('re-posts when state changes (reveal syncs)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const before = gameReducer(state(), { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    const after = gameReducer(before, { type: 'REVEAL_ANSWER', answerId: 'a1' });

    act(() => {
      root.render(<Harness state={before} answerTimer={IDLE_ANSWER_TIMER} wrongAnswer={null} />);
    });
    act(() => {
      root.render(<Harness state={after} answerTimer={IDLE_ANSWER_TIMER} wrongAnswer={null} />);
    });

    const channel = FakeBroadcastChannel.instances[0];
    const last = channel.posted[channel.posted.length - 1] as PresenterSnapshot;
    expect(last.state.rounds[0].answers[0].revealed).toBe(true);
    act(() => root.unmount());
  });

  it('is a no-op when BroadcastChannel is unavailable', () => {
    vi.unstubAllGlobals();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    expect(() => {
      act(() => {
        root.render(<Harness state={state()} answerTimer={IDLE_ANSWER_TIMER} wrongAnswer={null} />);
      });
    }).not.toThrow();
    act(() => root.unmount());
  });
});
