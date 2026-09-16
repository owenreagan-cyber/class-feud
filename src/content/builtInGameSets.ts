import { ROUND_LIBRARY } from '../game/roundLibrary';
import { toRoundDefinition } from './gameSet';
import type { RoundDefinition, SavedGameSet } from './gameSet';

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

function buildSet(
  id: string,
  title: string,
  description: string,
  roundIds: string[],
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
  };
}

export const BUILT_IN_GAME_SETS: SavedGameSet[] = [
  buildSet(
    'builtin-mixed',
    'Mixed Classroom Demo',
    'A little of everything: science, recess, and math.',
    ['round-1', 'round-2', 'round-recess', 'round-make24'],
  ),
  buildSet(
    'builtin-science',
    'Science Review Demo',
    'Plant needs, weather, and water.',
    ['round-1', 'round-2', 'round-science-water'],
  ),
  buildSet(
    'builtin-math',
    'Math Review Demo',
    'Make 24, one-half, and classroom shapes.',
    ['round-make24', 'round-math-half', 'round-math-shapes'],
  ),
  buildSet(
    'builtin-ela',
    'ELA Review Demo',
    'Story elements and punctuation.',
    ['round-ela-story', 'round-ela-punct'],
  ),
  buildSet(
    'builtin-kids',
    'Kid Interest Demo',
    'Recess and backpack favorites.',
    ['round-recess', 'round-backpack'],
  ),
];

export function getBuiltInGameSet(id: string): SavedGameSet | undefined {
  return BUILT_IN_GAME_SETS.find((set) => set.id === id);
}
