import type { FeudRound, Multiplier } from '../game/gameTypes';
import {
  BRAIN_BLITZ_DEFAULT_QUESTIONS,
  BRAIN_BLITZ_DEFAULT_TARGET,
  BRAIN_BLITZ_DEFAULT_TIMER_SECONDS,
  cloneBrainBlitzConfig,
} from '../game/brainBlitzTypes';
import type {
  BrainBlitzAnswer,
  BrainBlitzConfig,
  BrainBlitzQuestion,
} from '../game/brainBlitzTypes';

/**
 * Authored content model — kept strictly separate from active runtime game
 * state. These definitions are durable, serializable teacher content and carry
 * no runtime fields (no `revealed`, scores, strikes, phase, or possession).
 *
 * Future phases may add optional metadata such as `subject`, `gradeBand`, or
 * `tags`; the shape below is designed to serialize cleanly to JSON.
 */

export type AnswerDefinition = {
  id: string;
  text: string;
  points: number;
  aliases: string[];
};

export type RoundDefinition = {
  id: string;
  title: string;
  category: string;
  prompt: string;
  multiplier: Multiplier;
  answers: AnswerDefinition[];
};

export type GameSetSource = 'builtin' | 'custom';

export type SavedGameSet = {
  id: string;
  title: string;
  description: string;
  source: GameSetSource;
  createdAt: string;
  updatedAt: string;
  rounds: RoundDefinition[];
  /**
   * Optional default play order (a subset of `rounds` ids). When present, the
   * game starts with only these rounds; the remaining rounds are "spare" boards
   * the teacher can launch later via "+ EXTRA BOARD". Absent = play all rounds.
   */
  defaultRoundIds?: string[];
  /**
   * Scoring basis metadata. Built-in games use "classroom-game-weight" so the
   * point values are clearly gameplay weights, never presented as survey data.
   */
  scoringBasis?: string;
  /** Optional Brain Blitz final-round configuration. Absent = disabled. */
  brainBlitz?: BrainBlitzConfig;
};

/** Generate a stable, unique id. Uses the platform UUID when available. */
export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `${prefix}-${rand}`;
}

/** Convert an authored answer into a runtime answer (adds `revealed`). */
export function toFeudRound(def: RoundDefinition): FeudRound {
  return {
    id: def.id,
    title: def.title,
    category: def.category,
    prompt: def.prompt,
    multiplier: def.multiplier,
    answers: def.answers.map((answer) => ({
      ...answer,
      aliases: [...answer.aliases],
      revealed: false,
    })),
  };
}

export function toFeudRounds(defs: RoundDefinition[]): FeudRound[] {
  return defs.map(toFeudRound);
}

/** Strip runtime fields from a runtime round to produce an authored definition. */
export function toRoundDefinition(round: FeudRound): RoundDefinition {
  return {
    id: round.id,
    title: round.title,
    category: round.category,
    prompt: round.prompt,
    multiplier: round.multiplier,
    answers: round.answers.map((answer) => ({
      id: answer.id,
      text: answer.text,
      points: answer.points,
      aliases: [...answer.aliases],
    })),
  };
}

/** Deep-clone a game set, preserving all ids. */
export function cloneGameSet(set: SavedGameSet): SavedGameSet {
  return {
    ...set,
    rounds: set.rounds.map((round) => ({
      ...round,
      answers: round.answers.map((answer) => ({ ...answer, aliases: [...answer.aliases] })),
    })),
    brainBlitz: set.brainBlitz ? cloneBrainBlitzConfig(set.brainBlitz) : undefined,
  };
}

export function createEmptyAnswer(): AnswerDefinition {
  return { id: newId('answer'), text: '', points: 0, aliases: [] };
}

/** A new round starts with two blank answers (the minimum for a valid round). */
export function createEmptyRound(): RoundDefinition {
  return {
    id: newId('round'),
    title: '',
    category: '',
    prompt: '',
    multiplier: 1,
    answers: [createEmptyAnswer(), createEmptyAnswer()],
  };
}

export function createEmptyGameSet(): SavedGameSet {
  const now = new Date().toISOString();
  return {
    id: newId('game'),
    title: '',
    description: '',
    source: 'custom',
    createdAt: now,
    updatedAt: now,
    rounds: [],
    brainBlitz: createDefaultBrainBlitzConfig(),
  };
}

export function duplicateAnswer(def: AnswerDefinition): AnswerDefinition {
  return { ...def, id: newId('answer'), aliases: [...def.aliases] };
}

/** Deep-copy a round with brand-new round/answer ids, preserving the title. */
function cloneRoundWithNewIds(def: RoundDefinition): RoundDefinition {
  return {
    ...def,
    id: newId('round'),
    answers: def.answers.map(duplicateAnswer),
  };
}

/** Duplicate a single round for editing; the title clearly marks the copy. */
export function duplicateRound(def: RoundDefinition): RoundDefinition {
  return { ...cloneRoundWithNewIds(def), title: `${def.title} — Copy` };
}

/** Produce an independent custom copy with brand-new game/round/answer ids. */
export function duplicateGameSet(source: SavedGameSet): SavedGameSet {
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();
  const rounds = source.rounds.map((def) => {
    const copy = cloneRoundWithNewIds(def);
    idMap.set(def.id, copy.id);
    return copy;
  });
  return {
    ...source,
    id: newId('game'),
    title: `${source.title} — Copy`,
    source: 'custom',
    createdAt: now,
    updatedAt: now,
    rounds,
    // Remap the default-round selection to the freshly regenerated round ids.
    defaultRoundIds: source.defaultRoundIds
      ? source.defaultRoundIds.map((id) => idMap.get(id) ?? id)
      : undefined,
    brainBlitz: source.brainBlitz ? duplicateBrainBlitzConfig(source.brainBlitz) : undefined,
  };
}

// ------------------------------------------------------------- Brain Blitz --

export function createEmptyBrainBlitzAnswer(): BrainBlitzAnswer {
  return { id: newId('blitz-answer'), text: '', points: 0, aliases: [] };
}

export function createEmptyBrainBlitzQuestion(): BrainBlitzQuestion {
  return {
    id: newId('blitz-question'),
    prompt: '',
    category: '',
    answers: [createEmptyBrainBlitzAnswer(), createEmptyBrainBlitzAnswer()],
  };
}

/**
 * A disabled Brain Blitz config with the recommended defaults and five blank
 * question slots, ready for the teacher to fill in and enable.
 */
export function createDefaultBrainBlitzConfig(): BrainBlitzConfig {
  return {
    enabled: false,
    timerSeconds: BRAIN_BLITZ_DEFAULT_TIMER_SECONDS,
    targetScore: BRAIN_BLITZ_DEFAULT_TARGET,
    questions: Array.from({ length: BRAIN_BLITZ_DEFAULT_QUESTIONS }, createEmptyBrainBlitzQuestion),
  };
}

function duplicateBrainBlitzAnswer(def: BrainBlitzAnswer): BrainBlitzAnswer {
  return { ...def, id: newId('blitz-answer'), aliases: [...def.aliases] };
}

function duplicateBrainBlitzQuestion(def: BrainBlitzQuestion): BrainBlitzQuestion {
  return { ...def, id: newId('blitz-question'), answers: def.answers.map(duplicateBrainBlitzAnswer) };
}

/** Copy a Brain Blitz config with brand-new question/answer ids (no shared refs). */
export function duplicateBrainBlitzConfig(config: BrainBlitzConfig): BrainBlitzConfig {
  return { ...config, questions: config.questions.map(duplicateBrainBlitzQuestion) };
}
