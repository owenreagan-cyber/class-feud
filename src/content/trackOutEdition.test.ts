import { describe, expect, it } from 'vitest';
import { validateGameSet } from './contentValidation';
import type { SavedGameSet } from './gameSet';
import { TRACK_OUT_EDITION, TRACK_OUT_DEFAULT_ROUND_IDS } from './trackOutEdition';
import { getBuiltInGameSet } from './builtInGameSets';
import { duplicateGameSet } from './gameSet';

describe('Track Out Edition content', () => {
  const set: SavedGameSet = TRACK_OUT_EDITION;

  it('is registered as a built-in game set', () => {
    expect(getBuiltInGameSet('builtin-track-out')).toBe(set);
  });

  it('validates with no errors', () => {
    const issues = validateGameSet(set);
    const errors = issues.filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('has at least 12 polished regular boards', () => {
    expect(set.rounds.length).toBeGreaterThanOrEqual(12);
  });

  it('has spare boards beyond the default play order', () => {
    expect(set.rounds.length - TRACK_OUT_DEFAULT_ROUND_IDS.length).toBeGreaterThanOrEqual(9);
  });

  it('has a non-empty default round set that references real rounds', () => {
    expect(TRACK_OUT_DEFAULT_ROUND_IDS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(set.rounds.map((round) => round.id));
    for (const id of TRACK_OUT_DEFAULT_ROUND_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('has a valid, enabled Brain Blitz config', () => {
    expect(set.brainBlitz).toBeDefined();
    expect(set.brainBlitz?.enabled).toBe(true);
    expect(set.brainBlitz?.questions).toHaveLength(5);
    expect(set.brainBlitz?.timerSeconds).toBeGreaterThanOrEqual(30);
    expect(set.brainBlitz?.timerSeconds).toBeLessThanOrEqual(45);
    const issues = validateGameSet(set);
    expect(issues.filter((issue) => issue.severity === 'error' && issue.path.startsWith('brainBlitz'))).toEqual([]);
  });

  it('declares classroom-game-weight, not survey data', () => {
    expect(set.scoringBasis).toBe('classroom-game-weight');
    const text = JSON.stringify(set).toLowerCase();
    expect(text).not.toContain('survey');
    expect(text).not.toContain('students were asked');
  });

  it('contains no forbidden content signatures', () => {
    const text = JSON.stringify(set).toLowerCase();
    // Sensitive / embarrassing / out-of-scope topics. Cross-project
    // contamination signatures are enforced globally by `npm run check:scope`,
    // not by this content test.
    const forbidden = [
      'dating',
      'boyfriend',
      'girlfriend',
      'crush',
      'popularity contest',
      'religion',
      'politics',
      'election',
      'president',
      'church',
      'body image',
      'diet',
      'calories',
      'technology class',
    ];
    for (const term of forbidden) {
      expect(text).not.toContain(term);
    }
  });

  it('all round, answer, question, and blitz ids are unique', () => {
    const ids = new Set<string>();
    const dupes: string[] = [];
    const collect = (id: string) => {
      if (ids.has(id)) dupes.push(id);
      ids.add(id);
    };
    collect(set.id);
    for (const round of set.rounds) {
      collect(round.id);
      for (const answer of round.answers) collect(answer.id);
    }
    if (set.brainBlitz) {
      for (const question of set.brainBlitz.questions) {
        collect(question.id);
        for (const answer of question.answers) collect(answer.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('duplicating preserves default-round selection with new ids', () => {
    const copy = duplicateGameSet(set);
    expect(copy.defaultRoundIds).toHaveLength(TRACK_OUT_DEFAULT_ROUND_IDS.length);
    // Fresh round ids, and the default selection maps to the fresh ids.
    const copyIds = new Set(copy.rounds.map((round) => round.id));
    for (const id of copy.defaultRoundIds ?? []) {
      expect(copyIds.has(id)).toBe(true);
    }
    // No id collisions with the source.
    for (const round of copy.rounds) {
      expect(set.rounds.some((source) => source.id === round.id)).toBe(false);
    }
    expect(copy.scoringBasis).toBe('classroom-game-weight');
  });
});
