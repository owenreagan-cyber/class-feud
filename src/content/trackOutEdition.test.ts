import { describe, expect, it } from 'vitest';
import { validateGameSet } from './contentValidation';
import type { SavedGameSet } from './gameSet';
import {
  TRACK_OUT_EDITION,
  TRACK_OUT_DEFAULT_ROUND_IDS,
  TRACK_OUT_CLASS_2,
  TRACK_OUT_CLASS_2_ROUND_IDS,
  TRACK_OUT_CLASS_3,
  TRACK_OUT_CLASS_3_ROUND_IDS,
  TRACK_OUT_CLASS_4,
  TRACK_OUT_CLASS_4_ROUND_IDS,
  TRACK_OUT_SPARE_IDS,
  scopeTrackOutRoundLibrary,
} from './trackOutEdition';
import { BUILT_IN_GAME_SETS, getBuiltInGameSet } from './builtInGameSets';
import { duplicateGameSet, toFeudRounds } from './gameSet';
import { matchAnswer } from '../game/answerMatcher';

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

  it('does not alias Soccer to kickball (a different game)', () => {
    const recess = set.rounds.find((round) => round.id === 'to-recess');
    const soccer = recess?.answers.find((answer) => answer.id === 'to-recess-soccer');
    expect(soccer?.aliases).not.toContain('kickball');

    const recessBlitz = set.brainBlitz?.questions.find((question) => question.id === 'tob-recess');
    const blitzSoccer = recessBlitz?.answers.find((answer) => answer.id === 'tob-r-soccer');
    expect(blitzSoccer?.aliases).not.toContain('kickball');
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

describe('Track Out class rotations', () => {
  const CLASS_SETS = [TRACK_OUT_EDITION, TRACK_OUT_CLASS_2, TRACK_OUT_CLASS_3, TRACK_OUT_CLASS_4];
  const CLASS_DEFAULT_IDS = [
    TRACK_OUT_DEFAULT_ROUND_IDS,
    TRACK_OUT_CLASS_2_ROUND_IDS,
    TRACK_OUT_CLASS_3_ROUND_IDS,
    TRACK_OUT_CLASS_4_ROUND_IDS,
  ];
  const ALL_BOARD_IDS = new Set(TRACK_OUT_EDITION.rounds.map((round) => round.id));
  const EXPECTED_SPARE_IDS = ['to-decor', 'to-games', 'to-first', 'to-forget', 'to-better', 'to-fivemin'];

  it('the Track Out board pool has exactly 18 boards', () => {
    expect(TRACK_OUT_EDITION.rounds).toHaveLength(18);
  });

  it('exactly 4 class rotations exist', () => {
    expect(CLASS_SETS).toHaveLength(4);
    expect(CLASS_DEFAULT_IDS).toHaveLength(4);
  });

  it('each rotation names exactly 3 boards', () => {
    for (const ids of CLASS_DEFAULT_IDS) {
      expect(ids).toHaveLength(3);
    }
  });

  it('every referenced board id exists in the shared 18-board pool', () => {
    for (const ids of CLASS_DEFAULT_IDS) {
      for (const id of ids) {
        expect(ALL_BOARD_IDS.has(id)).toBe(true);
      }
    }
  });

  it('no board is used as a default in more than one rotation', () => {
    const seen = new Map<string, number>();
    CLASS_DEFAULT_IDS.forEach((ids, setIndex) => {
      for (const id of ids) {
        if (seen.has(id)) {
          throw new Error(`board ${id} is a default in both set ${seen.get(id)} and set ${setIndex}`);
        }
        seen.set(id, setIndex);
      }
    });
    expect(seen.size).toBe(12);
  });

  it('exactly 12 boards are used as regulars and 6 remain as the shared spare pool', () => {
    const regularIds = new Set(CLASS_DEFAULT_IDS.flat());
    expect(regularIds.size).toBe(12);
    const spareIds = [...ALL_BOARD_IDS].filter((id) => !regularIds.has(id));
    expect(spareIds.sort()).toEqual([...EXPECTED_SPARE_IDS].sort());
    // Regular and spare sets are disjoint and their union is all 18 boards.
    for (const id of spareIds) expect(regularIds.has(id)).toBe(false);
    expect(regularIds.size + spareIds.length).toBe(ALL_BOARD_IDS.size);
  });

  it('every board has unique answer ids and unique canonical answer text', () => {
    for (const round of TRACK_OUT_EDITION.rounds) {
      const ids = round.answers.map((answer) => answer.id);
      expect(new Set(ids).size).toBe(ids.length);
      const texts = round.answers.map((answer) => answer.text.trim().toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('all four rotations share the same 18-board pool and Brain Blitz (no content duplication)', () => {
    for (const set of CLASS_SETS) {
      expect(set.rounds).toBe(TRACK_OUT_EDITION.rounds);
      expect(set.brainBlitz).toBe(TRACK_OUT_EDITION.brainBlitz);
    }
  });

  it('scoringBasis remains classroom-game-weight for every rotation', () => {
    for (const set of CLASS_SETS) {
      expect(set.scoringBasis).toBe('classroom-game-weight');
    }
  });

  it('each rotation is registered as a distinct, pickable built-in game set', () => {
    const ids = CLASS_SETS.map((set) => set.id);
    expect(new Set(ids).size).toBe(4);
    for (const set of CLASS_SETS) {
      expect(getBuiltInGameSet(set.id)).toBe(set);
      expect(BUILT_IN_GAME_SETS).toContain(set);
    }
  });

  /** Mirrors the fixed App.tsx startGameSet: play order follows defaultRoundIds
   *  itself, not each round's incidental position in the full board array. */
  function selectDefaultRounds(set: SavedGameSet) {
    const allRounds = toFeudRounds(set.rounds);
    const defaultIds = set.defaultRoundIds ?? set.rounds.map((round) => round.id);
    const roundsById = new Map(allRounds.map((round) => [round.id, round]));
    return defaultIds.map((id) => roundsById.get(id)).filter((round) => round !== undefined);
  }

  it('each rotation loads its own three boards, in the authored order (not array position)', () => {
    CLASS_SETS.forEach((set, index) => {
      const expectedIds = CLASS_DEFAULT_IDS[index];
      const selected = selectDefaultRounds(set);
      // Exact order match -- catches the class of bug where filter() silently
      // reorders to each round's position in the full 18-board array instead
      // of the authored defaultRoundIds order.
      expect(selected.map((round) => round.id)).toEqual(expectedIds);
      expect(selected).toHaveLength(3);
    });
  });

  it('switching from one rotation to another changes the playable three boards', () => {
    const idsFor = (set: SavedGameSet) => {
      const allRounds = toFeudRounds(set.rounds);
      const defaultIds = set.defaultRoundIds ?? set.rounds.map((round) => round.id);
      return allRounds.filter((round) => defaultIds.includes(round.id)).map((round) => round.id).sort();
    };
    const class1Ids = idsFor(TRACK_OUT_EDITION);
    const class2Ids = idsFor(TRACK_OUT_CLASS_2);
    expect(class1Ids).not.toEqual(class2Ids);
  });

  /** Mirrors gameSelectors.ts's getSpareRounds: roundLibrary minus the
   *  currently-selected default rounds. */
  function extraBoardPoolIds(set: SavedGameSet, expectedIds: string[]): string[] {
    const allRounds = toFeudRounds(set.rounds);
    const defaultIds = set.defaultRoundIds ?? set.rounds.map((round) => round.id);
    const roundLibrary = scopeTrackOutRoundLibrary(set.id, defaultIds, allRounds);
    const selected = new Set(expectedIds);
    return roundLibrary.filter((round) => !selected.has(round.id)).map((round) => round.id);
  }

  it('each rotation offers exactly the six designated spares via + EXTRA BOARD, nothing more', () => {
    CLASS_SETS.forEach((set, index) => {
      const expectedIds = CLASS_DEFAULT_IDS[index];
      const extras = extraBoardPoolIds(set, expectedIds);
      expect(extras.sort()).toEqual([...TRACK_OUT_SPARE_IDS].sort());
    });
  });

  it('no regular board from any rotation appears in another rotation’s Extra Board pool', () => {
    const allRegularIds = new Set(CLASS_DEFAULT_IDS.flat());
    CLASS_SETS.forEach((set, index) => {
      const expectedIds = CLASS_DEFAULT_IDS[index];
      const extras = extraBoardPoolIds(set, expectedIds);
      for (const id of extras) {
        // Every extra must be a designated spare, never another rotation's regular board.
        expect(TRACK_OUT_SPARE_IDS).toContain(id);
        const isSomeoneElsesRegular = allRegularIds.has(id) && !expectedIds.includes(id);
        expect(isSomeoneElsesRegular).toBe(false);
      }
    });
  });

  it('all six designated spares are available to every rotation', () => {
    CLASS_SETS.forEach((set, index) => {
      const expectedIds = CLASS_DEFAULT_IDS[index];
      const extras = new Set(extraBoardPoolIds(set, expectedIds));
      for (const spareId of TRACK_OUT_SPARE_IDS) {
        expect(extras.has(spareId)).toBe(true);
      }
    });
  });

  it('non-Track-Out built-in sets retain unrestricted Extra Board behavior (roundLibrary = all rounds)', () => {
    const otherSet = BUILT_IN_GAME_SETS.find((set) => set.source === 'builtin' && set.id === 'builtin-mixed')!;
    const allRounds = toFeudRounds(otherSet.rounds);
    const defaultIds = otherSet.defaultRoundIds ?? otherSet.rounds.map((round) => round.id);
    const roundLibrary = scopeTrackOutRoundLibrary(otherSet.id, defaultIds, allRounds);
    expect(roundLibrary).toBe(allRounds);
  });
});

describe('3D Print Favorites board (4th-grade kid interest refinement)', () => {
  const board = TRACK_OUT_EDITION.rounds.find((round) => round.id === 'to-3dprint')!;
  const runtimeAnswers = toFeudRounds([board])[0].answers;

  it('prompt is framed for 4th-grade kid interest', () => {
    expect(board.prompt.toLowerCase()).toContain('4th grader');
    expect(board.prompt.toLowerCase()).toContain('cool to 3d print');
  });

  it('has exactly 5 answers', () => {
    expect(board.answers).toHaveLength(5);
  });

  it('has no phone-related canonical answer', () => {
    const phoneTerms = ['phone', 'iphone', 'earbud', 'airpod'];
    for (const answer of board.answers) {
      const text = answer.text.toLowerCase();
      for (const term of phoneTerms) {
        expect(text).not.toContain(term);
      }
    }
  });

  it('has no phone-related alias', () => {
    const phoneTerms = ['phone', 'iphone', 'earbud', 'airpod', 'case', 'stand'];
    for (const answer of board.answers) {
      for (const alias of answer.aliases) {
        const lower = alias.toLowerCase();
        for (const term of phoneTerms) {
          expect(lower).not.toContain(term);
        }
      }
    }
  });

  it('fidget aliases resolve to Fidget Toy', () => {
    for (const guess of ['fidget', 'spinner', 'clicker', 'fidget spinner', 'fidget cube', 'FIDGET']) {
      const result = matchAnswer(guess, runtimeAnswers);
      expect(result.quality).toBe('alias');
      expect(result.answerId).toBe('to-3d-fidget');
    }
  });

  it('common animal aliases resolve to Animal', () => {
    for (const guess of ['dog', 'cat', 'dragon', 'dinosaur', 'shark', 'turtle', 'snake', 'axolotl', 'pet', 'animal figure']) {
      const result = matchAnswer(guess, runtimeAnswers);
      expect(result.quality).toBe('alias');
      expect(result.answerId).toBe('to-3d-animal');
    }
  });

  it('key ring resolves to Keychain', () => {
    for (const guess of ['key ring', 'keyring', 'bag tag', 'backpack tag']) {
      const result = matchAnswer(guess, runtimeAnswers);
      expect(result.quality).toBe('alias');
      expect(result.answerId).toBe('to-3d-keychain');
    }
  });

  it('figurine/game piece aliases resolve to Mini Figure / Game Piece', () => {
    for (const guess of ['figurine', 'mini', 'character', 'game piece', 'token', 'miniature']) {
      const result = matchAnswer(guess, runtimeAnswers);
      expect(result.quality).toBe('alias');
      expect(result.answerId).toBe('to-3d-minifig');
    }
  });

  it('name plate/name sign aliases resolve to Name Sign / Name Plate', () => {
    for (const guess of ['name plate', 'nameplate', 'desk sign', 'name sign', 'initials', 'personalized sign']) {
      const result = matchAnswer(guess, runtimeAnswers);
      expect(result.quality).toBe('alias');
      expect(result.answerId).toBe('to-3d-namesign');
    }
  });

  it('canonical answers remain unique (Animal distinct from Mini Figure/Keychain/Name Sign)', () => {
    const texts = board.answers.map((answer) => answer.text.trim().toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('all points are positive', () => {
    for (const answer of board.answers) {
      expect(answer.points).toBeGreaterThan(0);
    }
  });

  it('validates with no errors (including alias-collision warnings across the full edition)', () => {
    const issues = validateGameSet(TRACK_OUT_EDITION);
    const errors = issues.filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('scoringBasis remains classroom-game-weight', () => {
    expect(TRACK_OUT_EDITION.scoringBasis).toBe('classroom-game-weight');
  });
});
