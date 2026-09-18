import { describe, expect, it } from 'vitest';
import { createInitialState, createHistory, gameReducer, historyReducer } from './gameReducer';
import { getEligibleStealTeams } from './gameSelectors';
import type { FeudAnswer, FeudRound, GameState, Team } from './gameTypes';
import type { BrainBlitzConfig } from './brainBlitzTypes';
import { loadPersistedState, savePersistedState, STORAGE_KEY } from './gamePersistence';

const ANSWER: FeudAnswer = { id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false };

function makeRound(id: string, points = 35): FeudRound {
  return {
    id,
    title: `Board ${id}`,
    category: 'Science',
    prompt: 'Name a plant part.',
    multiplier: 1,
    answers: [{ ...ANSWER, id: `${id}-a1`, points }],
  };
}

const FOUR: Team[] = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
  { id: 'team-green', name: 'Green', color: '#22c55e', score: 0 },
  { id: 'team-gold', name: 'Gold', color: '#eab308', score: 0 },
];

const TWO: Team[] = [
  { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
];

function blitzConfig(): BrainBlitzConfig {
  return {
    enabled: true,
    timerSeconds: 30,
    targetScore: 200,
    questions: [
      {
        id: 'q1',
        prompt: 'Name a punctuation mark.',
        category: 'ELA',
        answers: [
          { id: 'a1', text: 'Period', aliases: ['full stop'], points: 35 },
          { id: 'a2', text: 'Comma', aliases: [], points: 25 },
        ],
      },
      {
        id: 'q2',
        prompt: 'Name a color.',
        answers: [
          { id: 'b1', text: 'Red', aliases: [], points: 30 },
        ],
      },
    ],
  };
}

function loadGame(teams: Team[], rounds: FeudRound[], library?: FeudRound[]): GameState {
  let s = createInitialState();
  s = gameReducer(s, {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: library ?? rounds,
    rounds,
    brainBlitzConfig: blitzConfig(),
  });
  s = gameReducer(s, { type: 'UPDATE_TEAMS', teams });
  return s;
}

function start(teams: Team[] = FOUR, rounds: FeudRound[] = [makeRound('b1')]): GameState {
  return gameReducer(loadGame(teams, rounds), { type: 'START_GAME' });
}

function controlRed(s: GameState): GameState {
  return gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
}

describe('AUDIT 3/6 — zero eligible steal teams must not deadlock', () => {
  it('two teams: opponent no-answers, active team reaches 3 strikes → round resolves, not stuck', () => {
    // Red controls; Blue (only opponent) pressed and no-answered during face-off.
    let s = controlRed(start(TWO));
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-blue' });
    expect(getEligibleStealTeams(s)).toEqual([]);
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' }); // 3rd strike → would enter steal
    // Must NOT be stuck in `steal` with no selectable team.
    expect(s.phase).not.toBe('steal');
    // The controlling team keeps the round (no one can steal).
    expect(s.phase).toBe('roundOver');
    expect(s.roundWinnerId).toBe('team-red');
  });

  it('four teams: three opponents all no-answer → round resolves, not stuck', () => {
    let s = controlRed(start(FOUR));
    for (const id of ['team-blue', 'team-green', 'team-gold']) {
      s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: id });
    }
    expect(getEligibleStealTeams(s)).toEqual([]);
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    expect(s.phase).toBe('roundOver');
    expect(s.roundWinnerId).toBe('team-red');
  });

  it('one eligible opponent still auto-selects and can steal', () => {
    let s = controlRed(start(FOUR));
    for (const id of ['team-blue', 'team-green']) s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: id });
    expect(getEligibleStealTeams(s).map((t) => t.id)).toEqual(['team-gold']);
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    expect(s.phase).toBe('steal');
    expect(s.stealTeamId).toBe('team-gold');
  });
});

