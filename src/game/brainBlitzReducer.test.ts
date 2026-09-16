import { describe, expect, it } from 'vitest';
import { createHistory, createInitialState, gameReducer, historyReducer } from './gameReducer';
import { matchAnswer } from './answerMatcher';
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
          { id: 'a3', text: 'Question mark', aliases: ['?'], points: 15 },
        ],
      },
      {
        id: 'q2',
        prompt: 'Name a part of speech.',
        category: 'ELA',
        answers: [
          { id: 'b1', text: 'Noun', aliases: [], points: 40 },
          { id: 'b2', text: 'Verb', aliases: [], points: 30 },
        ],
      },
    ],
  };
}

const ROUND: FeudAnswer[] = [{ id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false }];

function loadBlitzGame(config: BrainBlitzConfig | null = makeConfig()): GameState {
  return gameReducer(createInitialState(), {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: [
      { id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND },
    ],
    rounds: [{ id: 'r1', title: 'T', category: 'C', prompt: 'P', multiplier: 1, answers: ROUND }],
    brainBlitzConfig: config,
  });
}

/** Reach gameOver with a unique winner (team-red 35, team-blue 0). */
function playToGameOver(): GameState {
  let s = loadBlitzGame();
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  return s;
}

/** Reach gameOver tied 0-0. */
function playToGameOverTied(): GameState {
  let s = loadBlitzGame();
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
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

function skipAll(state: GameState): GameState {
  let s = state;
  const count = s.brainBlitzConfig!.questions.length;
  for (let i = 0; i < count; i += 1) {
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
  }
  return s;
}

describe('Brain Blitz finalist + start', () => {
  it('unique normal-game winner preselects finalist', () => {
    const state = gameReducer(playToGameOver(), { type: 'BRAIN_BLITZ_ENTER' });
    expect(state.phase).toBe('brainBlitz');
    expect(state.brainBlitz?.finalistTeamId).toBe('team-red');
  });

  it('tie does not auto-select finalist', () => {
    const state = gameReducer(playToGameOverTied(), { type: 'BRAIN_BLITZ_ENTER' });
    expect(state.brainBlitz?.finalistTeamId).toBeNull();
  });

  it('teacher can select tied finalist', () => {
    let state = gameReducer(playToGameOverTied(), { type: 'BRAIN_BLITZ_ENTER' });
    state = gameReducer(state, { type: 'BRAIN_BLITZ_SET_FINALIST', teamId: 'team-blue' });
    expect(state.brainBlitz?.finalistTeamId).toBe('team-blue');
  });

  it('one-player mode starts correctly', () => {
    const state = startPlayer1('one');
    expect(state.brainBlitz?.playerMode).toBe('one');
    expect(state.brainBlitz?.status).toBe('player1Active');
    expect(state.brainBlitz?.currentPlayer).toBe(1);
  });

  it('two-player mode starts correctly', () => {
    const state = startPlayer1('two');
    expect(state.brainBlitz?.playerMode).toBe('two');
    expect(state.brainBlitz?.status).toBe('player1Active');
  });

  it('Brain Blitz unavailable when disabled', () => {
    const disabled: BrainBlitzConfig = { ...makeConfig(), enabled: false };
    const state = gameReducer(playToGameOverWith(disabled), { type: 'BRAIN_BLITZ_ENTER' });
    expect(state.phase).toBe('gameOver');
    expect(state.brainBlitz).toBeNull();
  });
});

function playToGameOverWith(config: BrainBlitzConfig): GameState {
  let s = loadBlitzGame(config);
  s = gameReducer(s, { type: 'START_GAME' });
  s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  return s;
}

describe('Brain Blitz player 1', () => {
  it('exact accepted answer scores', () => {
    const state = gameReducer(startPlayer1(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(state.brainBlitz?.player1Score).toBe(35);
    expect(state.brainBlitz?.player1Responses[0].status).toBe('accepted');
  });

  it('alias accepted answer scores', () => {
    const state = gameReducer(startPlayer1(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'full stop',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(state.brainBlitz?.player1Score).toBe(35);
  });

  it('fuzzy suggestion does not auto-score', () => {
    const start = startPlayer1();
    const question = start.brainBlitzConfig!.questions[0];
    const answers: FeudAnswer[] = question.answers.map((a) => ({ ...a, revealed: false }));
    const match = matchAnswer('perod', answers);
    expect(match.quality).toBe('fuzzy');
    // No reducer action happened — the score is untouched.
    expect(start.brainBlitz?.player1Score).toBe(0);
  });

  it('accepted response scores exactly once', () => {
    const state = gameReducer(startPlayer1(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(state.brainBlitz?.player1Score).toBe(35);
    expect(state.brainBlitz?.player1Responses).toHaveLength(1);
  });

  it('repeated acceptance cannot double-score', () => {
    // Resolve every question, then an extra RESOLVE must be a no-op.
    const finished = skipAll(startPlayer1());
    expect(finished.brainBlitz?.status).toBe('player1Complete');
    const again = gameReducer(finished, {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(again).toBe(finished);
  });

  it('skipped question scores 0', () => {
    const state = gameReducer(startPlayer1(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'idk',
      resolution: 'skipped',
    });
    expect(state.brainBlitz?.player1Score).toBe(0);
    expect(state.brainBlitz?.player1Responses[0].status).toBe('skipped');
  });

  it('next question advances correctly', () => {
    const state = gameReducer(startPlayer1(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(state.brainBlitz?.currentQuestionIndex).toBe(1);
  });

  it('final question completes Player 1 (two-player)', () => {
    const finished = skipAll(startPlayer1('two'));
    expect(finished.brainBlitz?.status).toBe('player1Complete');
    expect(finished.brainBlitz?.timerRunning).toBe(false);
  });

  it('final question completes Brain Blitz (one-player)', () => {
    const finished = skipAll(startPlayer1('one'));
    expect(finished.brainBlitz?.status).toBe('complete');
  });

  it('Undo accepted response restores score/state', () => {
    let history = createHistory(startPlayer1());
    history = historyReducer(history, {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(history.present.brainBlitz?.player1Score).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.brainBlitz?.player1Score).toBe(0);
    expect(history.present.brainBlitz?.player1Responses).toHaveLength(0);
    expect(history.present.brainBlitz?.currentQuestionIndex).toBe(0);
  });

  it('normal game score remains unchanged during Brain Blitz', () => {
    const before = startPlayer1();
    const after = gameReducer(before, {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(after.teams.map((t) => t.score)).toEqual(before.teams.map((t) => t.score));
    expect(after.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
  });
});

describe('Brain Blitz player 2', () => {
  function startPlayer2(): GameState {
    let s = startPlayer1('two');
    // Player 1 accepts "Period" (a1) on q1, skips q2.
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'skip', resolution: 'skipped' });
    expect(s.brainBlitz?.status).toBe('player1Complete');
    s = gameReducer(s, { type: 'BRAIN_BLITZ_NEXT_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    return s;
  }

  it('Player 2 begins after Player 1', () => {
    const s = startPlayer2();
    expect(s.brainBlitz?.status).toBe('player2Active');
    expect(s.brainBlitz?.currentPlayer).toBe(2);
    expect(s.brainBlitz?.currentQuestionIndex).toBe(0);
  });

  it('Player 1 responses retained', () => {
    const s = startPlayer2();
    expect(s.brainBlitz?.player1Responses).toHaveLength(2);
    expect(s.brainBlitz?.player1Score).toBe(35);
  });

  it('Player 1 accepted answer is blocked as duplicate', () => {
    const s = gameReducer(startPlayer2(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(s.brainBlitz?.player2Responses[0].status).toBe('duplicate');
  });

  it('duplicate gives 0 points', () => {
    const s = gameReducer(startPlayer2(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Period',
      resolution: 'accepted',
      answerId: 'a1',
    });
    expect(s.brainBlitz?.player2Score).toBe(0);
  });

  it('alternate answer scores normally', () => {
    const s = gameReducer(startPlayer2(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Comma',
      resolution: 'accepted',
      answerId: 'a2',
    });
    expect(s.brainBlitz?.player2Responses[0].status).toBe('accepted');
    expect(s.brainBlitz?.player2Score).toBe(25);
  });

  it('no-match gives 0', () => {
    const s = gameReducer(startPlayer2(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'banana',
      resolution: 'noMatch',
    });
    expect(s.brainBlitz?.player2Responses[0].status).toBe('noMatch');
    expect(s.brainBlitz?.player2Score).toBe(0);
  });

  it('Player 2 score independent of Player 1', () => {
    const s = gameReducer(startPlayer2(), {
      type: 'BRAIN_BLITZ_RESOLVE',
      rawResponse: 'Comma',
      resolution: 'accepted',
      answerId: 'a2',
    });
    expect(s.brainBlitz?.player1Score).toBe(35);
    expect(s.brainBlitz?.player2Score).toBe(25);
  });

  it('combined score correct', () => {
    let s = startPlayer2();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Comma', resolution: 'accepted', answerId: 'a2' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Noun', resolution: 'accepted', answerId: 'b1' });
    expect(s.brainBlitz?.player1Score).toBe(35);
    expect(s.brainBlitz?.player2Score).toBe(25 + 40);
  });
});

describe('Brain Blitz final result', () => {
  function completeOnePlayer(): GameState {
    let s = startPlayer1('one');
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'x', resolution: 'skipped' });
    return s;
  }

  it('total below target = not achieved', () => {
    const s = completeOnePlayer();
    expect(s.brainBlitz?.status).toBe('complete');
    expect(s.brainBlitz!.player1Score).toBeLessThan(s.brainBlitz!.targetScore);
  });

  it('total equal target = achieved', () => {
    const config = makeConfig();
    config.targetScore = 35;
    let s = loadBlitzGame(config);
    s = gameReducer(s, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'x', resolution: 'skipped' });
    expect(s.brainBlitz!.player1Score).toBe(s.brainBlitz!.targetScore);
  });

  it('total above target = achieved', () => {
    const config = makeConfig();
    config.targetScore = 10;
    let s = loadBlitzGame(config);
    s = gameReducer(s, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'x', resolution: 'skipped' });
    expect(s.brainBlitz!.player1Score).toBeGreaterThan(s.brainBlitz!.targetScore);
  });

  it('one-player total compares correctly', () => {
    const s = completeOnePlayer();
    expect(s.brainBlitz!.player1Score).toBe(35);
    expect(s.brainBlitz!.player2Score).toBe(0);
  });

  it('final result deterministic', () => {
    const a = completeOnePlayer();
    const b = completeOnePlayer();
    expect(a.brainBlitz).toEqual(b.brainBlitz);
  });

  it('Brain Blitz does not modify normal standings', () => {
    const s = completeOnePlayer();
    expect(s.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
    expect(s.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
  });
});
