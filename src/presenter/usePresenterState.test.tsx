// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, GameState } from '../game/gameTypes';
import { STORAGE_KEY } from '../game/gamePersistence';
import { usePresenterState } from './usePresenterState';
import type { PresenterSnapshot } from './presenterSync';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;
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

const ROUND: FeudAnswer[] = [
  { id: 'a1', text: 'Pizza', aliases: [], points: 32, revealed: false },
  { id: 'a2', text: 'Tacos', aliases: [], points: 24, revealed: false },
];

function playingState(overrides: Partial<GameState> = {}): GameState {
  let s = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ id: 'r1', title: 'R1', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    rounds: [{ id: 'r1', title: 'R1', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
  });
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  return { ...s, ...overrides };
}

function seedLocalStorage(state: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, state }));
}

function snapshot(state: GameState, seq: number, extra: Partial<PresenterSnapshot> = {}): PresenterSnapshot {
  return { seq, state, answerTimer: null, wrongAnswer: null, ...extra };
}

let latest: ReturnType<typeof usePresenterState> | null = null;

function Harness({ onState }: { onState: (s: ReturnType<typeof usePresenterState>) => void }) {
  onState(usePresenterState());
  return null;
}

function mount(): Root {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness onState={(s) => { latest = s; }} />));
  return root;
}

function channel(): FakeBroadcastChannel {
  return FakeBroadcastChannel.instances[0];
}

describe('usePresenterState', () => {
  beforeEach(() => {
    latest = null;
    FakeBroadcastChannel.instances = [];
    localStorage.clear();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('initializes from the persisted snapshot (mid-round / late open)', () => {
    const state = playingState({ strikes: 1, roundPot: 32 });
    seedLocalStorage(state);

    const root = mount();

    expect(latest?.state.phase).toBe('playing');
    expect(latest?.state.strikes).toBe(1);
    expect(latest?.state.roundPot).toBe(32);
    root.unmount();
  });

  it('follows live snapshots (answer reveal, score, strikes, timer)', () => {
    const root = mount();
    const revealed = playingState({ roundPot: 32, rounds: playingState().rounds.map((r) => ({ ...r, answers: r.answers.map((a) => (a.id === 'a1' ? { ...a, revealed: true } : a)) })) });

    act(() => {
      channel().onmessage?.({ data: snapshot(revealed, 1, { answerTimer: { status: 'running', teamId: 'team-red', durationSeconds: 5, remainingSeconds: 4 } }) });
    });

    expect(latest?.state.roundPot).toBe(32);
    expect(latest?.state.rounds[0].answers[0].revealed).toBe(true);
    expect(latest?.answerTimer?.remainingSeconds).toBe(4);
    root.unmount();
  });

  it('drops stale snapshots (out-of-order seq)', () => {
    const root = mount();
    const newer = playingState({ strikes: 2 });

    act(() => {
      channel().onmessage?.({ data: snapshot(newer, 5) });
    });
    expect(latest?.state.strikes).toBe(2);

    act(() => {
      channel().onmessage?.({ data: snapshot(playingState({ strikes: 0 }), 3) });
    });
    // Stale seq (3 < 5) must be ignored.
    expect(latest?.state.strikes).toBe(2);
    root.unmount();
  });

  it('never writes to localStorage (display-only)', () => {
    const state = playingState();
    seedLocalStorage(state);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const root = mount();
    act(() => {
      channel().onmessage?.({ data: snapshot(playingState({ strikes: 3 }), 1) });
    });

    expect(setItemSpy).not.toHaveBeenCalled();
    root.unmount();
  });
});
