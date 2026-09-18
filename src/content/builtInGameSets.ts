import { ROUND_LIBRARY } from '../game/roundLibrary';
import { toRoundDefinition } from './gameSet';
import type { RoundDefinition, SavedGameSet } from './gameSet';
import { buildBrainBlitzQuestions } from './brainBlitzLibrary';
import type { BrainBlitzConfig } from '../game/brainBlitzTypes';
import { TRACK_OUT_EDITION, TRACK_OUT_CLASS_2, TRACK_OUT_CLASS_3, TRACK_OUT_CLASS_4 } from './trackOutEdition';

/**
 * Built-in demo game sets. These are read-only and never mutated in place;
 * the teacher duplicates one into an editable custom copy to modify it.
 *
 * Content is fictional classroom demo material, NOT research-backed survey
 * claims.
 */

const ROUND_BY_ID: Map<string, RoundDefinition> = new Map(
  ROUND_LIBRARY.map((round) => [round.id, toRoundDefinition(round)]),
);

function brainBlitz(questionIds: string[], overrides: Partial<BrainBlitzConfig> = {}): BrainBlitzConfig {
  return {
    enabled: true,
    timerSeconds: 30,
    targetScore: 200,
    questions: buildBrainBlitzQuestions(questionIds),
    ...overrides,
  };
}

function buildSet(
  id: string,
  title: string,
  description: string,
  roundIds: string[],
  blitz?: BrainBlitzConfig,
): SavedGameSet {
  const createdAt = '2026-09-16T00:00:00.000Z';
  return {
    id,
    title,
    description,
    source: 'builtin',
    createdAt,
    updatedAt: createdAt,
    // Deep-copy so no built-in set shares answer/alias references with another.
    rounds: roundIds.map((roundId) => {
      const round = ROUND_BY_ID.get(roundId);
      if (!round) throw new Error(`built-in round missing: ${roundId}`);
      return {
        ...round,
        answers: round.answers.map((answer) => ({ ...answer, aliases: [...answer.aliases] })),
      };
    }),
    brainBlitz: blitz,
  };
}

export const BUILT_IN_GAME_SETS: SavedGameSet[] = [
  buildSet(
    'builtin-mixed',
    'Mixed Classroom Demo',
    'A little of everything: science, recess, and math.',
    ['round-1', 'round-2', 'round-recess', 'round-make24'],
    brainBlitz([
      'bb-math-multiple-6',
      'bb-sci-plant',
      'bb-ela-punct',
      'bb-kid-recess',
      'bb-kid-backpack',
    ]),
  ),
  buildSet(
    'builtin-science',
    'Science Review Demo',
    'Plant needs, weather, and water.',
    ['round-1', 'round-2', 'round-science-water'],
    brainBlitz(['bb-sci-plant', 'bb-sci-matter', 'bb-sci-weather', 'bb-sci-planet', 'bb-sci-float']),
  ),
  buildSet(
    'builtin-math',
    'Math Review Demo',
    'Make 24, one-half, and classroom shapes.',
    ['round-make24', 'round-math-half', 'round-math-shapes'],
    brainBlitz(['bb-math-multiple-6', 'bb-math-shapes', 'bb-math-half', 'bb-math-even', 'bb-math-unit']),
  ),
  buildSet(
    'builtin-ela',
    'ELA Review Demo',
    'Story elements and punctuation.',
    ['round-ela-story', 'round-ela-punct'],
    brainBlitz(['bb-ela-punct', 'bb-ela-speech', 'bb-ela-story', 'bb-ela-book', 'bb-ela-vowel']),
  ),
  buildSet(
    'builtin-kids',
    'Kid Interest Demo',
    'Recess and backpack favorites.',
    ['round-recess', 'round-backpack'],
    brainBlitz(['bb-kid-recess', 'bb-kid-backpack', 'bb-kid-pizza', 'bb-kid-party', 'bb-kid-subject']),
  ),
  // Track Out Edition is a fully authored standalone set (own rounds + blitz).
  // It serves as Class 1; Classes 2-4 are sibling rotations sharing the same
  // 18-board pool and Brain Blitz config, differing only in defaultRoundIds.
  TRACK_OUT_EDITION,
  TRACK_OUT_CLASS_2,
  TRACK_OUT_CLASS_3,
  TRACK_OUT_CLASS_4,
];

export function getBuiltInGameSet(id: string): SavedGameSet | undefined {
  return BUILT_IN_GAME_SETS.find((set) => set.id === id);
}
