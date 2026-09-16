import { describe, expect, it } from 'vitest';
import { hasErrors, validateGameSet } from './contentValidation';
import type { AnswerDefinition, RoundDefinition, SavedGameSet } from './gameSet';

function answer(id: string, text: string, points: number, aliases: string[] = []): AnswerDefinition {
  return { id, text, points, aliases };
}

function round(id: string, overrides: Partial<RoundDefinition> = {}): RoundDefinition {
  return {
    id,
    title: 'Plants',
    category: 'Science',
    prompt: 'Name a plant part.',
    multiplier: 1,
    answers: [answer(`${id}-a1`, 'Root', 30), answer(`${id}-a2`, 'Stem', 25)],
    ...overrides,
  };
}

function game(overrides: Partial<SavedGameSet> = {}): SavedGameSet {
  return {
    id: 'game-1',
    title: 'Plants Review',
    description: '',
    source: 'custom',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    rounds: [round('r1')],
    ...overrides,
  };
}

describe('content validation', () => {
  it('valid game passes', () => {
    expect(hasErrors(validateGameSet(game()))).toBe(false);
  });

  it('blank game title fails', () => {
    const issues = validateGameSet(game({ title: '   ' }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'title')).toBe(true);
  });

  it('zero rounds fails', () => {
    const issues = validateGameSet(game({ rounds: [] }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds')).toBe(true);
  });

  it('blank round title fails', () => {
    const issues = validateGameSet(game({ rounds: [round('r1', { title: ' ' })] }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].title')).toBe(true);
  });

  it('blank prompt fails', () => {
    const issues = validateGameSet(game({ rounds: [round('r1', { prompt: '' })] }));
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].prompt')).toBe(true);
  });

  it('fewer than 2 answers fails', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('a1', 'Root', 30)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers')).toBe(true);
  });

  it('invalid multiplier fails', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { multiplier: 4 as 1 })] }),
    );
    expect(
      issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].multiplier'),
    ).toBe(true);
  });

  it('blank answer fails', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('a1', '  ', 30), answer('a2', 'Stem', 25)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[0].text')).toBe(
      true,
    );
  });

  it('negative points fail', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('a1', 'Root', -5), answer('a2', 'Stem', 25)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[0].points')).toBe(
      true,
    );
  });

  it('non-integer points fail', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('a1', 'Root', 3.5), answer('a2', 'Stem', 25)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[0].points')).toBe(
      true,
    );
  });

  it('points above the upper bound fail', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('a1', 'Root', 1000), answer('a2', 'Stem', 25)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[0].points')).toBe(
      true,
    );
  });

  it('duplicate answer ids fail', () => {
    const issues = validateGameSet(
      game({ rounds: [round('r1', { answers: [answer('dup', 'Root', 30), answer('dup', 'Stem', 25)] })] }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[1].id')).toBe(true);
  });

  it('duplicate normalized canonical answers fail', () => {
    const issues = validateGameSet(
      game({
        rounds: [
          round('r1', {
            answers: [answer('a1', 'Water', 30), answer('a2', '  water ', 25)],
          }),
        ],
      }),
    );
    expect(issues.some((i) => i.severity === 'error' && i.path === 'rounds[0].answers[1].text')).toBe(
      true,
    );
  });

  it('duplicate alias within one answer is warned', () => {
    const issues = validateGameSet(
      game({
        rounds: [
          round('r1', {
            answers: [answer('a1', 'Sunlight', 30, ['sun', ' sun ']), answer('a2', 'Water', 25)],
          }),
        ],
      }),
    );
    expect(
      issues.some(
        (i) => i.severity === 'warning' && i.path === 'rounds[0].answers[0].aliases',
      ),
    ).toBe(true);
  });

  it('shared alias across answers produces a warning', () => {
    const issues = validateGameSet(
      game({
        rounds: [
          round('r1', {
            answers: [answer('a1', 'Sunlight', 30, ['light']), answer('a2', 'Energy', 25, ['light'])],
          }),
        ],
      }),
    );
    expect(
      issues.some(
        (i) => i.severity === 'warning' && i.message.includes('shared by'),
      ),
    ).toBe(true);
  });

  it('alias equal to canonical answer is handled as a warning', () => {
    const issues = validateGameSet(
      game({
        rounds: [
          round('r1', {
            answers: [answer('a1', 'Water', 30, ['water']), answer('a2', 'Stem', 25)],
          }),
        ],
      }),
    );
    expect(
      issues.some(
        (i) =>
          i.severity === 'warning' &&
          i.path === 'rounds[0].answers[0].aliases' &&
          i.message.includes('same as the answer'),
      ),
    ).toBe(true);
  });

  it('validation does not mutate content', () => {
    const set = game();
    const snapshot = JSON.stringify(set);
    validateGameSet(set);
    expect(JSON.stringify(set)).toBe(snapshot);
  });

  it('deterministic validation output', () => {
    const set = game({
      rounds: [
        round('r1', {
          answers: [answer('a1', 'Sunlight', 30, ['light']), answer('a2', 'Energy', 25, ['light'])],
        }),
      ],
    });
    expect(validateGameSet(set)).toEqual(validateGameSet(set));
  });
});
