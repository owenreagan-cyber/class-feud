import type { AnswerDefinition, RoundDefinition, SavedGameSet } from './gameSet';
import type { Multiplier } from '../game/gameTypes';
import type { BrainBlitzAnswer, BrainBlitzConfig, BrainBlitzQuestion } from '../game/brainBlitzTypes';

/**
 * TRACK 1 — TRACK OUT EDITION (built-in Friday game set).
 *
 * Celebratory, fun, 4th-grade-appropriate, school-life focused, fall / break
 * themed. NOT curriculum-heavy. Point values are internal gameplay weights —
 * see `scoringBasis: "classroom-game-weight"` — and are NOT real survey
 * statistics.
 *
 * The default play order is three boards (Locker Life → Recess → Track Out),
 * followed by Brain Blitz. The remaining boards are SPARES the teacher can
 * launch one at a time with "+ EXTRA BOARD".
 */

function a(id: string, text: string, points: number, aliases: string[] = []): AnswerDefinition {
  return { id, text, points, aliases };
}

function board(
  id: string,
  title: string,
  category: string,
  prompt: string,
  answers: AnswerDefinition[],
  multiplier: Multiplier = 1,
): RoundDefinition {
  return { id, title, category, prompt, multiplier, answers };
}

// ------------------------------------------------------------------ boards --

