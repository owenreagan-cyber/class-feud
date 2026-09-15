import type { FeudRound, Team } from './gameTypes';

export const DEFAULT_TEAMS: Team[] = [
  { id: 'team-red', name: 'Red Team', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue Team', color: '#3b82f6', score: 0 },
];

export const SAMPLE_ROUNDS: FeudRound[] = [
  {
    id: 'round-1',
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
    id: 'round-3',
    category: 'School',
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
];
