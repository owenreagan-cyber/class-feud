import type { FeudAnswer } from './gameTypes';

/**
 * Deterministic, advisory answer matching.
 *
 * The matcher never mutates game state and never triggers gameplay actions.
 * It only *suggests*; the teacher confirms every reveal/strike/steal through
 * the existing reducer actions. This keeps the reducer the sole authority over
 * scoring and phase transitions.
 */

export type MatchQuality =
  | 'exact'
  | 'alias'
  | 'normalized'
  | 'fuzzy'
  | 'ambiguous'
  | 'alreadyRevealed'
  | 'none';

export type AnswerMatchResult = {
  quality: MatchQuality;
  /** The guess exactly as the teacher typed it (trimmed). */
  guess: string;
  /** Single best answer when one exists; otherwise null. */
  answerId: string | null;
  /** Candidate answer ids when the result is `ambiguous`. */
  candidateIds: string[];
  /** Fuzzy similarity (0..1) when quality is `fuzzy`; otherwise null. */
  confidence: number | null;
};

/**
 * Conservative normalization. Does not stem or rewrite meaning.
 * - trims and lowercases
 * - normalizes curly quotes/apostrophes to straight forms
 * - collapses repeated whitespace
 * - strips surrounding quotes and trailing punctuation
 */
export function normalize(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  value = value.replace(/\s+/g, ' ');
  value = value.replace(/^['"]+|['"]+$/g, '');
  value = value.replace(/[.,!?;:]+$/, '');
  return value.trim();
}

/** Optimal string alignment (Damerau-Levenshtein) distance. */
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) d[i][0] = i;
  for (let j = 0; j <= n; j += 1) d[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[m][n];
}

/** Max tolerated edit distance for a candidate of the given length. */
function fuzzyThreshold(maxLength: number): number {
  if (maxLength <= 3) return 0; // too short: require an exact/alias/normalized hit
  if (maxLength <= 5) return 1;
  if (maxLength <= 9) return 2;
  return 3;
}

type NormalizedAnswer = {
  answer: FeudAnswer;
  text: string;
  aliases: string[];
};

function prepare(answers: FeudAnswer[]): NormalizedAnswer[] {
  return answers.map((answer) => ({
    answer,
    text: normalize(answer.text),
    aliases: answer.aliases.map(normalize),
  }));
}

function rawEquals(guess: string, value: string): boolean {
  return guess.toLowerCase() === value.toLowerCase();
}

/** Collect the ids of every unrevealed answer that satisfies a predicate. */
function collectIds(
  entries: NormalizedAnswer[],
  predicate: (entry: NormalizedAnswer) => boolean,
): string[] {
  return entries.filter((entry) => !entry.answer.revealed && predicate(entry)).map((entry) => entry.answer.id);
}

type FuzzyResult = { ids: string[]; confidence: number | null };

function bestFuzzy(norm: string, entries: NormalizedAnswer[]): FuzzyResult {
  let bestDist = Infinity;
  let bestLen = 0;
  let ids: string[] = [];

  for (const entry of entries) {
    if (entry.answer.revealed) continue; // fuzzy only suggests unrevealed answers
    for (const candidate of [entry.text, ...entry.aliases]) {
      if (candidate === '') continue;
      const maxLen = Math.max(norm.length, candidate.length);
      if (fuzzyThreshold(maxLen) === 0) continue;
      const dist = damerauLevenshtein(norm, candidate);
      if (dist <= fuzzyThreshold(maxLen)) {
        if (dist < bestDist) {
          bestDist = dist;
          bestLen = maxLen;
          ids = [entry.answer.id];
        } else if (dist === bestDist) {
          bestLen = Math.max(bestLen, maxLen);
          if (!ids.includes(entry.answer.id)) ids.push(entry.answer.id);
        }
      }
    }
  }

  if (ids.length === 0) return { ids: [], confidence: null };
  const confidence = Math.round((1 - bestDist / Math.max(bestLen, 1)) * 1000) / 1000;
  return { ids, confidence };
}

function result(quality: MatchQuality, guess: string, answerId: string | null = null, candidateIds: string[] = [], confidence: number | null = null): AnswerMatchResult {
  return { quality, guess, answerId, candidateIds, confidence };
}

/**
 * Evaluate a student guess against the current round's answers.
 *
 * Priority (deterministic):
 *   1. already-revealed answer (exact / alias / normalized)
 *   2. exact canonical
 *   3. exact alias
 *   4. normalized canonical
 *   5. normalized alias
 *   6. conservative fuzzy
 *   7. ambiguous (multiple candidates at the same tier)
 *   8. none
 */
export function matchAnswer(guess: string, answers: FeudAnswer[]): AnswerMatchResult {
  const trimmed = guess.trim();
  if (trimmed === '') return result('none', trimmed);

  const norm = normalize(trimmed);
  if (norm === '') return result('none', trimmed);

  const entries = prepare(answers);

  // 1. Already-revealed detection.
  const revealed = entries.find(
    (entry) =>
      entry.answer.revealed &&
      (entry.text === norm || entry.aliases.includes(norm) || rawEquals(trimmed, entry.answer.text) || entry.answer.aliases.some((a) => rawEquals(trimmed, a))),
  );
  if (revealed) return result('alreadyRevealed', trimmed, revealed.answer.id);

  // 2. Exact canonical (case-insensitive).
  const exact = collectIds(entries, (entry) => rawEquals(trimmed, entry.answer.text));
  if (exact.length === 1) return result('exact', trimmed, exact[0]);
  if (exact.length > 1) return result('ambiguous', trimmed, null, exact);

  // 3. Exact alias (case-insensitive).
  const alias = collectIds(entries, (entry) => entry.answer.aliases.some((a) => rawEquals(trimmed, a)));
  if (alias.length === 1) return result('alias', trimmed, alias[0]);
  if (alias.length > 1) return result('ambiguous', trimmed, null, alias);

  // 4. Normalized canonical.
  const normCanon = collectIds(entries, (entry) => entry.text === norm);
  if (normCanon.length === 1) return result('normalized', trimmed, normCanon[0]);
  if (normCanon.length > 1) return result('ambiguous', trimmed, null, normCanon);

  // 5. Normalized alias.
  const normAlias = collectIds(entries, (entry) => entry.aliases.includes(norm));
  if (normAlias.length === 1) return result('normalized', trimmed, normAlias[0]);
  if (normAlias.length > 1) return result('ambiguous', trimmed, null, normAlias);

  // 6. Fuzzy.
  const fuzzy = bestFuzzy(norm, entries);
  if (fuzzy.ids.length === 1) return result('fuzzy', trimmed, fuzzy.ids[0], [], fuzzy.confidence);
  if (fuzzy.ids.length > 1) return result('ambiguous', trimmed, null, fuzzy.ids);

  return result('none', trimmed);
}
