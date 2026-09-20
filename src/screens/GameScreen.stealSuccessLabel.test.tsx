// @vitest-environment jsdom
import { act, useEffect, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameScreen from './GameScreen';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, FeudRound, GameState } from '../game/gameTypes';
import type { TeamButtonHost } from '../teamButton/useTeamButtonHost';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../teamButton/audio', () => ({
  unlockAudio: vi.fn(),
  playWrongAnswerSound: vi.fn(),
  playReadyDing: vi.fn(),
  playFirstPress: vi.fn(),
}));

vi.mock('../teamButton/useTeamButtonHost', () => ({
  useTeamButtonHost: (): TeamButtonHost => ({
    status: 'open',
    connectedTeamIds: [],
    session: null,
    error: null,
    demoted: false,
    stalled: false,
    startSession: () => {},
    resolveSession: () => {},
    resetButtons: () => {},
  }),
}));

const ALPHA: FeudAnswer = { id: 'alpha', text: 'Alpha', aliases: [], points: 40, revealed: false };
const BETA: FeudAnswer = { id: 'beta', text: 'Beta', aliases: [], points: 25, revealed: false };

function makeRound(): FeudRound {
  return {
    id: 'b1',
    title: 'Board 1',
    category: 'Testing',
    prompt: 'Name a thing.',
    // A non-1 multiplier is deliberate: it's what exposed the bug where the
    // fix first added the answer's raw points instead of scaling them by
    // the round's multiplier (roundValue is already multiplier-applied).
    multiplier: 3,
    answers: [{ ...ALPHA }, { ...BETA }],
  };
}

const TEAMS = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
];

/** Red controls, Alpha already revealed (pot 40 raw, 120 at 3x), 3 strikes reached, Blue is the set steal team. */
function startStealWithUnrevealedAnswer(): GameState {
  let s = createInitialState();
  s = gameReducer(s, { type: 'LOAD_GAME_ROUNDS', roundLibrary: [makeRound()], rounds: [makeRound()] });
  s = gameReducer(s, { type: 'UPDATE_TEAMS', teams: TEAMS });
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'alpha' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
  return s;
}

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  'value',
)!.set!;

function Harness({ initial, onState }: { initial: GameState; onState: (state: GameState) => void }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  useEffect(() => {
    onState(state);
  });
  return <GameScreen state={state} dispatch={dispatch} canUndo={false} />;
}

describe('Steal Success label matches the actual award (regression for stale pre-click pot)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let stateRef: { current: GameState };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mount(initial: GameState) {
    stateRef = { current: initial };
    const onState = (s: GameState) => {
      stateRef.current = s;
    };
    act(() => root.render(<Harness initial={initial} onState={onState} />));
  }

  function findButtonByText(pattern: RegExp): HTMLButtonElement {
    const buttons = Array.from(container.querySelectorAll('button'));
    const match = buttons.find((b) => pattern.test(b.textContent ?? ''));
    if (!match) throw new Error(`No button matching ${pattern}; saw: ${buttons.map((b) => b.textContent).join(' | ')}`);
    return match;
  }

  it('the pre-click "Steal Success" label includes the not-yet-revealed matched answer’s points', () => {
    mount(startStealWithUnrevealedAnswer());
    const guessInput = container.querySelector('#student-guess') as HTMLInputElement;
    act(() => {
      nativeInputValueSetter.call(guessInput, 'Beta');
      guessInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => findButtonByText(/^Evaluate$/).click());

    const successBtn = findButtonByText(/Steal Success/);
    // (Alpha 40 + Beta 25) * 3x multiplier = 195. Getting this right requires
    // scaling Beta's raw points by the multiplier, not adding them raw.
    expect(successBtn.textContent).toContain('+195');
  });

  it('clicking Steal Success awards exactly the amount the label displayed (no stale undercount)', () => {
    mount(startStealWithUnrevealedAnswer());
    const guessInput = container.querySelector('#student-guess') as HTMLInputElement;
    act(() => {
      nativeInputValueSetter.call(guessInput, 'Beta');
      guessInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => findButtonByText(/^Evaluate$/).click());

    const successBtn = findButtonByText(/Steal Success/);
    const labelMatch = successBtn.textContent!.match(/\+(\d+)/);
    const labeledAmount = Number(labelMatch![1]);

    const blueBefore = stateRef.current.teams.find((t) => t.id === 'team-blue')!.score;
    act(() => successBtn.click());
    const blueAfter = stateRef.current.teams.find((t) => t.id === 'team-blue')!.score;

    expect(blueAfter - blueBefore).toBe(labeledAmount);
    expect(blueAfter - blueBefore).toBe(195);
    expect(stateRef.current.phase).toBe('roundOver');
  });

  it('the "Steal Failed" label is unaffected (failing never reveals anything, no stale-label risk)', () => {
    mount(startStealWithUnrevealedAnswer());
    const failBtn = findButtonByText(/Steal Failed/);
    // Alpha (40) * 3x multiplier = 120; Beta stays unrevealed on a failed steal.
    expect(failBtn.textContent).toContain('+120');
  });
});
