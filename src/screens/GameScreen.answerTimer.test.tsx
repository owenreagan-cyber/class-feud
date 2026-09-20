// @vitest-environment jsdom
import { act, useEffect, useReducer, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameScreen from './GameScreen';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, FeudRound, GameState, GameAction } from '../game/gameTypes';
import { playWrongAnswerSound } from '../teamButton/audio';
import type { TeamButtonHost } from '../teamButton/useTeamButtonHost';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const audioCalls: string[] = [];
vi.mock('../teamButton/audio', () => ({
  unlockAudio: vi.fn(() => audioCalls.push('unlockAudio')),
  playWrongAnswerSound: vi.fn(() => audioCalls.push('playWrongAnswerSound')),
  playReadyDing: vi.fn(),
  playFirstPress: vi.fn(),
}));

// GameScreen renders TeamButtonPanel during tossup/steal, which would
// otherwise open a real WebSocket in jsdom. This phase's tests only exercise
// the manual (no-Team-Buttons) paths, so a static no-session host is enough.
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

const TEAMS = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
  { id: 'team-green', name: 'Green', color: '#22c55e', score: 0 },
];

function startPlaying(): GameState {
  let s = createInitialState();
  s = gameReducer(s, { type: 'LOAD_GAME_ROUNDS', roundLibrary: [makeRound()], rounds: [makeRound()] });
  s = gameReducer(s, { type: 'UPDATE_TEAMS', teams: TEAMS });
  s = gameReducer(s, { type: 'START_GAME' });
  return s; // phase: 'tossup', no active team yet
}

/** Reach steal phase (3 strikes) with Red controlling and a nonzero pot. */
function startSteal(): GameState {
  let s = startPlaying();
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' }); // -> phase 'playing'
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'a1' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' });
  s = gameReducer(s, { type: 'ADD_STRIKE' }); // -> phase 'steal', 3 eligible teams so stealTeamId stays null
  return s;
}

function Harness({
  initial,
  onState,
  onDispatchCount,
}: {
  initial: GameState;
  onState: (state: GameState) => void;
  onDispatchCount?: (count: number) => void;
}) {
  const [state, rawDispatch] = useReducer(gameReducer, initial);
  const dispatchCountRef = useRef(0);
  const dispatch = (action: GameAction) => {
    dispatchCountRef.current += 1;
    rawDispatch(action);
  };
  useEffect(() => {
    onState(state);
    onDispatchCount?.(dispatchCountRef.current);
  });
  return <GameScreen state={state} dispatch={dispatch} canUndo={false} />;
}

describe('GameScreen answer timer integration', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let stateRef: { current: GameState };

  beforeEach(() => {
    audioCalls.length = 0;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
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

  it('27. manual steal-team pick (no Team Buttons device) starts the answer timer for that team', () => {
    mount(startSteal());
    const stealBtn = findButtonByText(/Blue steals/);
    act(() => stealBtn.click());
    const badge = container.querySelector('.presenter-answer-timer');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Blue');
    expect(badge?.textContent).toContain('5');
  });

  it('29. round end (RESOLVE_STEAL) clears the answer timer', () => {
    mount(startSteal());
    act(() => findButtonByText(/Blue steals/).click());
    expect(container.querySelector('.presenter-answer-timer')).toBeTruthy();
    const failBtn = findButtonByText(/Steal Failed/);
    act(() => failBtn.click());
    expect(stateRef.current.phase).toBe('roundOver');
    expect(container.querySelector('.presenter-answer-timer')).toBeNull();
  });

  it('12/13/14/15/9/10/8. expiry reuses the existing X overlay + wrong-answer sound, and adds no strike/score/steal-resolution/reveal', () => {
    mount(startSteal());
    act(() => findButtonByText(/Blue steals/).click());
    audioCalls.length = 0;

    const strikesBefore = stateRef.current.strikes;
    const scoresBefore = stateRef.current.teams.map((t) => t.score);
    const phaseBefore = stateRef.current.phase;
    const stealTeamBefore = stateRef.current.stealTeamId;
    const revealedBefore = stateRef.current.rounds[0].answers[0].revealed;

    act(() => vi.advanceTimersByTime(5100));

    expect(container.querySelector('.wrong-answer-overlay')).toBeTruthy();
    expect(audioCalls.filter((c) => c === 'playWrongAnswerSound')).toHaveLength(1);
    expect(vi.mocked(playWrongAnswerSound)).toHaveBeenCalledTimes(1);

    expect(stateRef.current.strikes).toBe(strikesBefore);
    expect(stateRef.current.teams.map((t) => t.score)).toEqual(scoresBefore);
    expect(stateRef.current.phase).toBe(phaseBefore);
    expect(stateRef.current.stealTeamId).toBe(stealTeamBefore);
    expect(stateRef.current.rounds[0].answers[0].revealed).toBe(revealedBefore);
  });

  it('16/17. after expiry, the teacher can still resolve the steal normally (authority intact)', () => {
    mount(startSteal());
    act(() => findButtonByText(/Blue steals/).click());
    act(() => vi.advanceTimersByTime(5100));

    const redBefore = stateRef.current.teams.find((t) => t.id === 'team-red')!.score;
    const failBtn = findButtonByText(/Steal Failed/);
    act(() => failBtn.click());
    const red = stateRef.current.teams.find((t) => t.id === 'team-red')!;
    expect(red.score).toBe(redBefore + 40);
    expect(stateRef.current.phase).toBe('roundOver');
  });

  it('30/31/32. clears on new board, game end, and Brain Blitz start (phase backstop)', () => {
    mount(startSteal());
    act(() => findButtonByText(/Blue steals/).click());
    expect(container.querySelector('.presenter-answer-timer')).toBeTruthy();

    act(() => findButtonByText(/Steal Failed/).click()); // -> roundOver, timer cleared
    expect(container.querySelector('.presenter-answer-timer')).toBeNull();

    // Back into a fresh tossup for hypothetical next board; still no timer until a press/manual pick.
    act(() => findButtonByText(/^Next Round$/).click());
    expect(container.querySelector('.presenter-answer-timer')).toBeNull();
  });

  it('35. timer ticks never dispatch to the game reducer (no undo-history pollution)', () => {
    let dispatchCount = 0;
    stateRef = { current: startSteal() };
    act(() =>
      root.render(
        <Harness
          initial={stateRef.current}
          onState={(s) => {
            stateRef.current = s;
          }}
          onDispatchCount={(count) => {
            dispatchCount = count;
          }}
        />,
      ),
    );
    act(() => findButtonByText(/Blue steals/).click());
    const countAfterStart = dispatchCount;
    act(() => vi.advanceTimersByTime(5100)); // several ticks + expiry
    expect(dispatchCount).toBe(countAfterStart);
  });

  it('11. an audio failure on expiry does not block teacher resolution afterward', () => {
    mount(startSteal());
    act(() => findButtonByText(/Blue steals/).click());
    vi.mocked(playWrongAnswerSound).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => act(() => vi.advanceTimersByTime(5100))).not.toThrow();
    const failBtn = findButtonByText(/Steal Failed/);
    expect(() => act(() => failBtn.click())).not.toThrow();
    expect(stateRef.current.phase).toBe('roundOver');
  });
});