const TRACK_OUT_BOARDS: RoundDefinition[] = [
  // ---- default board 1: Locker Life / School Life ----
  board('to-locker', 'Locker Life', 'School Life', 'Name something students keep in a locker.', [
    a('to-locker-jacket', 'Jacket', 35, ['coat', 'hoodie']),
    a('to-locker-books', 'Books', 30, ['textbooks']),
    a('to-locker-lunch', 'Lunch', 20, ['lunchbox', 'snacks']),
    a('to-locker-backpack', 'Backpack', 10, ['bag']),
    a('to-locker-magnet', 'Magnets', 5, ['locker magnets']),
  ]),

  // ---- default board 2: Recess / Movement ----
  board('to-recess', 'Recess Favorites', 'Recess', 'Name a favorite recess activity.', [
    a('to-recess-tag', 'Tag', 35, ['chase']),
    a('to-recess-swings', 'Swings', 30, ['swinging']),
    a('to-recess-soccer', 'Soccer', 20),
    a('to-recess-basketball', 'Basketball', 10, ['hoops']),
    a('to-recess-slides', 'Slides', 5, ['sliding']),
  ], 2),

  // ---- default board 3: Track Out / Fall ----
  board('to-plans', 'Track Out Plans', 'Track Out', 'Name something kids plan to do over track out.', [
    a('to-plans-sleep', 'Sleep in', 35, ['sleep late', 'rest']),
    a('to-plans-games', 'Video games', 30, ['gaming']),
    a('to-plans-friends', 'See friends', 20, ['hang out', 'play dates']),
    a('to-plans-travel', 'Travel', 10, ['trip', 'road trip']),
    a('to-plans-outside', 'Play outside', 5, ['ride bikes']),
  ], 3),

  // ---- spare boards ----
  board('to-decor', 'Locker Decor', 'Locker Life', 'Name a way to decorate a locker.', [
    a('to-decor-magnets', 'Magnets', 35, ['locker magnets']),
    a('to-decor-photos', 'Photos', 30, ['pictures']),
    a('to-decor-mirror', 'Mirror', 20, ['locker mirror']),
    a('to-decor-shelf', 'Shelf', 10, ['locker shelf']),
    a('to-decor-wrapping', 'Wrapping paper', 5, ['wallpaper']),
  ]),

  board('to-supplies', 'Supply Must-Haves', 'School Life', 'Name a school supply kids can\u2019t do without.', [
    a('to-supplies-pencil', 'Pencil', 35, ['pencils']),
    a('to-supplies-eraser', 'Eraser', 30, ['erasers']),
    a('to-supplies-notebook', 'Notebook', 20, ['notebooks', 'paper']),
    a('to-supplies-glue', 'Glue', 10, ['glue stick']),
    a('to-supplies-scissors', 'Scissors', 5),
  ]),

  board('to-movement', 'Movement Class', 'Movement Class', 'Name something you do in movement class (PE).', [
    a('to-movement-run', 'Run', 35, ['running', 'jog']),
    a('to-movement-soccer', 'Soccer', 30, ['kick a ball']),
    a('to-movement-kickball', 'Kickball', 20),
    a('to-movement-tag', 'Tag', 10, ['chase']),
    a('to-movement-stretch', 'Stretch', 5, ['warm up']),
  ], 2),

  board('to-fall', 'Fall Favorites', 'Fall', 'Name a favorite thing about fall.', [
    a('to-fall-leaves', 'Leaves', 35, ['falling leaves', 'colorful leaves']),
    a('to-fall-hoodies', 'Hoodies', 30, ['sweatshirts']),
    a('to-fall-pumpkins', 'Pumpkins', 20, ['pumpkin patch']),
    a('to-fall-cocoa', 'Hot chocolate', 10, ['cocoa']),
    a('to-fall-football', 'Football', 5),
  ], 2),

  board(
    'to-3dprint',
    '3D Print Favorites',
    'School Life',
    'Name something a 4th grader would think is cool to 3D print.',
    [
      a('to-3d-fidget', 'Fidget Toy', 35, ['fidget', 'spinner', 'clicker', 'fidget spinner', 'fidget cube']),
      a('to-3d-animal', 'Animal', 30, [
        'dog',
        'cat',
        'dragon',
        'dinosaur',
        'shark',
        'turtle',
        'snake',
        'axolotl',
        'pet',
        'animal figure',
      ]),
      a('to-3d-keychain', 'Keychain', 20, ['key ring', 'keyring', 'bag tag', 'backpack tag']),
      a('to-3d-minifig', 'Mini Figure / Game Piece', 10, [
        'figurine',
        'mini',
        'character',
        'game piece',
        'token',
        'miniature',
      ]),
      a('to-3d-namesign', 'Name Sign / Name Plate', 5, [
        'name plate',
        'nameplate',
        'desk sign',
        'name sign',
        'initials',
        'personalized sign',
      ]),
    ],
  ),

  board('to-snacks', 'Snack Time', 'School Life', 'Name a favorite snack.', [
    a('to-snacks-pretzels', 'Pretzels', 35),
    a('to-snacks-fruit', 'Fruit', 30, ['apple', 'grapes']),
    a('to-snacks-crackers', 'Crackers', 20, ['goldfish']),
    a('to-snacks-granola', 'Granola bar', 10),
    a('to-snacks-popcorn', 'Popcorn', 5),
  ]),

  board('to-lazy', 'Lazy Day', 'Track Out', 'Name something you do on a lazy day.', [
    a('to-lazy-tv', 'Watch TV', 35, ['shows', 'movies']),
    a('to-lazy-nap', 'Nap', 30, ['sleep']),
    a('to-lazy-read', 'Read', 20, ['books']),
    a('to-lazy-games', 'Video games', 10, ['gaming']),
    a('to-lazy-snuggle', 'Snuggle up', 5, ['cozy blanket']),
  ], 3),

  board('to-games', 'Video Games', 'Kid Interest', 'Name a type of video game.', [
    a('to-games-racing', 'Racing', 35, ['racing game']),
    a('to-games-sports', 'Sports', 30, ['sports game']),
    a('to-games-puzzle', 'Puzzle', 20, ['puzzle game']),
    a('to-games-building', 'Building', 10, ['sandbox', 'building game']),
    a('to-games-adventure', 'Adventure', 5, ['adventure game']),
  ]),

  board('to-roadtrip', 'Road Trip Fun', 'Track Out', 'Name something fun about a road trip.', [
    a('to-road-snacks', 'Snacks', 35, ['road snacks']),
    a('to-road-music', 'Music', 30, ['songs', 'playlist']),
    a('to-road-games', 'Car games', 20, ['i spy']),
    a('to-road-sights', 'Scenery', 10, ['views', 'sights']),
    a('to-road-rest', 'Rest stops', 5, ['pit stops']),
  ], 3),

  board('to-fallsports', 'Fall Sports', 'Fall', 'Name a fall sport.', [
    a('to-sport-football', 'Football', 35),
    a('to-sport-soccer', 'Soccer', 30),
    a('to-sport-cross', 'Cross country', 20, ['running']),
    a('to-sport-volleyball', 'Volleyball', 10),
    a('to-sport-cheer', 'Cheer', 5, ['cheerleading']),
  ], 2),

  board('to-first', 'First Track of 4th Grade', 'School Life', 'Name the best part of starting 4th grade.', [
    a('to-first-friends', 'Friends', 35, ['classmates']),
    a('to-first-teacher', 'New teacher', 30, ['teacher']),
    a('to-first-recess', 'Recess', 20),
    a('to-first-subjects', 'New subjects', 10, ['new classes']),
    a('to-first-supplies', 'New supplies', 5, ['school supplies']),
  ]),

  board('to-forget', 'Things Students Forget', 'School Life', 'Name something students forget at school.', [
    a('to-forget-pencil', 'Pencil', 35, ['pencils']),
    a('to-forget-homework', 'Homework', 30, ['assignments']),
    a('to-forget-jacket', 'Jacket', 20, ['coat', 'hoodie']),
    a('to-forget-lunch', 'Lunch', 10, ['lunchbox']),
    a('to-forget-bottle', 'Water bottle', 5),
  ]),

  board('to-better', 'Make School Better', 'School Life', 'Name something that makes school better.', [
    a('to-better-friends', 'Friends', 35, ['classmates']),
    a('to-better-recess', 'Recess', 30),
    a('to-better-fun', 'Fun teachers', 20, ['teacher']),
    a('to-better-specials', 'Specials', 10, ['art', 'music', 'PE']),
    a('to-better-snacks', 'Snacks', 5, ['treats']),
  ]),

  board('to-fivemin', 'Five Free Minutes', 'School Life', 'Name something kids do with five free minutes.', [
    a('to-five-chat', 'Chat with friends', 35, ['talk']),
    a('to-five-read', 'Read', 30, ['books']),
    a('to-five-draw', 'Draw', 20, ['doodle']),
    a('to-five-tidy', 'Organize desk', 10, ['clean up']),
    a('to-five-stretch', 'Stretch', 5, ['walk around']),
  ]),

  board('to-dontwant', 'Don\u2019t Want to Hear', 'Track Out', 'Name something you don\u2019t want to hear during track out.', [
    a('to-dw-chores', 'Time for chores', 35, ['chores']),
    a('to-dw-wifi', 'The wifi is down', 30, ['no internet']),
    a('to-dw-homework', 'You have homework', 20, ['break homework']),
    a('to-dw-early', 'Time to wake up early', 10, ['early morning']),
    a('to-dw-over', 'Track out is over', 5, ['back to school']),
  ], 3),
];

