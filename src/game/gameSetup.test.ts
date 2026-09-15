import { describe, expect, it } from 'vitest';
import {
  createHistory,
  createInitialState,
  gameReducer,
  historyReducer,
} from './gameReducer';
import type { HistoryState } from './gameReducer';
import { getCurrentRound, getRoundValue } from './gameSelectors';
import { DEFAULT_ROUND_IDS } from './roundLibrary';
import type { GameState, Multiplier } from './gameTypes';

function startGame(): GameState {
  return gameReducer(createInitialState(), { type: 'START_GAME' });
}

function startPlaying(teamId = 'team-red'): GameState {
  return gameReducer(startGame(), { type: 'SET_ACTIVE_TEAM', teamId });
}

function addThreeStrikesHistory(history: HistoryState): HistoryState {
  let next = history;
  next = historyReducer(next, { type: 'ADD_STRIKE' });
  next = historyReducer(next, { type: 'ADD_STRIKE' });
  next = historyReducer(next, { type: 'ADD_STRIKE' });
  return next;
}

/** Start a game with the given multiplier on round-1, control red, reveal water. */
function awardWithMultiplier(multiplier: Multiplier): number {
  let state = createInitialState();
  state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier });
  state = gameReducer(state, { type: 'START_GAME' });
  state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
  expect(getRoundValue(state)).toBe(35 * multiplier);
  state = gameReducer(state, { type: 'AWARD_ROUND' });
  return state.teams.find((team) => team.id === 'team-red')!.score;
}

describe('team setup', () => {
  it('default setup contains 2 teams', () => {
    expect(createInitialState().teams).toHaveLength(2);
  });

  it('add team creates a stable unique ID', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    expect(state.teams).toHaveLength(3);
    const third = state.teams[2];
    expect(third.id).toBeTruthy();
    expect(state.teams[0].id).not.toBe(third.id);
    expect(state.teams[1].id).not.toBe(third.id);

    // The ID is stable across unrelated actions.
    const after = gameReducer(state, { type: 'RENAME_TEAM', teamId: third.id, name: 'Rockets' });
    expect(after.teams[2].id).toBe(third.id);
  });

  it('remove team preserves remaining team IDs', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    const before = state.teams.map((team) => team.id);
    const removedId = before[1];
    state = gameReducer(state, { type: 'REMOVE_TEAM', teamId: removedId });
    expect(state.teams.map((team) => team.id)).toEqual(
      before.filter((id) => id !== removedId),
    );
  });

  it('cannot remove below 2 teams', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' }); // 3 teams
    state = gameReducer(state, { type: 'REMOVE_TEAM', teamId: 'team-1' }); // 2 teams
    expect(state.teams).toHaveLength(2);

    const blocked = gameReducer(state, { type: 'REMOVE_TEAM', teamId: 'team-red' });
    expect(blocked).toBe(state); // no-op at the floor
  });

  it('respects a max of 4 teams', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    state = gameReducer(state, { type: 'ADD_TEAM' });
    expect(state.teams).toHaveLength(4);

    const blocked = gameReducer(state, { type: 'ADD_TEAM' });
    expect(blocked).toBe(state);
  });

  it('rename preserves team ID', () => {
    const state = createInitialState();
    const renamed = gameReducer(state, { type: 'RENAME_TEAM', teamId: 'team-red', name: 'Lions' });
    expect(renamed.teams[0].name).toBe('Lions');
    expect(renamed.teams[0].id).toBe('team-red');
  });

  it('rejects structural team changes after game start', () => {
    const started = startGame();
    expect(gameReducer(started, { type: 'ADD_TEAM' })).toBe(started);
    expect(gameReducer(started, { type: 'REMOVE_TEAM', teamId: 'team-red' })).toBe(started);
    expect(
      gameReducer(started, { type: 'REORDER_TEAMS', teamIds: ['team-blue', 'team-red'] }),
    ).toBe(started);
    expect(gameReducer(started, { type: 'RENAME_TEAM', teamId: 'team-red', name: 'X' })).toBe(
      started,
    );
    expect(
      gameReducer(started, { type: 'SET_TEAM_COLOR', teamId: 'team-red', color: '#ffffff' }),
    ).toBe(started);
  });
});