describe('AUDIT 2 — no-answer idempotence and undo', () => {
  it('marking the same team twice is a no-op', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    const again = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(again).toBe(s);
    expect(s.noAnswerTeamIds).toEqual(['team-green']);
  });

  it('clearing a non-marked team is a no-op', () => {
    const s = controlRed(start());
    expect(gameReducer(s, { type: 'CLEAR_NO_ANSWER', teamId: 'team-green' })).toBe(s);
  });

  it('undo reverts a no-answer mark', () => {
    let h = createHistory(controlRed(start()));
    h = historyReducer(h, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(h.present.noAnswerTeamIds).toContain('team-green');
    h = historyReducer(h, { type: 'UNDO' });
    expect(h.present.noAnswerTeamIds).toEqual([]);
  });

  it('no-answer does not apply during steal phase resolution of a different team', () => {
    // Marking during steal is harmless; eligibility was already computed.
    let s = controlRed(start());
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' }); // steal, 3 eligible
    s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    const before = s.noAnswerTeamIds.length;
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(s.noAnswerTeamIds.length).toBe(before + 1);
  });
});

describe('AUDIT 6 — score integrity', () => {
  it('revealing the same answer twice does not double the pot', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    expect(s.roundPot).toBe(35);
    const again = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    expect(again).toBe(s);
    expect(again.roundPot).toBe(35);
  });

  it('award then undo then award yields single award (no double count)', () => {
    let h = createHistory(controlRed(start()));
    h = historyReducer(h, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    h = historyReducer(h, { type: 'AWARD_ROUND' });
    expect(h.present.teams[0].score).toBe(35);
    h = historyReducer(h, { type: 'UNDO' });
    expect(h.present.teams[0].score).toBe(0);
    expect(h.present.phase).toBe('playing');
    h = historyReducer(h, { type: 'AWARD_ROUND' });
    expect(h.present.teams[0].score).toBe(35);
  });

  it('steal success twice is ignored (phase guard)', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    s = gameReducer(s, { type: 'RESOLVE_STEAL', success: true });
    expect(s.phase).toBe('roundOver');
    expect(s.teams.find((t) => t.id === 'team-blue')?.score).toBe(35);
    const again = gameReducer(s, { type: 'RESOLVE_STEAL', success: true });
    expect(again).toBe(s);
  });

  it('brain blitz never alters normal team score', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' }); // gameOver
    const scoresBefore = s.teams.map((t) => t.score);
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    expect(s.brainBlitz?.player1Score).toBe(35);
    expect(s.teams.map((t) => t.score)).toEqual(scoresBefore);
  });

  it('extra board then undo returns to gameOver without corrupting score', () => {
    const spare = makeRound('spare');
    let s = loadGame(FOUR, [makeRound('b1')], [makeRound('b1'), spare]);
    s = gameReducer(s, { type: 'START_GAME' });
    let h = createHistory(controlRed(s));
    h = historyReducer(h, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    h = historyReducer(h, { type: 'AWARD_ROUND' });
    h = historyReducer(h, { type: 'NEXT_ROUND' }); // gameOver
    expect(h.present.phase).toBe('gameOver');
    h = historyReducer(h, { type: 'EXTRA_BOARD', roundId: 'spare' });
    expect(h.present.phase).toBe('tossup');
    h = historyReducer(h, { type: 'UNDO' });
    expect(h.present.phase).toBe('gameOver');
    expect(h.present.teams[0].score).toBe(35);
  });
});

