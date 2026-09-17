import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { getEligibleStealTeams, getSpareRounds, getWinner } from './gameSelectors';
import type { FeudAnswer, FeudRound, GameState, Team } from './gameTypes';
import type { BrainBlitzConfig } from './brainBlitzTypes';

const ANSWER: FeudAnswer = { id: 'pa1', text: 'Root', aliases: [], points: 35, revealed: false };

function makeRound(id: string): FeudRound {
  return { id, title: `Board ${id}`, category: 'Science', prompt: 'Name a plant part.', multiplier: 1, answers: [ANSWER] };
}

const SPARE_A: FeudRound = makeRound('spare-a');
const SPARE_B: FeudRound = makeRound('spare-b');

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
          { id: 'a1', text: 'Period', aliases: [], points: 35 },
          { id: 'a2', text: 'Comma', aliases: [], points: 25 },
        ],
      },
    ],
  };
}

/** Load a 4-team game with 1 selected board + 2 spares + blitz. */
function loadFourTeam(rounds: FeudRound[] = [makeRound('board-1')]): GameState {
  const library = [...rounds, SPARE_A, SPARE_B];
  const teams: Team[] = [
    { id: 'team-red', name: 'Red', color: '#ef4444', score: 0 },
    { id: 'team-blue', name: 'Blue', color: '#3b82f6', score: 0 },
    { id: 'team-green', name: 'Green', color: '#22c55e', score: 0 },
    { id: 'team-gold', name: 'Gold', color: '#eab308', score: 0 },
  ];
  let state = createInitialState();
  // Load the authored content first (this resets teams), then apply 4 teams.
  state = gameReducer(state, {
    type: 'LOAD_GAME_ROUNDS',
    roundLibrary: library,
    rounds,
    brainBlitzConfig: blitzConfig(),
  });
  state = gameReducer(state, { type: 'UPDATE_TEAMS', teams });
  return state;
}

/** Start the game and give control to red, with red revealing the answer. */
function startControlled(state: GameState = loadFourTeam()): GameState {
  let next = gameReducer(state, { type: 'START_GAME' });
  next = gameReducer(next, { type: 'SET_ACTIVE_TEAM', teamId: 'team-red' });
  return next;
}

/** Play a single-board game to gameOver with a unique winner (red 35). */
function playToGameOver(): GameState {
  let s = startControlled();
  s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
  s = gameReducer(s, { type: 'AWARD_ROUND' });
  s = gameReducer(s, { type: 'NEXT_ROUND' });
  expect(s.phase).toBe('gameOver');
  return s;
}

describe('no-answer rule', () => {
  it('marks a team ineligible to steal', () => {
    let s = startControlled();
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(s.noAnswerTeamIds).toContain('team-green');
    expect(getEligibleStealTeams(s).map((t) => t.id)).not.toContain('team-green');
  });

  it('does not mark a team without the no-answer action (incorrect path)', () => {
    const s = startControlled();
    expect(getEligibleStealTeams(s).map((t) => t.id)).toEqual([
      'team-blue',
      'team-green',
      'team-gold',
    ]);
  });

  it('penalty is limited to the current board (resets on next board)', () => {
    const twoBoards = loadFourTeam([makeRound('board-1'), makeRound('board-2')]);
    let s = startControlled(twoBoards);
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(s.noAnswerTeamIds).toContain('team-green');
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('tossup');
    expect(s.noAnswerTeamIds).toEqual([]);
    expect(getEligibleStealTeams(s).map((t) => t.id)).toContain('team-green');
  });

  it('teacher override clears the penalty', () => {
    let s = startControlled();
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    s = gameReducer(s, { type: 'CLEAR_NO_ANSWER', teamId: 'team-green' });
    expect(s.noAnswerTeamIds).toEqual([]);
    expect(getEligibleStealTeams(s).map((t) => t.id)).toContain('team-green');
  });

  it('marking a team as controlling team also excluded by steal eligibility', () => {
    // The controlling team is never eligible to steal; no-answer adds more exclusions.
    let s = startControlled();
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-blue' });
    expect(getEligibleStealTeams(s).map((t) => t.id)).toEqual(['team-green', 'team-gold']);
  });

  it('rejects marking an unknown team', () => {
    const s = startControlled();
    expect(gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'nope' })).toBe(s);
  });
});

describe('steal eligibility with four teams', () => {
  it('excludes controlling team and no-answer teams', () => {
    let s = startControlled();
    s = gameReducer(s, { type: 'MARK_NO_ANSWER', teamId: 'team-green' });
    expect(getEligibleStealTeams(s).map((t) => t.id)).toEqual(['team-blue', 'team-gold']);
  });

  it('does not auto-select a steal team with multiple eligible teams', () => {
    let s = startControlled();
    s = gameReducer(s, { type: 'START_STEAL' });
    expect(s.phase).toBe('steal');
    expect(s.stealTeamId).toBeNull();
  });
});

