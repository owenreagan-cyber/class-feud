// Core domain types for Class Feud.

export type TeamId = string;

export type GamePhase =
  | 'setup'
  | 'tossup'
  | 'playing'
  | 'steal'
  | 'roundOver'
  | 'gameOver';

export type Team = {
  id: TeamId;
  name: string;
  color: string;
  score: number;
};

export type FeudAnswer = {
  id: string;
  text: string;
  aliases: string[];
  points: number;
  revealed: boolean;
};

export type FeudRound = {
  id: string;
  prompt: string;
  category: string;
  multiplier: number;
  answers: FeudAnswer[];
};

export type GameState = {
  phase: GamePhase;
  teams: Team[];
  activeTeamId: TeamId | null;
  stealTeamId: TeamId | null;
  strikes: number;
  roundPot: number;
  currentRound: FeudRound;
};

export type GameAction =
  | { type: 'START_ROUND' }
  | { type: 'SET_ACTIVE_TEAM'; teamId: TeamId }
  | { type: 'REVEAL_ANSWER'; answerId: string }
  | { type: 'ADD_STRIKE' }
  | { type: 'REMOVE_STRIKE' }
  | { type: 'START_STEAL' }
  | { type: 'RESOLVE_STEAL'; success: boolean }
  | { type: 'AWARD_ROUND'; teamId?: TeamId }
  | { type: 'END_GAME' }
  | { type: 'UPDATE_TEAMS'; teams: Team[] }
  | { type: 'UNDO' }
  | { type: 'RESET_GAME' };

export const PHASE_LABELS: Record<GamePhase, string> = {
  setup: 'Setup',
  tossup: 'Face-Off',
  playing: 'In Play',
  steal: 'Steal',
  roundOver: 'Round Over',
  gameOver: 'Game Over',
};

export const MAX_STRIKES = 3;
