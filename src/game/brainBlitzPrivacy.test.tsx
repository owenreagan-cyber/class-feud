import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialState, gameReducer } from '../game/gameReducer';
import {
  getBrainBlitzCurrentQuestion,
  getBrainBlitzPlayerResponses,
  isBrainBlitzAnswerUsedByPlayer1,
} from '../game/gameSelectors';
import type { FeudAnswer, GameState } from '../game/gameTypes';
import type { BrainBlitzConfig } from '../game/brainBlitzTypes';
import BrainBlitzPresenter from '../components/presenter/BrainBlitzPresenter';

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

/** Build a player2Active state where Player 1 already accepted "Period" (a1) on q1. */
function player2ActiveState(): GameState {
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
  s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  // Player 1 accepts "Period" on q1, skips q2.
  s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_NEXT_PLAYER' });
  s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
  expect(s.brainBlitz?.status).toBe('player2Active');
  return s;
}

describe('Brain Blitz Player 1 privacy', () => {
  it('current-player responses selector does not expose Player 1 answers during Player 2', () => {
    const s = player2ActiveState();
    // currentPlayer is 2, so this returns Player 2's (empty) responses, not Player 1's.
    expect(s.brainBlitz?.currentPlayer).toBe(2);
    expect(getBrainBlitzPlayerResponses(s)).toEqual([]);
    // Player 1's accepted answer is retained internally but not surfaced here.
    expect(s.brainBlitz?.player1Responses[0].answerId).toBe('a1');
  });

  it('duplicate selector still detects Player 1 usage internally', () => {
    const s = player2ActiveState();
    expect(isBrainBlitzAnswerUsedByPlayer1(s, 'q1', 'a1')).toBe(true);
    expect(isBrainBlitzAnswerUsedByPlayer1(s, 'q1', 'a2')).toBe(false);
  });

  it('current question selector exposes only the prompt, not answers', () => {
    const s = player2ActiveState();
    const question = getBrainBlitzCurrentQuestion(s);
    expect(question?.prompt).toBe('Name a punctuation mark.');
  });

  it('presenter DOM does not render Player 1 answer text during Player 2', () => {
    const s = player2ActiveState();
    const html = renderToStaticMarkup(<BrainBlitzPresenter state={s} />);
    // The secret Player 1 accepted answer must not appear anywhere in the DOM.
    expect(html).not.toContain('Period');
    expect(html).not.toContain('full stop');
    // Player 2 is the visible current player, and the prompt is shown.
    expect(html).toContain('Player 2');
    expect(html).toContain('Name a punctuation mark.');
  });

  it('presenter hides Player 1 answer details on the Player 1 complete screen', () => {
    // Build a player1Complete state: Player 1 answered q1 then finished.
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
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
    expect(s.brainBlitz?.status).toBe('player1Complete');
    const html = renderToStaticMarkup(<BrainBlitzPresenter state={s} />);
    expect(html).not.toContain('Period');
    expect(html).toContain('Player 1 Complete');
  });
});