describe('extra board', () => {
  it('launches a spare board safely from gameOver', () => {
    const s = gameReducer(playToGameOver(), { type: 'EXTRA_BOARD', roundId: 'spare-a' });
    expect(s.phase).toBe('tossup');
    expect(s.currentRoundIndex).toBe(s.rounds.length - 1);
    expect(s.rounds[s.currentRoundIndex].id).toBe('spare-a');
    expect(s.noAnswerTeamIds).toEqual([]);
  });

  it('uses normal scoring and recomputes the winner afterward', () => {
    let s = gameReducer(playToGameOver(), { type: 'EXTRA_BOARD', roundId: 'spare-a' });
    // Blue controls the extra board and scores the answer.
    s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: 'team-blue' });
    s = gameReducer(s, { type: 'REVEAL_ANSWER', answerId: 'pa1' });
    expect(s.roundPot).toBe(35);
    s = gameReducer(s, { type: 'AWARD_ROUND' });
    s = gameReducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('gameOver');
    // Red (35) and Blue (35) are now tied, so no single winner.
    expect(getWinner(s)).toBeNull();
    expect(getSpareRounds(s).map((r) => r.id)).toEqual(['spare-b']);
  });

  it('rejects an extra board that is already in the queue', () => {
    const s = gameReducer(playToGameOver(), { type: 'EXTRA_BOARD', roundId: 'board-1' });
    expect(s.phase).toBe('gameOver');
  });

  it('rejects an unknown extra board id', () => {
    const s = gameReducer(playToGameOver(), { type: 'EXTRA_BOARD', roundId: 'nope' });
    expect(s.phase).toBe('gameOver');
  });
});

describe('extra blitz (exhibition)', () => {
  it('starts a fresh exhibition blitz with a chosen team', () => {
    let s = playToGameOver();
    const winnerBefore = getWinner(s)?.id;
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', teamId: 'team-blue', exhibition: true });
    expect(s.phase).toBe('brainBlitz');
    expect(s.brainBlitz?.exhibition).toBe(true);
    expect(s.brainBlitz?.finalistTeamId).toBe('team-blue');
    // Official winner (normal scores) is untouched.
    expect(getWinner(s)?.id).toBe(winnerBefore);
  });

  it('exhibition blitz does not alter official winner or normal scores', () => {
    let s = playToGameOver();
    const scoresBefore = s.teams.map((t) => ({ id: t.id, score: t.score }));
    const winnerBefore = getWinner(s)?.id;
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', teamId: 'team-gold', exhibition: true });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    expect(s.brainBlitz?.player1Score).toBe(35);
    // Normal team scores unchanged and winner still red.
    expect(s.teams.map((t) => ({ id: t.id, score: t.score }))).toEqual(scoresBefore);
    expect(getWinner(s)?.id).toBe(winnerBefore);
  });

  it('primary Brain Blitz result is not corrupted by a later extra blitz', () => {
    let s = playToGameOver();
    // Primary blitz for red.
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER' });
    expect(s.brainBlitz?.exhibition).toBe(false);
    expect(s.brainBlitz?.finalistTeamId).toBe('team-red');
    s = gameReducer(s, { type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
    s = gameReducer(s, { type: 'BRAIN_BLITZ_RESOLVE', rawResponse: 'Period', resolution: 'accepted', answerId: 'a1' });
    const primary = s.brainBlitz;
    // Exit primary, then run an exhibition blitz — a brand new state object.
    s = gameReducer(s, { type: 'BRAIN_BLITZ_EXIT' });
    expect(s.brainBlitz).toBeNull();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', teamId: 'team-gold', exhibition: true });
    expect(s.brainBlitz).not.toBe(primary);
    expect(s.brainBlitz?.exhibition).toBe(true);
    expect(s.brainBlitz?.player1Score).toBe(0);
  });
});

describe('four-team support', () => {
  it('renders all four teams with distinct ids', () => {
    const s = startControlled();
    expect(s.teams.map((t) => t.id)).toEqual(['team-red', 'team-blue', 'team-green', 'team-gold']);
  });

  it('active team selection supports all four teams', () => {
    let s = startControlled();
    for (const id of ['team-blue', 'team-green', 'team-gold'] as const) {
      s = gameReducer(s, { type: 'SET_ACTIVE_TEAM', teamId: id });
      expect(s.activeTeamId).toBe(id);
    }
  });

  it('Brain Blitz finalist can be any of the four teams', () => {
    let s = playToGameOver();
    s = gameReducer(s, { type: 'BRAIN_BLITZ_ENTER', teamId: 'team-gold', exhibition: true });
    expect(s.brainBlitz?.finalistTeamId).toBe('team-gold');
  });

  it('add-team auto-assigns the fourth team the gold color', () => {
    let s = createInitialState();
    s = gameReducer(s, { type: 'ADD_TEAM' }); // 3rd (green)
    s = gameReducer(s, { type: 'ADD_TEAM' }); // 4th (gold)
    expect(s.teams[3].color).toBe('#eab308');
  });
});