// --------------------------------------------------------------- Brain Blitz --

function blitzAnswer(id: string, text: string, points: number, aliases: string[] = []): BrainBlitzAnswer {
  return { id, text, points, aliases };
}

function blitzQuestion(id: string, category: string, prompt: string, answers: BrainBlitzAnswer[]): BrainBlitzQuestion {
  return { id, category, prompt, answers };
}

const TRACK_OUT_BLITZ: BrainBlitzConfig = {
  enabled: true,
  timerSeconds: 30,
  targetScore: 150,
  questions: [
    blitzQuestion('tob-trackout', 'Track Out', 'Name something you want to do over track out.', [
      blitzAnswer('tob-to-sleep', 'Sleep in', 35, ['sleep late']),
      blitzAnswer('tob-to-games', 'Video games', 30, ['gaming']),
      blitzAnswer('tob-to-friends', 'See friends', 20, ['hang out']),
      blitzAnswer('tob-to-travel', 'Travel', 10, ['trip']),
      blitzAnswer('tob-to-outside', 'Play outside', 5),
    ]),
    blitzQuestion('tob-fall', 'Fall', 'Name a favorite fall thing.', [
      blitzAnswer('tob-f-leaves', 'Leaves', 35, ['colorful leaves']),
      blitzAnswer('tob-f-hoodies', 'Hoodies', 30, ['sweatshirts']),
      blitzAnswer('tob-f-pumpkins', 'Pumpkins', 20, ['pumpkin patch']),
      blitzAnswer('tob-f-cocoa', 'Hot chocolate', 10, ['cocoa']),
      blitzAnswer('tob-f-football', 'Football', 5),
    ]),
    blitzQuestion('tob-recess', 'Recess', 'Name a recess activity.', [
      blitzAnswer('tob-r-tag', 'Tag', 35, ['chase']),
      blitzAnswer('tob-r-swings', 'Swings', 30, ['swinging']),
      blitzAnswer('tob-r-soccer', 'Soccer', 20),
      blitzAnswer('tob-r-basketball', 'Basketball', 10, ['hoops']),
      blitzAnswer('tob-r-slides', 'Slides', 5),
    ]),
    blitzQuestion('tob-schoollife', 'School Life', 'Name something that makes school fun.', [
      blitzAnswer('tob-s-recess', 'Recess', 35),
      blitzAnswer('tob-s-friends', 'Friends', 30, ['classmates']),
      blitzAnswer('tob-s-art', 'Art', 20),
      blitzAnswer('tob-s-lunch', 'Lunch', 10),
      blitzAnswer('tob-s-pe', 'PE', 5, ['movement class']),
    ]),
    blitzQuestion('tob-supplies', 'School Supplies', 'Name something in your backpack.', [
      blitzAnswer('tob-b-pencil', 'Pencil', 35, ['pencils']),
      blitzAnswer('tob-b-lunch', 'Lunch', 30, ['lunchbox']),
      blitzAnswer('tob-b-notebook', 'Notebook', 20, ['notebooks']),
      blitzAnswer('tob-b-bottle', 'Water bottle', 10),
      blitzAnswer('tob-b-folders', 'Folders', 5),
    ]),
  ],
};

// ---------------------------------------------------------------------- set --

