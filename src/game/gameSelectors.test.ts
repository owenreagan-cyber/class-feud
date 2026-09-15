import { describe, expect, it } from 'vitest';
import { createInitialState } from './gameReducer';
import { getTiedTeams, getWinner } from './gameSelectors';
import type { GameState } from './gameTypes';

function stateWithScores(scores: number[]): GameState {
  const state = createInitialState();
  return {
    ...state,
    teams: scores.map((score, index) => ({
      id: `team-${index}`,
      name: `Team ${index + 1}`,
      color: '#ffffff',
      score,
    })),
  };
}

describe('winner and ties', () => {
  it('returns the single highest-scoring team', () => {
    const state = stateWithScores([30, 70, 50]);
    expect(getWinner(state)?.id).toBe('team-1');
    expect(getTiedTeams(state)).toEqual([]);
  });

  it('returns tied teams on a two-way tie (and no single winner)', () => {
    const state = stateWithScores([70, 70, 50]);
    expect(getWinner(state)).toBeNull();
    expect(getTiedTeams(state).map((team) => team.id)).toEqual(['team-0', 'team-1']);
  });

  it('returns all tied teams deterministically on a multi-team tie', () => {
    const state = stateWithScores([70, 70, 70]);
    const tied = getTiedTeams(state);
    expect(tied.map((team) => team.id)).toEqual(['team-0', 'team-1', 'team-2']);
    expect(getWinner(state)).toBeNull();
  });

  it('returns no winner and no ties when there are fewer than two teams', () => {
    const state = stateWithScores([100]);
    expect(getWinner(state)?.id).toBe('team-0');
    expect(getTiedTeams(state)).toEqual([]);
  });
});