describe('round setup', () => {
  it('honors the selected round order', () => {
    const state = createInitialState();
    expect(state.rounds.map((round) => round.id)).toEqual(DEFAULT_ROUND_IDS);

    const started = gameReducer(state, { type: 'START_GAME' });
    expect(getCurrentRound(started).id).toBe(DEFAULT_ROUND_IDS[0]);
  });

  it('excluded round does not appear in the game queue', () => {
    let state = createInitialState();
    const firstId = state.rounds[0].id;
    state = gameReducer(state, { type: 'TOGGLE_ROUND', roundId: firstId });
    expect(state.rounds.some((round) => round.id === firstId)).toBe(false);

    const started = gameReducer(state, { type: 'START_GAME' });
    expect(started.rounds.some((round) => round.id === firstId)).toBe(false);
  });

  it('reorder persists into the game', () => {
    let state = createInitialState();
    const ids = state.rounds.map((round) => round.id);
    const reordered = [ids[1], ids[0], ...ids.slice(2)];
    state = gameReducer(state, { type: 'REORDER_ROUNDS', roundIds: reordered });
    expect(state.rounds.map((round) => round.id)).toEqual(reordered);

    const started = gameReducer(state, { type: 'START_GAME' });
    expect(getCurrentRound(started).id).toBe(reordered[0]);
  });

  it('multiplier can be changed during setup', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier: 2 });
    expect(state.rounds.find((round) => round.id === 'round-1')?.multiplier).toBe(2);
  });

  it('supports 1x, 2x, and 3x multipliers only', () => {
    let state = createInitialState();
    for (const multiplier of [1, 2, 3] as const) {
      state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier });
      expect(state.rounds.find((round) => round.id === 'round-1')?.multiplier).toBe(multiplier);
    }
  });
});

describe('possession', () => {
  it('switches control between two teams during play', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-blue' });
    expect(state.activeTeamId).toBe('team-blue');
    expect(state.phase).toBe('playing');
  });

  it('3-team teacher-selected possession works', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' }); // 3 teams
    state = gameReducer(state, { type: 'START_GAME' });
    const firstId = state.teams[0].id;
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: firstId });
    const thirdId = state.teams[2].id;
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: thirdId });
    expect(state.activeTeamId).toBe(thirdId);
    expect(state.phase).toBe('playing');
  });

  it('rejects an invalid active-team ID', () => {
    const tossup = startGame();
    expect(gameReducer(tossup, { type: 'SET_ACTIVE_TEAM', teamId: 'nope' })).toBe(tossup);
  });
});

describe('steal', () => {
  it('2-team steal auto-selects the opponent', () => {
    const state = gameReducer(startPlaying('team-red'), { type: 'START_STEAL' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBe('team-blue');
  });

  it('3-team steal requires teacher selection', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: state.teams[0].id });
    state = gameReducer(state, { type: 'START_STEAL' });
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBeNull();
  });

  it('active team cannot be selected as the stealing team', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: state.teams[0].id });
    state = gameReducer(state, { type: 'START_STEAL' });
    const activeId = state.activeTeamId!;
    expect(gameReducer(state, { type: 'SET_STEAL_TEAM', teamId: activeId }).stealTeamId).toBeNull();
  });

  it('rejects an invalid stealing team', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'ADD_TEAM' });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: state.teams[0].id });
    state = gameReducer(state, { type: 'START_STEAL' });
    expect(gameReducer(state, { type: 'SET_STEAL_TEAM', teamId: 'nope' })).toBe(state);
  });
});