export const TRACK_OUT_DEFAULT_ROUND_IDS: string[] = ['to-locker', 'to-recess', 'to-plans'];

export const TRACK_OUT_EDITION: SavedGameSet = {
  id: 'builtin-track-out',
  title: 'Track 1 — Track Out Edition',
  description: 'Fall break fun: locker life, recess, and track out plans.',
  source: 'builtin',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
  rounds: TRACK_OUT_BOARDS,
  defaultRoundIds: TRACK_OUT_DEFAULT_ROUND_IDS,
  scoringBasis: 'classroom-game-weight',
  brainBlitz: TRACK_OUT_BLITZ,
};

// ------------------------------------------------------- class rotations --
//
// Four class-specific rotations sharing the same 18-board pool (no content
// duplication: every rotation references the same TRACK_OUT_BOARDS array and
// TRACK_OUT_BLITZ config; only `defaultRoundIds` differs). Each rotation's
// non-default boards remain available to that class via "+ EXTRA BOARD",
// exactly like the original Track Out Edition entry above (which serves as
// Class 1 and is unchanged).

export const TRACK_OUT_CLASS_2_ROUND_IDS: string[] = ['to-3dprint', 'to-movement', 'to-lazy'];
export const TRACK_OUT_CLASS_3_ROUND_IDS: string[] = ['to-supplies', 'to-fall', 'to-roadtrip'];
export const TRACK_OUT_CLASS_4_ROUND_IDS: string[] = ['to-snacks', 'to-fallsports', 'to-dontwant'];

export const TRACK_OUT_CLASS_2: SavedGameSet = {
  id: 'builtin-track-out-class-2',
  title: 'Track Out — Class 2',
  description: '3D print favorites, movement class, and a lazy day.',
  source: 'builtin',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
  rounds: TRACK_OUT_BOARDS,
  defaultRoundIds: TRACK_OUT_CLASS_2_ROUND_IDS,
  scoringBasis: 'classroom-game-weight',
  brainBlitz: TRACK_OUT_BLITZ,
};

export const TRACK_OUT_CLASS_3: SavedGameSet = {
  id: 'builtin-track-out-class-3',
  title: 'Track Out — Class 3',
  description: 'School supplies, fall favorites, and road trip fun.',
  source: 'builtin',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
  rounds: TRACK_OUT_BOARDS,
  defaultRoundIds: TRACK_OUT_CLASS_3_ROUND_IDS,
  scoringBasis: 'classroom-game-weight',
  brainBlitz: TRACK_OUT_BLITZ,
};

export const TRACK_OUT_CLASS_4: SavedGameSet = {
  id: 'builtin-track-out-class-4',
  title: 'Track Out — Class 4',
  description: 'Snack time, fall sports, and things you don’t want to hear.',
  source: 'builtin',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
  rounds: TRACK_OUT_BOARDS,
  defaultRoundIds: TRACK_OUT_CLASS_4_ROUND_IDS,
  scoringBasis: 'classroom-game-weight',
  brainBlitz: TRACK_OUT_BLITZ,
};

/**
 * The six boards shared as + EXTRA BOARD candidates across all four class
 * rotations. Not used as a regular (default) board by any rotation.
 */
export const TRACK_OUT_SPARE_IDS: string[] = [
  'to-decor',
  'to-games',
  'to-first',
  'to-forget',
  'to-better',
  'to-fivemin',
];

/**
 * The four Track Out class-rotation game set ids. All four share the same
 * 18-board pool (`rounds: TRACK_OUT_BOARDS`), so the app must scope each
 * rotation's `roundLibrary` to its own 3 regulars + the 6 shared spares -
 * otherwise every rotation's + EXTRA BOARD would offer all 15 non-default
 * boards, including the other rotations' regular boards.
 */
export const TRACK_OUT_CLASS_SET_IDS: string[] = [
  TRACK_OUT_EDITION.id,
  TRACK_OUT_CLASS_2.id,
  TRACK_OUT_CLASS_3.id,
  TRACK_OUT_CLASS_4.id,
];

/**
 * Scope a game set's round library for + EXTRA BOARD purposes: for a Track
 * Out class rotation, only that rotation's own default boards plus the
 * shared 6-board spare pool; for every other set, all rounds (unchanged
 * behavior). Shared by App.tsx's startGameSet and its tests so the two can't
 * silently diverge.
 */
export function scopeTrackOutRoundLibrary<T extends { id: string }>(
  setId: string,
  defaultIds: string[],
  allRounds: T[],
): T[] {
  if (!TRACK_OUT_CLASS_SET_IDS.includes(setId)) return allRounds;
  return allRounds.filter(
    (round) => defaultIds.includes(round.id) || TRACK_OUT_SPARE_IDS.includes(round.id),
  );
}
