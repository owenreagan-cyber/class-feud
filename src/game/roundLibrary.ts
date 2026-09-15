import type { FeudRound } from './gameTypes';

/**
 * Classroom/demo round library. School-appropriate fictional content, NOT
 * research-backed survey claims. Answers are concise; aliases are present for
 * a future answer-matching phase (not yet used by the engine).
 */
export const ROUND_LIBRARY: FeudRound[] = [
  {
    id: 'round-1',
    title: 'Plant Parts',
    category: 'Science',
    prompt: 'Name something plants need to survive.',
    multiplier: 1,
    answers: [
      { id: 'water', text: 'Water', aliases: ['h2o'], points: 35, revealed: false },
      { id: 'sunlight', text: 'Sunlight', aliases: ['sun', 'light'], points: 30, revealed: false },
      { id: 'air', text: 'Air', aliases: ['oxygen'], points: 20, revealed: false },
      { id: 'nutrients', text: 'Nutrients', aliases: ['minerals', 'fertilizer'], points: 10, revealed: false },
      { id: 'space', text: 'Space', aliases: ['room', 'growing room'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-2',
    title: 'Weather Watch',
    category: 'Science',
    prompt: 'Name a type of weather.',
    multiplier: 2,
    answers: [
      { id: 'rain', text: 'Rain', aliases: ['showers'], points: 35, revealed: false },
      { id: 'snow', text: 'Snow', aliases: ['snowfall'], points: 30, revealed: false },
      { id: 'wind', text: 'Wind', aliases: ['breeze'], points: 20, revealed: false },
      { id: 'hail', text: 'Hail', aliases: ['ice pellets'], points: 10, revealed: false },
      { id: 'fog', text: 'Fog', aliases: ['mist'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-recess',
    title: 'Recess Favorites',
    category: 'Kid Interest',
    prompt: 'Name a favorite recess activity.',
    multiplier: 1,
    answers: [
      { id: 'tag', text: 'Tag', aliases: ['chase'], points: 35, revealed: false },
      { id: 'swinging', text: 'Swinging', aliases: ['swings'], points: 30, revealed: false },
      { id: 'basketball', text: 'Basketball', aliases: ['hoops'], points: 20, revealed: false },
      { id: 'jump-rope', text: 'Jump rope', aliases: ['skipping'], points: 10, revealed: false },
      { id: 'four-square', text: 'Four square', aliases: ['4 square'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-make24',
    title: 'Make 24',
    category: 'Math',
    prompt: 'Name a way to make 24.',
    multiplier: 1,
    answers: [
      { id: '6x4', text: '6 × 4', aliases: ['6 times 4'], points: 35, revealed: false },
      { id: '8x3', text: '8 × 3', aliases: ['8 times 3'], points: 30, revealed: false },
      { id: '12+12', text: '12 + 12', aliases: ['12 plus 12'], points: 20, revealed: false },
      { id: '24x1', text: '24 × 1', aliases: ['24 times 1'], points: 10, revealed: false },
      { id: '30-6', text: '30 − 6', aliases: ['30 minus 6'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-backpack',
    title: 'Backpack Finds',
    category: 'Kid Interest',
    prompt: 'Name something students bring to school.',
    multiplier: 1,
    answers: [
      { id: 'backpack', text: 'Backpack', aliases: ['bag'], points: 35, revealed: false },
      { id: 'pencil', text: 'Pencil', aliases: ['pen'], points: 30, revealed: false },
      { id: 'lunch', text: 'Lunch', aliases: ['lunchbox', 'food'], points: 20, revealed: false },
      { id: 'books', text: 'Books', aliases: ['textbooks'], points: 10, revealed: false },
      { id: 'bottle', text: 'Water bottle', aliases: ['water'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-ela-story',
    title: 'Good Story',
    category: 'ELA',
    prompt: 'Name something a good story needs.',
    multiplier: 3,
    answers: [
      { id: 'characters', text: 'Characters', aliases: ['people'], points: 35, revealed: false },
      { id: 'plot', text: 'Plot', aliases: ['events', 'storyline'], points: 30, revealed: false },
      { id: 'setting', text: 'Setting', aliases: ['place'], points: 20, revealed: false },
      { id: 'problem', text: 'Problem', aliases: ['conflict'], points: 10, revealed: false },
      { id: 'ending', text: 'Ending', aliases: ['resolution'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-math-half',
    title: 'One Half',
    category: 'Math',
    prompt: 'Name a way to represent one-half.',
    multiplier: 1,
    answers: [
      { id: 'one-over-two', text: '1/2', aliases: ['one over two'], points: 35, revealed: false },
      { id: 'point-five', text: '0.5', aliases: ['point five'], points: 30, revealed: false },
      { id: 'fifty-percent', text: '50%', aliases: ['fifty percent'], points: 20, revealed: false },
      { id: 'two-quarters', text: 'Two quarters', aliases: ['2/4'], points: 10, revealed: false },
      { id: 'half-of-whole', text: 'Half of a whole', aliases: ['one of two parts'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-science-water',
    title: 'Water Forms',
    category: 'Science',
    prompt: 'Name a form of water.',
    multiplier: 1,
    answers: [
      { id: 'ice', text: 'Ice', aliases: ['frozen'], points: 35, revealed: false },
      { id: 'liquid', text: 'Liquid water', aliases: ['water'], points: 30, revealed: false },
      { id: 'steam', text: 'Steam', aliases: ['vapor'], points: 20, revealed: false },
      { id: 'snow-water', text: 'Snow', aliases: ['snowflakes'], points: 10, revealed: false },
      { id: 'fog-water', text: 'Fog', aliases: ['mist'], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-ela-punct',
    title: 'Punctuation',
    category: 'ELA',
    prompt: 'Name a type of punctuation.',
    multiplier: 1,
    answers: [
      { id: 'period', text: 'Period', aliases: ['full stop'], points: 35, revealed: false },
      { id: 'comma', text: 'Comma', aliases: ['commas'], points: 30, revealed: false },
      { id: 'question-mark', text: 'Question mark', aliases: ['?'], points: 20, revealed: false },
      { id: 'exclamation', text: 'Exclamation point', aliases: ['!'], points: 10, revealed: false },
      { id: 'apostrophe', text: 'Apostrophe', aliases: ["'"], points: 5, revealed: false },
    ],
  },
  {
    id: 'round-math-shapes',
    title: 'Classroom Shapes',
    category: 'Math',
    prompt: 'Name a shape you see in a classroom.',
    multiplier: 1,
    answers: [
      { id: 'square', text: 'Square', aliases: ['squares'], points: 35, revealed: false },
      { id: 'circle', text: 'Circle', aliases: ['circles'], points: 30, revealed: false },
      { id: 'triangle', text: 'Triangle', aliases: ['triangles'], points: 20, revealed: false },
      { id: 'rectangle', text: 'Rectangle', aliases: ['rectangles'], points: 10, revealed: false },
      { id: 'hexagon', text: 'Hexagon', aliases: ['hexagons'], points: 5, revealed: false },
    ],
  },
];

/** Default selected rounds (order matters). Teacher may edit before starting. */
export const DEFAULT_ROUND_IDS: string[] = [
  'round-1',
  'round-2',
  'round-recess',
  'round-make24',
];
