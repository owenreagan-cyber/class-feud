import type { FeudRound, Team } from './gameTypes';

export const DEFAULT_TEAMS: Team[] = [
  { id: 'team-red', name: 'Red Team', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue Team', color: '#3b82f6', score: 0 },
];

export const SAMPLE_ROUND: FeudRound = {
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
};
