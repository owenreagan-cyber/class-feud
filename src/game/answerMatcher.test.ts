import { describe, expect, it } from 'vitest';
import { matchAnswer, normalize } from './answerMatcher';
import { ROUND_LIBRARY } from './roundLibrary';
import type { FeudAnswer } from './gameTypes';

function answersOf(roundId: string): FeudAnswer[] {
  const round = ROUND_LIBRARY.find((entry) => entry.id === roundId);
  if (!round) throw new Error(`round not found: ${roundId}`);
  return round.answers.map((answer) => ({ ...answer }));
}

function mk(id: string, text: string, aliases: string[], points: number, revealed = false): FeudAnswer {
  return { id, text, aliases, points, revealed };
}

describe('normalize', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalize('  Water ')).toBe('water');
    expect(normalize('  makes   laws ')).toBe('makes laws');
  });

  it('removes harmless trailing punctuation', () => {
    expect(normalize('WATER!')).toBe('water');
    expect(normalize('sunlight?')).toBe('sunlight');
  });

  it('normalizes curly apostrophes', () => {
    expect(normalize('\u2018don\u2019t')).toBe("don't");
  });
});

describe('answer matcher', () => {
  const plant = () => answersOf('round-1'); // Water / Sunlight / Air / Nutrients / Space

  it('exact canonical match', () => {
    const result = matchAnswer('Water', plant());
    expect(result.quality).toBe('exact');
    expect(result.answerId).toBe('water');
  });

  it('exact alias match', () => {
    const result = matchAnswer('sun', plant());
    expect(result.quality).toBe('alias');
    expect(result.answerId).toBe('sunlight');
  });

  it('uppercase canonical match', () => {
    const result = matchAnswer('WATER', plant());
    expect(result.quality).toBe('exact');
    expect(result.answerId).toBe('water');
  });

  it('punctuation normalization', () => {
    const result = matchAnswer('WATER!', plant());
    expect(result.quality).toBe('normalized');
    expect(result.answerId).toBe('water');
  });

  it('repeated whitespace normalization', () => {
    const jumpRope = answersOf('round-recess');
    const result = matchAnswer('  jump   rope ', jumpRope);
    expect(result.quality).toBe('normalized');
    expect(result.answerId).toBe('jump-rope');
  });

  it('normalized alias match', () => {
    const result = matchAnswer('growing room!', plant());
    expect(result.quality).toBe('normalized');
    expect(result.answerId).toBe('space');
  });

  it('simple typo fuzzy match', () => {
    const result = matchAnswer('nutriants', plant());
    expect(result.quality).toBe('fuzzy');
    expect(result.answerId).toBe('nutrients');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('obvious unrelated answer returns none', () => {
    const result = matchAnswer('purple', plant());
    expect(result.quality).toBe('none');
    expect(result.answerId).toBeNull();
  });

  it('short unrelated words do not fuzzy-match incorrectly', () => {
    const result = matchAnswer('cat', plant());
    expect(result.quality).toBe('none');

    const airTypos = matchAnswer('aor', [mk('air', 'Air', ['oxygen'], 20)]);
    expect(airTypos.quality).toBe('none');
  });

  it('revealed exact answer returns alreadyRevealed', () => {
    const answers = [mk('water', 'Water', ['h2o'], 35, true), mk('sunlight', 'Sunlight', ['sun'], 30)];
    const result = matchAnswer('water', answers);
    expect(result.quality).toBe('alreadyRevealed');
    expect(result.answerId).toBe('water');
  });

  it('revealed alias returns alreadyRevealed', () => {
    const answers = [mk('sunlight', 'Sunlight', ['sun'], 30, true)];
    const result = matchAnswer('sun', answers);
    expect(result.quality).toBe('alreadyRevealed');
    expect(result.answerId).toBe('sunlight');
  });

  it('unrevealed answer outranks revealed fuzzy candidate', () => {
    const answers = [
      mk('revealed', 'Rain', [], 30, true),
      mk('unrevealed', 'Brain', [], 20),
    ];
    const result = matchAnswer('brian', answers);
    expect(result.quality).toBe('fuzzy');
    expect(result.answerId).toBe('unrevealed');
  });

  it('ambiguous candidate result', () => {
    const answers = [
      mk('a', 'Sunlight', ['light'], 30),
      mk('b', 'Light bulb', ['light'], 20),
    ];
    const result = matchAnswer('light', answers);
    expect(result.quality).toBe('ambiguous');
    expect(result.candidateIds).toEqual(['a', 'b']);
    expect(result.answerId).toBeNull();
  });

  it('exact match outranks fuzzy candidate', () => {
    const answers = [mk('water', 'Water', [], 35), mk('waters', 'Waters', [], 10)];
    const result = matchAnswer('water', answers);
    expect(result.quality).toBe('exact');
    expect(result.answerId).toBe('water');
  });

  it('alias match outranks fuzzy candidate', () => {
    const answers = [mk('sunlight', 'Sunlight', ['sun'], 30), mk('sung', 'Sung', [], 10)];
    const result = matchAnswer('sun', answers);
    expect(result.quality).toBe('alias');
    expect(result.answerId).toBe('sunlight');
  });

  it('empty guess returns none', () => {
    const result = matchAnswer('', plant());
    expect(result.quality).toBe('none');
    expect(result.answerId).toBeNull();
  });

  it('whitespace-only guess returns none', () => {
    const result = matchAnswer('   ', plant());
    expect(result.quality).toBe('none');
    expect(result.answerId).toBeNull();
  });

  it('never mutates the answers it receives', () => {
    const answers = plant();
    const snapshot = JSON.stringify(answers);
    matchAnswer('nutriants', answers);
    expect(JSON.stringify(answers)).toBe(snapshot);
  });

  it('is deterministic for the same input', () => {
    const answers = plant();
    const first = matchAnswer('  Water! ', answers);
    const second = matchAnswer('  Water! ', answers);
    expect(second).toEqual(first);
  });
});
