import { describe, expect, it } from 'vitest';
import { hasErrors, validateGameSet, validateBrainBlitz } from './contentValidation';
import { duplicateGameSet } from './gameSet';
import type { SavedGameSet } from './gameSet';
import { BUILT_IN_GAME_SETS } from './builtInGameSets';
import { createInitialState, gameReducer } from '../game/gameReducer';
import { toFeudRounds } from './gameSet';
import type {
  BrainBlitzAnswer,
  BrainBlitzConfig,
  BrainBlitzQuestion,
} from '../game/brainBlitzTypes';

function answer(id: string, text: string, points: number, aliases: string[] = []): BrainBlitzAnswer {
  return { id, text, aliases, points };
}

function question(id: string, prompt: string, answers: BrainBlitzAnswer[]): BrainBlitzQuestion {
  return { id, prompt, category: 'Demo', answers };
}

function config(overrides: Partial<BrainBlitzConfig> = {}): BrainBlitzConfig {
  return {
    enabled: true,
    timerSeconds: 30,
    targetScore: 200,
    questions: [
      question('q1', 'Name a punctuation mark.', [
        answer('a1', 'Period', 35, ['full stop']),
        answer('a2', 'Comma', 25),
      ]),
    ],
    ...overrides,
  };
}

function game(blitz?: BrainBlitzConfig): SavedGameSet {
  return {
    id: 'game-1',
    title: 'Plants Review',
    description: '',
    source: 'custom',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    rounds: [
      {
        id: 'r1',
        title: 'Plants',
        category: 'Science',
        prompt: 'Name a plant part.',
        multiplier: 1,
        answers: [
          { id: 'pa1', text: 'Root', points: 30, aliases: [] },
          { id: 'pa2', text: 'Stem', points: 25, aliases: [] },
        ],
      },
    ],
    brainBlitz: blitz,
  };
}

describe('Brain Blitz content model', () => {
  it('disabled Brain Blitz game remains valid', () => {
    const disabled = config({ enabled: false, questions: [] });
    expect(hasErrors(validateGameSet(game(disabled)))).toBe(false);
  });

  it('enabled valid configuration passes', () => {
    expect(hasErrors(validateGameSet(game(config())))).toBe(false);
  });

  it('enabled zero-question config fails', () => {
    const issues = validateBrainBlitz(config({ questions: [] }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions')).toBe(true);
  });

  it('blank question fails', () => {
    const issues = validateBrainBlitz(
      config({ questions: [question('q1', '   ', [answer('a1', 'Period', 35), answer('a2', 'Comma', 25)])] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[0].prompt')).toBe(true);
  });

  it('fewer than 2 answers fails', () => {
    const issues = validateBrainBlitz(config({ questions: [question('q1', 'Prompt?', [answer('a1', 'Only', 35)])] }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[0].answers')).toBe(true);
  });

  it('duplicate normalized answers fail', () => {
    const issues = validateBrainBlitz(
      config({ questions: [question('q1', 'Prompt?', [answer('a1', 'Period', 35), answer('a2', '  period ', 25)])] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[0].answers[1].text')).toBe(true);
  });

  it('invalid timer fails', () => {
    expect(
      validateBrainBlitz(config({ timerSeconds: 5 })).some(
        (i) => i.severity === 'error' && i.path === 'brainBlitz.timerSeconds',
      ),
    ).toBe(true);
    expect(
      validateBrainBlitz(config({ timerSeconds: 999 })).some(
        (i) => i.severity === 'error' && i.path === 'brainBlitz.timerSeconds',
      ),
    ).toBe(true);
  });

  it('invalid target fails', () => {
    expect(
      validateBrainBlitz(config({ targetScore: 0 })).some(
        (i) => i.severity === 'error' && i.path === 'brainBlitz.targetScore',
      ),
    ).toBe(true);
  });

  it('invalid points fail', () => {
    const issues = validateBrainBlitz(
      config({ questions: [question('q1', 'Prompt?', [answer('a1', 'Period', -5), answer('a2', 'Comma', 25)])] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[0].answers[0].points')).toBe(true);
  });

  it('duplicate question IDs fail', () => {
    const issues = validateBrainBlitz(
      config({
        questions: [
          question('dup', 'One?', [answer('a1', 'Period', 35), answer('a2', 'Comma', 25)]),
          question('dup', 'Two?', [answer('b1', 'Noun', 35), answer('b2', 'Verb', 25)]),
        ],
      }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[1].id')).toBe(true);
  });

  it('duplicate answer IDs fail', () => {
    const issues = validateBrainBlitz(
      config({
        questions: [
          question('q1', 'One?', [answer('dup', 'Period', 35), answer('dup', 'Comma', 25)]),
        ],
      }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'brainBlitz.questions[0].answers[1].id')).toBe(true);
  });

  it('disabled incomplete draft does not block save', () => {
    const incomplete = config({
      enabled: false,
      questions: [question('q1', '', [answer('a1', '', -1)])],
      timerSeconds: -1,
      targetScore: 0,
    });
    expect(hasErrors(validateGameSet(game(incomplete)))).toBe(false);
  });

  it('duplicated game regenerates Brain Blitz question IDs', () => {
    const source = game(config());
    const copy = duplicateGameSet(source);
    expect(copy.brainBlitz!.questions.map((q) => q.id)).not.toEqual(
      source.brainBlitz!.questions.map((q) => q.id),
    );
  });

  it('duplicated game regenerates Brain Blitz answer IDs', () => {
    const source = game(config());
    const copy = duplicateGameSet(source);
    const srcAnswerIds = source.brainBlitz!.questions.flatMap((q) => q.answers.map((a) => a.id));
    const copyAnswerIds = copy.brainBlitz!.questions.flatMap((q) => q.answers.map((a) => a.id));
    expect(copyAnswerIds).not.toEqual(srcAnswerIds);
  });

  it('runtime copy does not mutate saved source', () => {
    const set = game(config());
    const snapshot = JSON.stringify(set);
    const rounds = toFeudRounds(set.rounds);
    let state = gameReducer(createInitialState(), {
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary: rounds,
      rounds,
      brainBlitzConfig: set.brainBlitz ?? null,
    });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    state = gameReducer(state, { type: 'NEXT_ROUND' });
    // Enter Brain Blitz from gameOver and actually play a response.
    state = gameReducer(state, { type: 'BRAIN_BLITZ_ENTER' });
    state = gameReducer(state, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    state = gameReducer(state, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    state = gameReducer(state, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    expect(state.phase).toBe('brainBlitz');
    expect(state.brainBlitz?.player1Score).toBe(35);
    // The authored source is byte-for-byte unchanged.
    expect(JSON.stringify(set)).toBe(snapshot);
  });

  it('every built-in demo set has playable Brain Blitz content', () => {
    for (const set of BUILT_IN_GAME_SETS) {
      expect(set.brainBlitz?.enabled).toBe(true);
      expect(set.brainBlitz!.questions.length).toBeGreaterThan(0);
      expect(hasErrors(validateGameSet(set))).toBe(false);
    }
  });
});
