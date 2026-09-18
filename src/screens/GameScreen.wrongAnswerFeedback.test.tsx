// @vitest-environment jsdom
import { act, StrictMode, useEffect, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameScreen from './GameScreen';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, FeudRound, GameState, Team } from '../game/gameTypes';
import { playWrongAnswerSound, unlockAudio } from '../teamButton/audio';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: string[] = [];

vi.mock('../teamButton/audio', () => ({
  unlockAudio: vi.fn(() => calls.push('unlockAudio')),
  playWrongAnswerSound: vi.fn(() => calls.push('playWrongAnswerSound')),
  playReadyDing: vi.fn(),
  playFirstPress: vi.fn(),
}));

const ANSWER: FeudAnswer = { id: 'a1', text: 'Answer One', aliases: [], points: 40, revealed: false };

function makeRound(): FeudRound {
  return {
    id: 'b1',
    title: 'Board 1',
    category: 'Testing',
    prompt: 'Name a thing.',
    multiplier: 1,
    answers: [{ ...ANSWER }],
  };
}

const TEAMS: Team[] = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
];

/** A fresh game, control given to Red, ready to strike/reveal on Board 1. */
function startPlaying(): GameState {
  let s = createInitialState();
  s = gameReducer(s, { type: 'LOAD_GAME_ROUNDS', roundLibrary: [makeRound()], rounds: [makeRound()] });
  s = gameReducer(s, { type: 'UPDATE_TEAMS', teams: TEAMS });
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  return s;
}

/** Same as startPlaying(), already 3-struck into the steal phase (Blue auto-selected). */
function startSteal(): GameState {
  let s = startPlaying();
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'a1' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  return s;
}

function Harness({
  initial,
  onState,
}: {
  initial: GameState;
  onState: (state: GameState) => void;
}) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  useEffect(() => {
    onState(state);
  }, [state, onState]);
  return <GameScreen state={state} dispatch={dispatch} canUndo={false} />;
}

function findButtonByText(container: HTMLElement, pattern: RegExp): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const match = buttons.find((b) => pattern.test(b.textContent ?? ''));
  if (!match) throw new Error(`No button matching ${pattern}; saw: ${buttons.map((b) => b.textContent).join(' | ')}`);
  return match;
}