describe('AUDIT 8 — brain blitz adversarial', () => {
  it('pause spam is idempotent; resume spam does not double-run', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    expect(s.brainBlitz?.timerRunning).toBe(true);
    s = gameReducer(s, { type: 'BRAIN_BLITZ_PAUSE' });
    expect(s.brainBlitz?.timerRunning).toBe(false);
    const pausedAgain = gameReducer(s, { type: 'BRAIN_BLITZ_PAUSE' });
    expect(pausedAgain).toBe(s);
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESUME' });
    expect(s.brainBlitz?.timerRunning).toBe(true);
    const resumedAgain = gameReducer(s, { type: 'BRAIN_BLITZ_RESUME' });
    expect(resumedAgain).toBe(s);
  });

  it('tick never goes below zero', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    for (let i = 0; i < 50; i++) s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(s.brainBlitz?.remainingSeconds).toBe(0);
    expect(s.brainBlitz?.timerExpired).toBe(true);
    expect(s.brainBlitz?.timerRunning).toBe(false);
    s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    expect(s.brainBlitz?.remainingSeconds).toBe(0);
  });

  it('accept after expiry still scores (teacher authority; timer never auto-scores)', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    for (let i = 0; i < 50; i++) s = gameReducer(s, { type: 'BRAIN_BLITZ_TICK' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    expect(s.brainBlitz?.player1Score).toBe(35);
  });

  it('duplicate canonical answer blocks player 2', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' }); // P1 active
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' }); // q1 → P1 accepted a1
    s = gameReducer(s, { type: 'BRAIN_BLITZ_END_PLAYER' }); // player1Complete
    s = gameReducer(s, { type: 'BRAIN_BLITZ_NEXT_PLAYER' }); // player2Ready
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' }); // P2 active on q1
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'full stop', resolution: 'accepted', answerId: 'a1' });
    const p2 = s.brainBlitz?.player2Responses[0];
    expect(p2?.status).toBe('duplicate');
    expect(p2?.points).toBe(0);
    expect(s.brainBlitz?.player2Score).toBe(0);
  });

  it('alternate valid answer scores for player 2', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_END_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_NEXT_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Comma', resolution: 'accepted', answerId: 'a2' });
    expect(s.brainBlitz?.player2Score).toBe(25);
  });

  it('double accept of same question does not double count (index advances)', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' }); // q1
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Red', resolution: 'accepted', answerId: 'b1' }); // q2 (advanced)
    expect(s.brainBlitz?.player1Score).toBe(65);
    expect(s.brainBlitz?.player1Responses.length).toBe(2);
  });

  it('accepted with invalid answer id is a no-op', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    const before = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'x', resolution: 'accepted', answerId: 'nope' });
    expect(before).toBe(s);
  });
});

describe('AUDIT 20 — persistence corruption', () => {
  function storageMock(): Storage {
    let store: Record<string, string> = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    };
  }

  it('rejects a record with an invalid active team id', () => {
    const storage = storageMock();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    const s = controlRed(start());
    const bad = { ...s, activeTeamId: 'ghost' } as unknown as GameState;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, state: bad }));
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects a record with a bad no-answer id', () => {
    const storage = storageMock();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    const s = controlRed(start());
    const bad = { ...s, noAnswerTeamIds: ['ghost'] } as unknown as GameState;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, state: bad }));
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects an obsolete version', () => {
    const storage = storageMock();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: controlRed(start()) }));
    expect(loadPersistedState()).toBeNull();
  });

  it('rejects malformed json', () => {
    const storage = storageMock();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadPersistedState()).toBeNull();
  });

  it('round-trips a live brain blitz state with timer paused', () => {
    const storage = storageMock();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    expect(s.brainBlitz?.timerRunning).toBe(true);
    savePersistedState(s);
    const loaded = loadPersistedState();
    expect(loaded).not.toBeNull();
    expect(loaded?.brainBlitz?.timerRunning).toBe(false); // restored paused
    expect(loaded?.brainBlitz?.remainingSeconds).toBe(30);
  });
});

