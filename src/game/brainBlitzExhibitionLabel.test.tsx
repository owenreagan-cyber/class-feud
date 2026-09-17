import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialState, gameReducer } from './gameReducer';
import type { FeudAnswer, GameState } from './gameTypes';
import type { BrainBlitzConfig } from './brainBlitzTypes';
import BrainBlitzPresenter from '../components/presenter/BrainBlitzPresenter';
import BrainBlitzTeacherControls from '../components/teacher/BrainBlitzTeacherControls';

function makeConfig(): BrainBlitzConfig {
  return {
    enabled: true,
    timerSeconds: 30,
    targetScore: 200,
    questions: [
      { id: 'q1', prompt: 'Name a punctuation mark.', category: 'ELA', answers: [{ id: 'a1', text: 'Period', aliases: [], points: 35 }] },
    ],
  };
}

const ROUND: FeudAnswer[] = [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }];

function reachGameOver(): GameState {
  let s = gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    rounds: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    brainBlitzConfig: makeConfig(),
  });
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  expect(s.phase).toBe('gameOver');
  return s;
}

describe('Extra Blitz exhibition labeling', () => {
  it('presenter shows an EXHIBITION tag when exhibition is true', () => {
    const s = gameReducer(reachGameOver(), { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    const html = renderToStaticMarkup(<BrainBlitzPresenter state={s} />);
    expect(html).toContain('EXHIBITION');
  });

  it('presenter does NOT show an EXHIBITION tag for the primary Blitz', () => {
    const s = gameReducer(reachGameOver(), { type: 'BRAIN_BLITZ_ENTER' });
    const html = renderToStaticMarkup(<BrainBlitzPresenter state={s} />);
    expect(html).not.toContain('EXHIBITION');
  });

  it('presenter results screen is labeled as exhibition results', () => {
    let s = gameReducer(reachGameOver(), { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
    expect(s.brainBlitz?.status).toBe('complete');
    const html = renderToStaticMarkup(<BrainBlitzPresenter state={s} />);
    expect(html).toContain('Exhibition Brain Blitz results');
  });

  it('teacher controls results section is labeled as exhibition results', () => {
    let s = gameReducer(reachGameOver(), { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
    expect(s.brainBlitz?.status).toBe('complete');
    const html = renderToStaticMarkup(<BrainBlitzTeacherControls state={s} dispatch={() => {}} />);
    expect(html).toContain('Exhibition Brain Blitz results');
  });

  it('exhibition Blitz never alters the official winner or normal scores', () => {
    const before = reachGameOver();
    const after = gameReducer(before, { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    expect(after.teams).toEqual(before.teams);
    expect(after.phase).toBe('brainBlitz');
    // Exiting returns to gameOver with the same team scores intact.
    const exited = gameReducer(after, { type: 'BRAIN_BLITZ_EXIT' });
    expect(exited.phase).toBe('gameOver');
    expect(exited.teams).toEqual(before.teams);
  });
});
