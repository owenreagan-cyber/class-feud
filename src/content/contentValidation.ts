import { normalize } from '../game/answerMatcher';
import type { AnswerDefinition, RoundDefinition, SavedGameSet } from './gameSet';
import type { Multiplier } from '../game/gameTypes';

/**
 * Deterministic content validation. Errors block save/start; warnings allow
 * save but should be shown to the teacher. Reuses the same normalization as
 * `answerMatcher.ts` — there is no second normalization implementation.
 */

export type ValidationIssue = {
  severity: 'error' | 'warning';
  path: string;
  message: string;
};

export const MAX_ANSWER_POINTS = 999;
export const MAX_ROUNDS = 12;
export const MAX_ANSWERS = 12;
export const MAX_ANSWER_TEXT_LENGTH = 80;
export const MAX_PROMPT_LENGTH = 200;
export const LOW_TOTAL_POINTS = 20;
export const HIGH_TOTAL_POINTS = 1000;

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function isValidMultiplier(value: number): value is Multiplier {
  return value === 1 || value === 2 || value === 3;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function validateAnswer(
  answer: AnswerDefinition,
  answerIndex: number,
  roundPath: string,
): ValidationIssue[] {
  const path = `${roundPath}.answers[${answerIndex}]`;
  const issues: ValidationIssue[] = [];

  if (answer.text.trim() === '') {
    issues.push({ severity: 'error', path: `${path}.text`, message: 'Answer text is required.' });
  }

  if (
    !isInteger(answer.points) ||
    answer.points < 0 ||
    answer.points > MAX_ANSWER_POINTS
  ) {
    issues.push({
      severity: 'error',
      path: `${path}.points`,
      message: `Points must be a whole number between 0 and ${MAX_ANSWER_POINTS}.`,
    });
  }

  if (answer.text.trim().length > MAX_ANSWER_TEXT_LENGTH) {
    issues.push({ severity: 'warning', path: `${path}.text`, message: 'Answer text is very long.' });
  }

  return issues;
}

export function validateRound(round: RoundDefinition, roundIndex: number): ValidationIssue[] {
  const path = `rounds[${roundIndex}]`;
  const issues: ValidationIssue[] = [];

  if (round.id.trim() === '') {
    issues.push({ severity: 'error', path: `${path}.id`, message: 'Round id is required.' });
  }
  if (round.title.trim() === '') {
    issues.push({ severity: 'error', path: `${path}.title`, message: 'Round title is required.' });
  }
  if (round.prompt.trim() === '') {
    issues.push({ severity: 'error', path: `${path}.prompt`, message: 'Question is required.' });
  }
  if (round.prompt.trim().length > MAX_PROMPT_LENGTH) {
    issues.push({ severity: 'warning', path: `${path}.prompt`, message: 'Question is very long.' });
  }
  if (!isValidMultiplier(round.multiplier)) {
    issues.push({
      severity: 'error',
      path: `${path}.multiplier`,
      message: 'Multiplier must be 1, 2, or 3.',
    });
  }
  if (round.answers.length < 2) {
    issues.push({
      severity: 'error',
      path: `${path}.answers`,
      message: 'A round needs at least 2 answers.',
    });
  }
  if (round.answers.length > MAX_ANSWERS) {
    issues.push({
      severity: 'warning',
      path: `${path}.answers`,
      message: `This round has ${round.answers.length} answers, which is a lot.`,
    });
  }

  const answerIds = new Set<string>();
  const canonicals = new Map<string, number>();
  round.answers.forEach((answer, i) => {
    if (answerIds.has(answer.id)) {
      issues.push({
        severity: 'error',
        path: `${path}.answers[${i}].id`,
        message: `Duplicate answer id "${answer.id}".`,
      });
    }
    answerIds.add(answer.id);
    issues.push(...validateAnswer(answer, i, path));

    const canonNorm = normalize(answer.text);
    if (canonNorm !== '') {
      if (canonicals.has(canonNorm)) {
        const first = canonicals.get(canonNorm) ?? 0;
        issues.push({
          severity: 'error',
          path: `${path}.answers[${i}].text`,
          message: `Answers ${first + 1} and ${i + 1} both normalize to "${canonNorm}".`,
        });
      } else {
        canonicals.set(canonNorm, i);
      }
    }

    const aliasNorms = new Set<string>();
    answer.aliases.forEach((alias) => {
      const aliasNorm = normalize(alias);
      if (aliasNorm === '') return;
      if (aliasNorms.has(aliasNorm)) {
        issues.push({
          severity: 'warning',
          path: `${path}.answers[${i}].aliases`,
          message: `Alias "${alias}" appears more than once for this answer.`,
        });
      }
      aliasNorms.add(aliasNorm);
      if (aliasNorm === canonNorm) {
        issues.push({
          severity: 'warning',
          path: `${path}.answers[${i}].aliases`,
          message: `Alias "${alias}" is the same as the answer text.`,
        });
      }
    });
  });

  const total = round.answers.reduce(
    (sum, answer) => sum + (isInteger(answer.points) && answer.points >= 0 ? answer.points : 0),
    0,
  );
  if (total < LOW_TOTAL_POINTS) {
    issues.push({
      severity: 'warning',
      path: `${path}.answers`,
      message: `Total points (${total}) is very low.`,
    });
  } else if (total > HIGH_TOTAL_POINTS) {
    issues.push({
      severity: 'warning',
      path: `${path}.answers`,
      message: `Total points (${total}) is very high.`,
    });
  }

  return issues;
}

/** Warn when a normalized alias is shared by two different answers in the game. */
function collectAliasCollisions(set: SavedGameSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();
  set.rounds.forEach((round, r) => {
    round.answers.forEach((answer, a) => {
      answer.aliases.forEach((alias) => {
        const norm = normalize(alias);
        if (norm === '') return;
        const loc = `round ${r + 1}, answer ${a + 1}`;
        const prev = seen.get(norm);
        if (prev !== undefined) {
          if (prev !== loc) {
            issues.push({
              severity: 'warning',
              path: `rounds[${r}].answers[${a}].aliases`,
              message: `Alias "${alias}" is shared by ${prev} and ${loc}.`,
            });
          }
        } else {
          seen.set(norm, loc);
        }
      });
    });
  });
  return issues;
}

export function validateGameSet(set: SavedGameSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (set.title.trim() === '') {
    issues.push({ severity: 'error', path: 'title', message: 'Game title is required.' });
  }

  if (set.rounds.length === 0) {
    issues.push({ severity: 'error', path: 'rounds', message: 'Add at least one round.' });
  }

  const seenRoundIds = new Set<string>();
  set.rounds.forEach((round, i) => {
    if (seenRoundIds.has(round.id)) {
      issues.push({
        severity: 'error',
        path: `rounds[${i}].id`,
        message: `Duplicate round id "${round.id}".`,
      });
    }
    seenRoundIds.add(round.id);
    issues.push(...validateRound(round, i));
  });

  if (set.rounds.length > MAX_ROUNDS) {
    issues.push({
      severity: 'warning',
      path: 'rounds',
      message: `This game has ${set.rounds.length} rounds, which is a lot.`,
    });
  }

  issues.push(...collectAliasCollisions(set));

  return issues;
}
