// Brain Blitz domain model.
//
// Brain Blitz is an OPTIONAL rapid-fire final round that runs after the normal
// game reaches `gameOver`. It has an entirely independent score (it never
// touches normal team scores) and is driven by the same reducer/history/persist
// pipeline as the rest of the game. Content types (answer/question/config) are
// authored by the teacher; runtime types (status/response/state) track a live
// round. Everything here is pure domain — no React, no storage, no scoring
// side effects.

// ---------------------------------------------------------------- content --

export type BrainBlitzAnswer = {
  id: string;
  text: string;
  aliases: string[];
  points: number;
};

export type BrainBlitzQuestion = {
  id: string;
  prompt: string;
  category?: string;
  answers: BrainBlitzAnswer[];
};

export type BrainBlitzConfig = {
  enabled: boolean;
  timerSeconds: number;
  targetScore: number;
  questions: BrainBlitzQuestion[];
};

// ----------------------------------------------------------------- runtime --

export type BrainBlitzStatus =
  | 'setup'
  | 'player1Ready'
  | 'player1Active'
  | 'player1Complete'
  | 'player2Ready'
  | 'player2Active'
  | 'complete';

export type BrainBlitzPlayer = 1 | 2;

export type BrainBlitzPlayerMode = 'one' | 'two';

/** Teacher-confirmed resolution kind. `duplicate` is derived by the reducer. */
export type BrainBlitzResolution = 'accepted' | 'noMatch' | 'skipped';

export type BrainBlitzResponseStatus =
  | 'accepted'
  | 'duplicate'
  | 'noMatch'
  | 'skipped';

export type BrainBlitzResponse = {
  questionId: string;
  rawResponse: string;
  answerId: string | null;
  points: number;
  status: BrainBlitzResponseStatus;
};

/**
 * Live Brain Blitz runtime state. Lives on `GameState.brainBlitz` while a
 * Brain Blitz round is active. Questions are read from `GameState.brainBlitzConfig`
 * (immutable during play); this object tracks progress only.
 */
export type BrainBlitzState = {
  status: BrainBlitzStatus;
  finalistTeamId: string | null;
  playerMode: BrainBlitzPlayerMode;
  currentPlayer: BrainBlitzPlayer;
  currentQuestionIndex: number;
  player1Responses: BrainBlitzResponse[];
  player2Responses: BrainBlitzResponse[];
  player1Score: number;
  player2Score: number;
  targetScore: number;
  timerSeconds: number;
  remainingSeconds: number;
  timerRunning: boolean;
  timerExpired: boolean;
};

// ---------------------------------------------------------------- defaults --

export const BRAIN_BLITZ_DEFAULT_TIMER_SECONDS = 30;
export const BRAIN_BLITZ_DEFAULT_TARGET = 200;
export const BRAIN_BLITZ_DEFAULT_QUESTIONS = 5;

// Validation bounds.
export const BRAIN_BLITZ_MIN_TIMER_SECONDS = 10;
export const BRAIN_BLITZ_MAX_TIMER_SECONDS = 120;
export const BRAIN_BLITZ_MIN_TARGET = 1;
export const BRAIN_BLITZ_MAX_TARGET = 9999;
export const BRAIN_BLITZ_MIN_ANSWERS = 2;
export const BRAIN_BLITZ_MAX_ANSWERS = 12; // warning threshold
export const BRAIN_BLITZ_LOW_QUESTIONS = 5; // warning threshold
export const BRAIN_BLITZ_HIGH_QUESTIONS = 10; // warning threshold
export const BRAIN_BLITZ_MAX_PROMPT_LENGTH = 200;

// ----------------------------------------------------------- cloning helpers --

export function cloneBrainBlitzAnswer(answer: BrainBlitzAnswer): BrainBlitzAnswer {
  return { ...answer, aliases: [...answer.aliases] };
}

export function cloneBrainBlitzQuestion(question: BrainBlitzQuestion): BrainBlitzQuestion {
  return { ...question, answers: question.answers.map(cloneBrainBlitzAnswer) };
}

/** Deep-copy a config so no caller ever shares mutable references with source. */
export function cloneBrainBlitzConfig(config: BrainBlitzConfig): BrainBlitzConfig {
  return { ...config, questions: config.questions.map(cloneBrainBlitzQuestion) };
}

/** Determine whether a Brain Blitz config is actually playable (enabled + questions). */
export function isBrainBlitzEnabled(
  config: BrainBlitzConfig | null | undefined,
): config is BrainBlitzConfig {
  return !!config && config.enabled && config.questions.length > 0;
}