describe('AUDIT: round-end flow lock (steal outcome, pacing, primary Blitz one-shot)', () => {
  it('a successful steal transfers the FULL pot and ends the round immediately (no continued guessing)', () => {
    let s = controlRed(start(FOUR, [makeRound('b1', 100)]));
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' }); // pot = 100
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' }); // 3rd strike -> steal
    expect(s.phase).toBe('steal');
    s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    s = gameReducer(s, { type: 'RESOLVE_STEAL', success: true });
    expect(s.phase).toBe('roundOver'); // round ends immediately
    expect(s.teams.find((t) => t.id === 'team-blue')?.score).toBe(100); // stealer gets the ENTIRE pot
    expect(s.teams.find((t) => t.id === 'team-red')?.score).toBe(0); // controller gets none of it
    // The stealing team never becomes the active/controlling team continuing the board.
    expect(s.activeTeamId).toBe('team-red');
    // Stealing team cannot keep "guessing" -- REVEAL_ANSWER is blocked outside playing/steal.
    const beforePot = s.roundPot;
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    expect(s.roundPot).toBe(beforePot);
  });

  it('a failed steal awards the FULL pot to the original controlling team and ends the round', () => {
    let s = controlRed(start(FOUR, [makeRound('b1', 70)]));
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' }); // pot = 70
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    s = gameReducer(s, { type: 'RESOLVE_STEAL', success: false });
    expect(s.phase).toBe('roundOver');
    expect(s.teams.find((t) => t.id === 'team-red')?.score).toBe(70);
    expect(s.teams.find((t) => t.id === 'team-blue')?.score).toBe(0);
  });

  it('a successful steal does not apply any extra multiplier beyond the round’s own', () => {
    const round: FeudRound = { ...makeRound('b1', 70), multiplier: 3 };
    let s = controlRed(start(FOUR, [round]));
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' }); // pot = 70, x3 = 210
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'ADD_STRIKE' });
    s = gameReducer(s, { type: 'SET_STEAL_TEAM', teamId: 'team-blue' });
    s = gameReducer(s, { type: 'RESOLVE_STEAL', success: true });
    expect(s.teams.find((t) => t.id === 'team-blue')?.score).toBe(210); // 70 x 3, not x6
  });

  it('the primary Brain Blitz cannot be started twice', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' }); // -> gameOver (single-board game)
    expect(s.phase).toBe('gameOver');
    expect(s.primaryBrainBlitzPlayed).toBe(false);

    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    expect(s.phase).toBe('brainBlitz');
    expect(s.primaryBrainBlitzPlayed).toBe(true);

    s = gameReducer(s, { type: 'BRAIN_BLITZ_EXIT' });
    expect(s.phase).toBe('gameOver');

    // Attempting to re-enter the primary Blitz is a no-op.
    const beforeRetry = s;
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    expect(s).toBe(beforeRetry); // identity-unchanged: reducer treated it as a no-op
    expect(s.phase).toBe('gameOver');
  });

  it('Extra Blitz (exhibition) remains available and replayable after the primary Blitz has been played', () => {
    let s = controlRed(start());
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_EXIT' });
    expect(s.primaryBrainBlitzPlayed).toBe(true);

    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    expect(s.phase).toBe('brainBlitz');
    expect(s.brainBlitz?.exhibition).toBe(true);
    s = gameReducer(s, { type: 'BRAIN_BLITZ_EXIT' });
    // Can be replayed again -- exhibition has no one-shot limit.
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', exhibition: true });
    expect(s.phase).toBe('brainBlitz');
    expect(s.primaryBrainBlitzPlayed).toBe(true); // still true, unaffected by exhibition runs
  });

  it('going to Brain Blitz early (skipping unplayed rounds) preserves scores and awards nothing for skipped rounds', () => {
    const rounds = [makeRound('b1', 40), makeRound('b2', 60), makeRound('b3', 80)];
    let s = controlRed(start(FOUR, rounds));
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'b1-a1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' }); // red: 40
    expect(s.phase).toBe('roundOver');
    expect(s.teams.find((t) => t.id === 'team-red')?.score).toBe(40);

    // Teacher skips boards 2 and 3 entirely (mirrors the "Skip to Final Score" button).
    s = gameReducer(s, { type: 'END_GAME' });
    expect(s.phase).toBe('gameOver');
    // Score from the one completed board is preserved; nothing was awarded for b2/b3.
    expect(s.teams.find((t) => t.id === 'team-red')?.score).toBe(40);
    const totalScore = s.teams.reduce((sum, t) => sum + t.score, 0);
    expect(totalScore).toBe(40); // only the completed board's pot was ever awarded

    // Brain Blitz can now be entered normally from this early gameOver.
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    expect(s.phase).toBe('brainBlitz');
  });
});
