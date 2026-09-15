import { describe, expect, it } from 'vitest';
import {
  createHistory,
  createInitialState,
  gameReducer,
  historyReducer,
} from './gameReducer';
import { getCurrentRound, getRoundValue } from './gameSelectors';
import type { GameState } from './gameTypes';

function startGame(): GameState {
  return gameReducer(createInitialState(), { type: 'START_GAME' });
}

function startPlaying(teamId = 'team-red'): GameState {
  return gameReducer(startGame(), { type: 'SET_ACTIVE_TEAM', teamId });
}

function addThreeStrikes(state: GameState): GameState {
  let next = state;
  next = gameReducer(next, { type: 'ADD_STRIKE' });
  next = gameReducer(next, { type: 'ADD_STRIKE' });
  next = gameReducer(next, { type: 'ADD_STRIKE' });
  return next;
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

  it('ignores reveal outside the playing phase', () => {
    const tossup = startGame();
    const revealed = gameReducer(tossup, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(revealed).toBe(tossup);
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

  it('enters the steal phase on the third strike with an auto-selected opponent', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.phase).toBe('playing');

    state = gameReducer(state, { type: 'ADD_STRIKE' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBe('team-blue');
  });

  it('removing a strike from the steal phase returns to playing', () => {
    let state = addThreeStrikes(startPlaying());
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
    return addThreeStrikes(state);
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

  it('does not resolve a steal with no stealing team selected', () => {
    const setup = createInitialState();
    const threeTeams = gameReducer(setup, {
      type: 'UPDATE_TEAMS',
      teams: [
        ...setup.teams,
        { id: 'team-green', name: 'Green Team', color: '#22c55e', score: 0 },
      ],
    });
    let state = gameReducer(threeTeams, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = addThreeStrikes(state);
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBeNull();

    const resolved = gameReducer(state, { type: 'RESOLVE_STEAL', success: true });
    expect(resolved).toBe(state);
  });
});

describe('steal team selection', () => {
  it('auto-selects the opponent for a two-team game on a forced steal', () => {
    const state = gameReducer(startPlaying('team-red'), { type: 'START_STEAL' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBe('team-blue');
  });

  it('requires teacher selection when three or more teams exist', () => {
    const setup = createInitialState();
    const threeTeams = gameReducer(setup, {
      type: 'UPDATE_TEAMS',
      teams: [
        ...setup.teams,
        { id: 'team-green', name: 'Green Team', color: '#22c55e', score: 0 },
      ],
    });
    let state = gameReducer(threeTeams, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'START_STEAL' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBeNull();

    state = gameReducer(state, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    expect(state.stealTeamId).toBe('team-blue');
  });

  it('rejects setting the active team, unknown teams, or a non-steal phase', () => {
    const steal = gameReducer(startPlaying('team-red'), { type: 'START_STEAL' });
    expect(steal.stealTeamId).toBe('team-blue');

    expect(
      gameReducer(steal, { type: 'SET_STEAL_TEAM', teamId: 'team-red' }).stealTeamId,
    ).toBe('team-blue');
    expect(
      gameReducer(steal, { type: 'SET_STEAL_TEAM', teamId: 'nope' }).stealTeamId,
    ).toBe('team-blue');

    const playing = startPlaying('team-red');
    expect(gameReducer(playing, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' })).toBe(
      playing,
    );
  });
});

describe('round value and award', () => {
  it('applies the round multiplier when awarding', () => {
    let state = startPlaying('team-red');
    state = {
      ...state,
      rounds: state.rounds.map((round, index) =>
        index === state.currentRoundIndex ? { ...round, multiplier: 2 } : round,
      ),
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

describe('round progression', () => {
  it('advances to the next round, resets per-round state, and preserves scores', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.currentRoundIndex).toBe(0);
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(35);

    state = gameReducer(state, { type: 'NEXT_ROUND' });
    expect(state.currentRoundIndex).toBe(1);
    expect(state.phase).toBe('tossup');
    expect(state.roundPot).toBe(0);
    expect(state.strikes).toBe(0);
    expect(state.activeTeamId).toBeNull();
    expect(state.stealTeamId).toBeNull();
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
    expect(getCurrentRound(state).id).toBe('round-2');
    expect(getCurrentRound(state).multiplier).toBe(2);
  });

  it('ends the game after the last round', () => {
    let state = startPlaying('team-red');
    // Play through all three rounds.
    for (let index = 0; index < 3; index += 1) {
      state = gameReducer(state, { type: 'AWARD_ROUND' });
      if (index < 2) {
        state = gameReducer(state, { type: 'NEXT_ROUND' });
        state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
      }
    }
    state = gameReducer(state, { type: 'NEXT_ROUND' });
    expect(state.phase).toBe('gameOver');
  });

  it('locks team structure after the game has started', () => {
    const setup = createInitialState();
    const started = startGame();
    const renamed = gameReducer(started, {
      type: 'UPDATE_TEAMS',
      teams: [
        { id: 'team-red', name: 'Hackers', color: '#000000', score: 0 },
        setup.teams[1],
      ],
    });
    expect(renamed).toBe(started);
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
    expect(historyReducer(history, { type: 'UNDO' })).toBe(history);
  });

  it('undo restores full state after a steal resolution', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    const beforeResolve = history.present;

    history = historyReducer(history, { type: 'RESOLVE_STEAL', success: true });
    expect(history.present.phase).toBe('roundOver');
    expect(history.present.teams.find((t) => t.id === 'team-blue')?.score).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present).toEqual(beforeResolve);
    expect(history.present.phase).toBe('steal');
    expect(history.present.roundPot).toBe(35);
    expect(history.present.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
    expect(
      getCurrentRound(history.present).answers.find((a) => a.id === 'water')?.revealed,
    ).toBe(true);
  });

  it('undo restores playing phase and clears steal team after the third strike', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    const beforeThird = history.present;

    history = historyReducer(history, { type: 'ADD_STRIKE' });
    expect(history.present.phase).toBe('steal');
    expect(history.present.strikes).toBe(3);
    expect(history.present.stealTeamId).toBe('team-blue');

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present).toEqual(beforeThird);
    expect(history.present.phase).toBe('playing');
    expect(history.present.strikes).toBe(2);
    expect(history.present.stealTeamId).toBeNull();
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
