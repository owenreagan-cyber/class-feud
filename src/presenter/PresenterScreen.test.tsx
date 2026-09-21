// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PresenterScreen from './PresenterScreen';
import type { PresenterState } from './usePresenterState';
import { createInitialState, gameReducer } from '../game/gameReducer';
import type { FeudAnswer, GameState, Team } from '../game/gameTypes';
import type { BrainBlitzConfig } from '../game/brainBlitzTypes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockSnapshot: PresenterState = null as never;

vi.mock('./usePresenterState', () => ({
  usePresenterState: () => mockSnapshot,
}));

const ANSWERS: FeudAnswer[] = [
  { id: 'a1', text: 'Pizza', aliases: [], points: 32, revealed: false },
  { id: 'a2', text: 'Tacos', aliases: [], points: 24, revealed: false },
  { id: 'a3', text: 'Burgers', aliases: [], points: 18, revealed: false },
];

function round() {
  return { id: 'r1', title: 'R1', category: 'Dinner', prompt: 'Name a food.', multiplier: 1 as const, answers: ANSWERS };
}

function makeTeams(count: number): Team[] {
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i}`,
    name: `Team ${i + 1}`,
    color: palette[i],
    score: 0,
  }));
}

function playingState(teams: Team[], answers: FeudAnswer[] = ANSWERS): GameState {
  let s = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ ...round(), answers }],
    rounds: [{ ...round(), answers }],
  });
  s = gameReducer(s, { type: 'START_GAME' });
  return { ...s, teams, phase: 'playing', activeTeamId: teams[0].id };
}

function setSnapshot(state: GameState) {
  mockSnapshot = { state, answerTimer: null, wrongAnswer: null };
}

function mount(): { root: Root; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<PresenterScreen />));
  return { root, container };
}

describe('PresenterScreen', () => {
  beforeEach(() => {
    mockSnapshot = null as never;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders no teacher controls, no answer entry, and no admin UI', () => {
    setSnapshot(playingState(makeTeams(2)));
    const { container, root } = mount();

    const html = container.innerHTML;
    expect(html).not.toContain('Teacher Controls');
    expect(html).not.toContain('Reveal answers');
    expect(html).not.toContain('Student Guess');
    expect(html).not.toContain('OPEN PRESENTER');
    expect(html).not.toContain('SET FIRST TEAM');
    expect(html).not.toContain('Add Strike');
    expect(html).not.toContain('Award Round');
    expect(container.querySelector('.teacher-view')).toBeNull();
    // The fullscreen control is the only button in the presenter.
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['ENTER FULLSCREEN']);
    act(() => root.unmount());
  });

  it('does not render unrevealed answer text or points in the DOM', () => {
    setSnapshot(playingState(makeTeams(2)));
    const { container, root } = mount();

    expect(container.innerHTML).not.toContain('Pizza');
    expect(container.innerHTML).not.toContain('Tacos');
    expect(container.innerHTML).not.toContain('Burgers');
    expect(container.innerHTML).not.toContain('32');
    expect(container.innerHTML).not.toContain('24');
    expect(container.innerHTML).not.toContain('18');
    act(() => root.unmount());
  });

  it('reveals answer + points once the answer is revealed', () => {
    const revealed = gameReducer(playingState(makeTeams(2)), { type: 'REVEAL_ANSWER', answerId: 'a1' });
    setSnapshot(revealed);
    const { container, root } = mount();

    expect(container.innerHTML).toContain('Pizza');
    expect(container.innerHTML).toContain('32');
    // The other answers stay hidden.
    expect(container.innerHTML).not.toContain('Tacos');
    expect(container.innerHTML).not.toContain('24');
    act(() => root.unmount());
  });

  it('marks the front slot number aria-hidden after reveal', () => {
    const revealed = gameReducer(playingState(makeTeams(2)), { type: 'REVEAL_ANSWER', answerId: 'a1' });
    setSnapshot(revealed);
    const { container, root } = mount();

    const fronts = Array.from(container.querySelectorAll('.answer-face--front'));
    expect(fronts[0].getAttribute('aria-hidden')).toBe('true');
    expect(fronts[1].getAttribute('aria-hidden')).toBe('false');
    act(() => root.unmount());
  });

  it.each([2, 3, 4])('renders %i team cards in the scoreboard', (count) => {
    setSnapshot(playingState(makeTeams(count)));
    const { container, root } = mount();
    expect(container.querySelectorAll('.team-card')).toHaveLength(count);
    act(() => root.unmount());
  });

  it('shows a waiting state before the game begins (setup)', () => {
    mockSnapshot = { state: createInitialState(), answerTimer: null, wrongAnswer: null };
    const { container, root } = mount();
    expect(container.textContent).toContain('Waiting for the game to start');
    expect(container.querySelector('.answer-board')).toBeNull();
    act(() => root.unmount());
  });
});

// Brain Blitz privacy at the presenter-route level.
function makeBlitzConfig(): BrainBlitzConfig {
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
    ],
  };
}

function player2ActiveState(): GameState {
  const single: FeudAnswer[] = [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }];
  let s = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: single }],
    rounds: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: single }],
    brainBlitzConfig: makeBlitzConfig(),
  });
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_NEXT_PLAYER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  return s;
}

describe('PresenterScreen Brain Blitz privacy', () => {
  beforeEach(() => {
    mockSnapshot = null as never;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render Player 1 answer text during Player 2', () => {
    mockSnapshot = { state: player2ActiveState(), answerTimer: null, wrongAnswer: null };
    const { container, root } = mount();
    expect(container.innerHTML).not.toContain('Period');
    expect(container.innerHTML).not.toContain('full stop');
    expect(container.innerHTML).toContain('Player 2');
    act(() => root.unmount());
  });

  it('renders the EXHIBITION label for an Extra Blitz', () => {
    // Build an exhibition (Extra) Blitz result state.
    let s = gameReducer(createInitialState(), {
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }] }],
      rounds: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }] }],
      brainBlitzConfig: makeBlitzConfig(),
    });
    s = gameReducer(s, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    mockSnapshot = { state: s, answerTimer: null, wrongAnswer: null };
    const { container, root } = mount();
    expect(container.innerHTML).toContain('EXHIBITION');
    act(() => root.unmount());
  });
});
