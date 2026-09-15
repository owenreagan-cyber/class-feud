import { describe, expect, it } from 'vitest';
import {
  createHistory,
  createInitialState,
  gameReducer,
  historyReducer,
} from './gameReducer';
import { getRoundValue } from './gameSelectors';
import type { GameState } from './gameTypes';

/** Build a state in the `playing` phase with the given team in control. */
function startPlaying(teamId = 'team-red'): GameState {
  const setup = createInitialState();
  const tossup = gameReducer(setup, { type: 'START_ROUND' });
  return gameReducer(tossup, { type: 'SET_ACTIVE_TEAM', teamId });
}

describe('answer reveal', () => {
  it('does not let a revealed answer score twice', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(state.roundPot).toBe(35);

    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(state.roundPot).toBe(35);
  });

  it('increases the round pot when an answer is revealed', () => {
    const state = startPlaying();
    const next = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'sunlight' });
    expect(next.roundPot).toBe(30);
    expect(next.roundPot).toBeGreaterThan(state.roundPot);
  });

  it('does not immediately change permanent team score on reveal', () => {
    const state = startPlaying();
    const next = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(next.teams.map((team) => team.score)).toEqual([0, 0]);
  });

  it('ignores an invalid answer id safely', () => {
    const state = startPlaying();
    const next = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'not-a-real-id' });
    expect(next).toBe(state);
    expect(next.roundPot).toBe(0);
  });
});

describe('strikes', () => {
  it('caps strikes at 3', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.strikes).toBe(3);

    // A fourth strike cannot be applied (phase is now steal).
    const after = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(after.strikes).toBe(3);
  });

  it('enters the steal phase on the third strike', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.phase).toBe('playing');

    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBe('team-blue');
  });

  it('removing a strike leaves the steal phase and returns to playing', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.phase).toBe('steal');

    state = gameReducer(state, { type: 'REMOVE_STRIKE' });
    expect(state.phase).toBe('playing');
    expect(state.strikes).toBe(2);
  });
});

describe('steal resolution', () => {
  function setupSteal() {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' }); // pot 35
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    return state;
  }

  it('awards the pot to the stealing team on a successful steal', () => {
    const resolved = gameReducer(setupSteal(), { type: 'RESOLVE_STEAL', success: true });
    expect(resolved.phase).toBe('roundOver');
    expect(resolved.teams.find((t) => t.id === 'team-blue')?.score).toBe(35);
    expect(resolved.teams.find((t) => t.id === 'team-red')?.score).toBe(0);
  });

  it('awards the pot to the original controlling team on a failed steal', () => {
    const resolved = gameReducer(setupSteal(), { type: 'RESOLVE_STEAL', success: false });
    expect(resolved.phase).toBe('roundOver');
    expect(resolved.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
    expect(resolved.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
  });
});

describe('round value and award', () => {
  it('applies the round multiplier when awarding', () => {
    let state = startPlaying('team-red');
    state = {
      ...state,
      currentRound: { ...state.currentRound, multiplier: 2 },
    };
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' }); // pot 35
    expect(getRoundValue(state)).toBe(70);

    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(70);
  });

  it('awards the round to the active team by default', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.phase).toBe('roundOver');
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
  });
});

describe('possession', () => {
  it('switches possession between teams during play', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-blue' });
    expect(state.activeTeamId).toBe('team-blue');
    expect(state.phase).toBe('playing');
  });
});

describe('undo and reset', () => {
  it('undo restores the previous state', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(history.present.roundPot).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.roundPot).toBe(0);
    expect(history.present.phase).toBe('playing');
  });

  it('undo is a no-op when there is no history', () => {
    const history = createHistory(startPlaying('team-red'));
    const after = historyReducer(history, { type: 'UNDO' });
    expect(after).toBe(history);
  });

  it('resetting the game restores the expected initial state', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });

    const reset = gameReducer(state, { type: 'RESET_GAME' });
    expect(reset).toEqual(createInitialState());
    expect(reset.phase).toBe('setup');
  });
});
