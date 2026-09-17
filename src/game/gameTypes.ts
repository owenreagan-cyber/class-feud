// Core domain types for Class Feud.

import type {
  BrainBlitzConfig,
  BrainBlitzPlayerMode,
  BrainBlitzResolution,
  BrainBlitzState,
} from './brainBlitzTypes';

export type TeamId = string;

export type GamePhase =
  | 'setup'
  | 'tossup'
  | 'playing'
  | 'steal'
  | 'roundOver'
  | 'gameOver'
  | 'brainBlitz';

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

/** Round point multiplier. Applied only when calculating/awarding round value. */
export type Multiplier = 1 | 2 | 3;

/**
 * A round combines reusable configuration (title, category, prompt, multiplier,
 * answer definitions) with mutable runtime state (the `revealed` flag on each
 * answer). The `roundLibrary` holds pristine definitions; `rounds` is the
 * selected, ordered game queue whose answers carry live `revealed` state.
 */
export type FeudRound = {
  id: string;
  title: string;
  category: string;
  prompt: string;
  multiplier: Multiplier;
  answers: FeudAnswer[];
};

export type GameState = {
  phase: GamePhase;
  teams: Team[];
  activeTeamId: TeamId | null;
  stealTeamId: TeamId | null;
  strikes: number;
  roundPot: number;
  roundWinnerId: TeamId | null;
  roundLibrary: FeudRound[];
  rounds: FeudRound[];
  currentRoundIndex: number;
  /**
   * Teams marked "NO ANSWER" during the current board's face-off. They are
   * blocked from stealing this board only; the set resets at the next board.
   */
  noAnswerTeamIds: TeamId[];
  /** Authored Brain Blitz configuration (runtime copy; null when unavailable). */
  brainBlitzConfig: BrainBlitzConfig | null;
  /** Live Brain Blitz runtime state (null until a Brain Blitz round starts). */
  brainBlitz: BrainBlitzState | null;
};

export type GameAction =
  // Lifecycle
  | { type: 'START_GAME' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'UNDO' }
  // Load authored rounds as the active game queue (enters `setup`).
  | { type: 'LOAD_GAME_ROUNDS'; roundLibrary: FeudRound[]; rounds: FeudRound[]; brainBlitzConfig?: BrainBlitzConfig | null }
  // Team structure (setup only)
  | { type: 'UPDATE_TEAMS'; teams: Team[] }
  | { type: 'ADD_TEAM' }
  | { type: 'REMOVE_TEAM'; teamId: TeamId }
  | { type: 'RENAME_TEAM'; teamId: TeamId; name: string }
  | { type: 'SET_TEAM_COLOR'; teamId: TeamId; color: string }
  | { type: 'REORDER_TEAMS'; teamIds: TeamId[] }
  // Round selection (setup only)
  | { type: 'TOGGLE_ROUND'; roundId: string }
  | { type: 'REORDER_ROUNDS'; roundIds: string[] }
  | { type: 'SET_ROUND_MULTIPLIER'; roundId: string; multiplier: Multiplier }
  // Gameplay
  | { type: 'SET_ACTIVE_TEAM'; teamId: TeamId }
  | { type: 'REVEAL_ANSWER'; answerId: string }
  | { type: 'ADD_STRIKE' }
  | { type: 'REMOVE_STRIKE' }
  | { type: 'START_STEAL' }
  | { type: 'SET_STEAL_TEAM'; teamId: TeamId }
  | { type: 'RESOLVE_STEAL'; success: boolean }
  | { type: 'AWARD_ROUND'; teamId?: TeamId }
  // Face-off no-answer rule (Team Buttons / manual play).
  | { type: 'MARK_NO_ANSWER'; teamId: TeamId }
  | { type: 'CLEAR_NO_ANSWER'; teamId: TeamId }
  // Extra-time teacher escape hatches (gameOver only).
  | { type: 'EXTRA_BOARD'; roundId: string }
  // Brain Blitz final round (optional; `exhibition` = extra blitz, never alters winner).
  | { type: 'BRAIN_BLITZ_ENTER'; teamId?: TeamId; exhibition?: boolean }
  | { type: 'BRAIN_BLITZ_SET_FINALIST'; teamId: TeamId }
  | { type: 'BRAIN_BLITZ_SET_PLAYER_MODE'; playerMode: BrainBlitzPlayerMode }
  | { type: 'BRAIN_BLITZ_BEGIN_PLAYER' }
  | { type: 'BRAIN_BLITZ_NEXT_PLAYER' }
  | { type: 'BRAIN_BLITZ_PAUSE' }
  | { type: 'BRAIN_BLITZ_RESUME' }
  | { type: 'BRAIN_BLITZ_TICK' }
  | { type: 'BRAIN_BLITZ_RESOLVE'; rawResponse: string; resolution: BrainBlitzResolution; answerId?: string }
  | { type: 'BRAIN_BLITZ_END_PLAYER' }
  | { type: 'BRAIN_BLITZ_EXIT' };

export const PHASE_LABELS: Record<GamePhase, string> = {
  setup: 'Setup',
  tossup: 'Toss-Up',
  playing: 'In Play',
  steal: 'Steal',
  roundOver: 'Round Over',
  gameOver: 'Game Over',
  brainBlitz: 'Brain Blitz',
};

export const MAX_STRIKES = 3;
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;

export const MULTIPLIER_LABELS: Record<Multiplier, string> = {
  1: 'Normal Points',
  2: 'Double Points',
  3: 'Triple Points',
};

export type TeamColorOption = { id: string; label: string; value: string };

export const TEAM_COLORS: readonly TeamColorOption[] = [
  { id: 'red', label: 'Red', value: '#ef4444' },
  { id: 'blue', label: 'Blue', value: '#3b82f6' },
  { id: 'green', label: 'Green', value: '#22c55e' },
  { id: 'gold', label: 'Gold', value: '#eab308' },
  { id: 'orange', label: 'Orange', value: '#f97316' },
  { id: 'purple', label: 'Purple', value: '#a855f7' },
  { id: 'teal', label: 'Teal', value: '#14b8a6' },
];