describe('round flow', () => {
  it('next round loads the correct configured round', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    const expectedNext = state.rounds[1];
    state = gameReducer(state, { type: 'NEXT_ROUND' });
    expect(getCurrentRound(state).id).toBe(expectedNext.id);
  });

  it('next round resets round-local state', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = gameReducer(state, { type: 'ADD_STRIKE' });
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    state = gameReducer(state, { type: 'NEXT_ROUND' });

    expect(state.roundPot).toBe(0);
    expect(state.strikes).toBe(0);
    expect(state.activeTeamId).toBeNull();
    expect(state.stealTeamId).toBeNull();
    expect(getCurrentRound(state).answers.every((answer) => !answer.revealed)).toBe(true);
  });

  it('cumulative team score persists across rounds', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' }); // pot 35
    state = gameReducer(state, { type: 'AWARD_ROUND' });
    expect(state.teams.find((team) => team.id === 'team-red')?.score).toBe(35);

    state = gameReducer(state, { type: 'NEXT_ROUND' });
    expect(state.teams.find((team) => team.id === 'team-red')?.score).toBe(35);
  });
});

describe('multipliers', () => {
  it('1x multiplier applies once', () => {
    expect(awardWithMultiplier(1)).toBe(35);
  });

  it('2x multiplier applies once', () => {
    expect(awardWithMultiplier(2)).toBe(70);
  });

  it('3x multiplier applies once', () => {
    expect(awardWithMultiplier(3)).toBe(105);
  });

  it('reveal does not multiply answer points (value derived at award time)', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier: 3 });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });

    expect(state.roundPot).toBe(35); // raw, unmultiplied
    expect(getRoundValue(state)).toBe(105); // derived at calculation time
    expect(state.teams.find((team) => team.id === 'team-red')?.score).toBe(0);
  });
});

describe('undo', () => {
  it('undo reveal', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(history.present.roundPot).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.roundPot).toBe(0);
    expect(getCurrentRound(history.present).answers.find((a) => a.id === 'water')?.revealed).toBe(
      false,
    );
  });

  it('undo strike', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    expect(history.present.strikes).toBe(1);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.strikes).toBe(0);
  });

  it('undo third-strike transition', () => {
    let history = createHistory(startPlaying('team-red'));
    history = addThreeStrikesHistory(history);
    expect(history.present.phase).toBe('steal');
    expect(history.present.strikes).toBe(3);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.phase).toBe('playing');
    expect(history.present.strikes).toBe(2);
    expect(history.present.stealTeamId).toBeNull();
  });

  it('undo successful steal', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    history = addThreeStrikesHistory(history);
    history = historyReducer(history, { type: 'RESOLVE_STEAL', success: true });
    expect(history.present.phase).toBe('roundOver');
    expect(history.present.teams.find((t) => t.id === 'team-blue')?.score).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.phase).toBe('steal');
    expect(history.present.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
  });

  it('undo failed steal', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    history = addThreeStrikesHistory(history);
    history = historyReducer(history, { type: 'RESOLVE_STEAL', success: false });
    expect(history.present.teams.find((t) => t.id === 'team-red')?.score).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.phase).toBe('steal');
    expect(history.present.teams.find((t) => t.id === 'team-red')?.score).toBe(0);
  });

  it('undo next round restores the previous round exactly', () => {
    let history = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    history = historyReducer(history, { type: 'AWARD_ROUND' });
    const beforeNext = history.present;

    history = historyReducer(history, { type: 'NEXT_ROUND' });
    expect(history.present.currentRoundIndex).toBe(1);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present).toEqual(beforeNext);
    expect(history.present.currentRoundIndex).toBe(0);
    expect(history.present.phase).toBe('roundOver');
  });

  it('undo final-round gameOver transition restores prior state', () => {
    let history = createHistory(startPlaying('team-red'));
    const roundCount = history.present.rounds.length;
    for (let index = 0; index < roundCount; index += 1) {
      history = historyReducer(history, { type: 'AWARD_ROUND' });
      if (index < roundCount - 1) {
        history = historyReducer(history, { type: 'NEXT_ROUND' });
        history = historyReducer(history, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
      }
    }
    const beforeGameOver = history.present;

    history = historyReducer(history, { type: 'NEXT_ROUND' });
    expect(history.present.phase).toBe('gameOver');

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present).toEqual(beforeGameOver);
    expect(history.present.phase).toBe('roundOver');
  });
});