describe('Strike/steal wrong-answer presentation feedback', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let stateRef: { current: GameState };

  beforeEach(() => {
    calls.length = 0;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mount(initial: GameState, strict = false) {
    stateRef = { current: initial };
    const onState = (s: GameState) => {
      stateRef.current = s;
    };
    const tree = <Harness initial={initial} onState={onState} />;
    act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
  }

  it('1. first strike increments strike state exactly once', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    expect(stateRef.current.strikes).toBe(1);
  });

  it('2. first strike triggers one presenter X event', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(1);
  });

  it('3. first strike attempts wrong-answer audio exactly once', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
  });

  it('4. a rerender with no new strike does not replay the effect', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    calls.length = 0;
    // Force a plain rerender (new element, same mounted instance/reducer state).
    act(() =>
      root.render(
        <Harness
          initial={stateRef.current}
          onState={(s) => {
            stateRef.current = s;
          }}
        />,
      ),
    );
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(0);
  });

  it('5. a second strike triggers one new effect', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    calls.length = 0;
    act(() => strikeBtn.click());
    expect(stateRef.current.strikes).toBe(2);
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
  });

  it('6. a third strike triggers one new effect', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    act(() => strikeBtn.click());
    calls.length = 0;
    act(() => strikeBtn.click());
    expect(stateRef.current.strikes).toBe(3);
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
    expect(container.querySelectorAll('.wrong-answer-overlay--strong')).toHaveLength(1);
  });

  it('7. the third strike still transitions to steal exactly as before', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    act(() => strikeBtn.click());
    act(() => strikeBtn.click());
    expect(stateRef.current.phase).toBe('steal');
    expect(stateRef.current.stealTeamId).toBe('team-blue');
  });

  it('8. the visual effect auto-clears', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(0);
  });

  it('9. the auto-clear does not mutate game state', () => {
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    const strikesBefore = stateRef.current.strikes;
    const phaseBefore = stateRef.current.phase;
    act(() => vi.advanceTimersByTime(1000));
    expect(stateRef.current.strikes).toBe(strikesBefore);
    expect(stateRef.current.phase).toBe(phaseBefore);
  });

  it('10. an audio failure does not block a strike', () => {
    mount(startPlaying());
    vi.mocked(unlockAudio).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    expect(() => act(() => strikeBtn.click())).not.toThrow();
    expect(stateRef.current.strikes).toBe(1);
  });

  it('11. an audio failure does not block steal resolution', () => {
    mount(startSteal());
    vi.mocked(playWrongAnswerSound).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const failBtn = findButtonByText(container, /Steal Failed/);
    expect(() => act(() => failBtn.click())).not.toThrow();
    expect(stateRef.current.phase).toBe('roundOver');
  });

  it('12. a failed steal can trigger wrong-answer feedback', () => {
    mount(startSteal());
    calls.length = 0;
    const failBtn = findButtonByText(container, /Steal Failed/);
    act(() => failBtn.click());
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(1);
  });

  it('13. a failed steal still awards the pot exactly once', () => {
    mount(startSteal());
    const redBefore = stateRef.current.teams.find((t) => t.id === 'team-red')!.score;
    const failBtn = findButtonByText(container, /Steal Failed/);
    act(() => failBtn.click());
    const red = stateRef.current.teams.find((t) => t.id === 'team-red')!;
    expect(red.score).toBe(redBefore + 40);
  });

  it('14. a failed steal still ends the round', () => {
    mount(startSteal());
    const failBtn = findButtonByText(container, /Steal Failed/);
    act(() => failBtn.click());
    expect(stateRef.current.phase).toBe('roundOver');
  });

  it('15. clearing the board without strikes does not play the wrong-answer sound', () => {
    let s = startPlaying();
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'a1' });
    mount(s);
    calls.length = 0;
    const awardBtn = findButtonByText(container, /^Award Round/);
    act(() => awardBtn.click());
    expect(stateRef.current.phase).toBe('roundOver');
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(0);
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(0);
  });

  it('16. revealing a correct answer does not play the wrong-answer sound', () => {
    mount(startPlaying());
    calls.length = 0;
    const revealBtn = findButtonByText(container, /Answer One/);
    act(() => revealBtn.click());
    expect(stateRef.current.rounds[0].answers[0].revealed).toBe(true);
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(0);
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(0);
  });

  it('17. reduced-motion mode still shows the X, just without the pop animation', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    mount(startPlaying());
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    const overlay = container.querySelector('.wrong-answer-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay?.classList.contains('wrong-answer-overlay--static')).toBe(true);
    expect(overlay?.querySelector('.wrong-answer-glyphs')?.textContent).toContain('✕');
  });

  it('18. no persisted-state field is added for the transient X/audio effect', () => {
    const keysBefore = Object.keys(startPlaying()).sort();
    let s = startSteal();
    s = gameReducer(s, { type: 'RESOLVE_STEAL', success: false });
    const keysAfter = Object.keys(s).sort();
    expect(keysAfter).toEqual(keysBefore);
    expect(keysAfter).not.toContain('wrongAnswerEvent');
    expect(keysAfter).not.toContain('strikeEffect');
  });

  it('19. under React Strict Mode, a single strike still triggers audio/visual exactly once', () => {
    mount(startPlaying(), true);
    const strikeBtn = findButtonByText(container, /^Add Strike/);
    act(() => strikeBtn.click());
    expect(stateRef.current.strikes).toBe(1);
    expect(calls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
    expect(container.querySelectorAll('.wrong-answer-overlay')).toHaveLength(1);
  });
});
