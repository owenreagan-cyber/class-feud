import { describe, expect, it } from 'vitest';
import { matchAnswer } from './answerMatcher';
import { createHistory, createInitialState, gameReducer, historyReducer } from './gameReducer';
import type { HistoryState } from './gameReducer';
import { getCurrentRound } from './gameSelectors';
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

/** Mimic the teacher keyboard shortcut: reveal the answer at a 1-based slot. */
function revealSlot(state: GameState, slotNumber: number): GameState {
  const answer = getCurrentRound(state).answers[slotNumber - 1];
  return answer ? gameReducer(state, { type: 'REVEAL_ANSWER', answerId: answer.id }) : state;
}

describe('matcher + reducer integration', () => {
  it('confirm matched reveal updates round pot once', () => {
    const state = startPlaying();
    const match = matchAnswer('water', getCurrentRound(state).answers);
    expect(match.answerId).toBe('water');

    const next = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    expect(next.roundPot).toBe(35);
  });

  it('repeated matched reveal cannot score twice', () => {
    let state = startPlaying();
    const match = matchAnswer('water', getCurrentRound(state).answers);
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    expect(state.roundPot).toBe(35);

    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    expect(state.roundPot).toBe(35);
  });

  it('successful steal matched answer contributes once', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' }); // pot 35
    state = addThreeStrikes(state);
    expect(state.phase).toBe('steal');
    expect(state.stealTeamId).toBe('team-blue');

    const match = matchAnswer('sun', getCurrentRound(state).answers);
    expect(match.answerId).toBe('sunlight');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    expect(state.roundPot).toBe(65); // 35 + 30, once

    state = gameReducer(state, { type: 'RESOLVE_STEAL', success: true });
    expect(state.phase).toBe('roundOver');
    expect(state.teams.find((t) => t.id === 'team-blue')?.score).toBe(65);
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(0);
  });

  it('successful steal then awards correct multiplied pot', () => {
    let state = createInitialState();
    state = gameReducer(state, { type: 'SET_ROUND_MULTIPLIER', roundId: 'round-1', multiplier: 3 });
    state = gameReducer(state, { type: 'START_GAME' });
    state = gameReducer(state, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' }); // pot 35
    state = addThreeStrikes(state);

    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'sunlight' }); // pot 65
    state = gameReducer(state, { type: 'RESOLVE_STEAL', success: true });
    expect(state.teams.find((t) => t.id === 'team-blue')?.score).toBe(195); // 65 * 3
  });

  it('failed steal does not reveal an unmatched answer', () => {
    let state = startPlaying('team-red');
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    state = addThreeStrikes(state);

    state = gameReducer(state, { type: 'RESOLVE_STEAL', success: false });
    expect(state.phase).toBe('roundOver');
    expect(state.teams.find((t) => t.id === 'team-red')?.score).toBe(35);
    expect(state.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
    // Only the originally revealed answer is on the board.
    expect(getCurrentRound(state).answers.filter((a) => a.revealed).map((a) => a.id)).toEqual([
      'water',
    ]);
  });

  it('manual reveal still works independently of the matcher', () => {
    const state = startPlaying();
    const next = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'sunlight' });
    expect(next.roundPot).toBe(30);
  });

  it('Undo after matched reveal restores answer and pot', () => {
    let history: HistoryState = createHistory(startPlaying('team-red'));
    const match = matchAnswer('water', getCurrentRound(history.present).answers);
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    expect(history.present.roundPot).toBe(35);

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.roundPot).toBe(0);
    expect(
      getCurrentRound(history.present).answers.find((a) => a.id === 'water')?.revealed,
    ).toBe(false);
  });

  it('Undo after matched steal resolution restores prior steal state', () => {
    let history: HistoryState = createHistory(startPlaying('team-red'));
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: 'water' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    history = historyReducer(history, { type: 'ADD_STRIKE' });
    expect(history.present.phase).toBe('steal');

    const match = matchAnswer('sun', getCurrentRound(history.present).answers);
    history = historyReducer(history, { type: 'REVEAL_ANSWER', answerId: match.answerId! });
    history = historyReducer(history, { type: 'RESOLVE_STEAL', success: true });
    expect(history.present.phase).toBe('roundOver');

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.phase).toBe('steal');
    expect(history.present.roundPot).toBe(65);
    expect(getCurrentRound(history.present).answers.find((a) => a.id === 'sunlight')?.revealed).toBe(
      true,
    );

    history = historyReducer(history, { type: 'UNDO' });
    expect(history.present.phase).toBe('steal');
    expect(history.present.roundPot).toBe(35);
    expect(getCurrentRound(history.present).answers.find((a) => a.id === 'sunlight')?.revealed).toBe(
      false,
    );
    expect(history.present.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
  });

  it('keyboard-triggered reveal uses the same reducer path', () => {
    const state = startPlaying();
    const slotOne = revealSlot(state, 1);
    expect(slotOne.roundPot).toBe(35);

    const slotTwo = revealSlot(state, 2);
    expect(slotTwo.roundPot).toBe(30);
    expect(getCurrentRound(slotTwo).answers[1].id).toBe('sunlight');

    // Out-of-range slots are a safe no-op.
    expect(revealSlot(state, 9)).toBe(state);
  });

  it('already-revealed answer does not mutate game state', () => {
    let state = startPlaying();
    state = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    const repeated = gameReducer(state, { type: 'REVEAL_ANSWER', answerId: 'water' });
    expect(repeated).toBe(state);
  });

  it('no-match evaluation alone does not mutate game state', () => {
    const state = startPlaying();
    const before = JSON.stringify(state);
    const match = matchAnswer('zzzzzz', getCurrentRound(state).answers);
    expect(match.quality).toBe('none');
    // The matcher is advisory only; no reducer action was dispatched.
    expect(JSON.stringify(state)).toBe(before);
  });
});
