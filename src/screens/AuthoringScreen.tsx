import { useState } from 'react';
import { normalize } from '../game/answerMatcher';
import { MULTIPLIER_LABELS } from '../game/gameTypes';
import type { Multiplier } from '../game/gameTypes';
import {
  cloneGameSet,
  createEmptyAnswer,
  createEmptyGameSet,
  createEmptyRound,
  duplicateRound,
} from '../content/gameSet';
import type { AnswerDefinition, RoundDefinition, SavedGameSet } from '../content/gameSet';
import { getGameSet, saveGameSet } from '../content/gameSetStore';
import { hasErrors, validateGameSet } from '../content/contentValidation';

const MULTIPLIERS: Multiplier[] = [1, 2, 3];

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

type AliasListProps = {
  aliases: string[];
  onChange: (aliases: string[]) => void;
};

function AliasList({ aliases, onChange }: AliasListProps) {
  const [draft, setDraft] = useState('');

  function addAlias() {
    const value = draft.trim();
    if (value === '') return;
    const norm = normalize(value);
    if (aliases.some((alias) => normalize(alias) === norm)) {
      setDraft('');
      return;
    }
    onChange([...aliases, value]);
    setDraft('');
  }

  return (
    <div className="alias-editor">
      <span className="alias-label">Aliases</span>
      {aliases.map((alias, index) => (
        <span key={`${index}-${alias}`} className="alias-chip">
          {alias}
          <button
            type="button"
            aria-label={`Remove alias ${alias}`}
            onClick={() => onChange(aliases.filter((_, i) => i !== index))}
          >
            ✕
          </button>
        </span>
      ))}
      <span className="alias-add">
        <input
          type="text"
          value={draft}
          placeholder="Add alias"
          aria-label="Add alias"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addAlias();
            }
          }}
        />
        <button type="button" onClick={addAlias}>
          + Add
        </button>
      </span>
    </div>
  );
}

type AnswerRowProps = {
  answer: AnswerDefinition;
  index: number;
  count: number;
  onChange: (answer: AnswerDefinition) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
};

function AnswerRow({ answer, index, count, onChange, onRemove, onMove }: AnswerRowProps) {
  return (
    <div className="answer-row">
      <span className="answer-number">{index + 1}</span>
      <input
        type="text"
        className="answer-text-input"
        value={answer.text}
        aria-label={`Answer ${index + 1} text`}
        placeholder="Answer text"
        onChange={(event) => onChange({ ...answer, text: event.target.value })}
      />
      <input
        type="number"
        className="answer-points-input"
        value={answer.points}
        min={0}
        max={999}
        step={1}
        aria-label={`Answer ${index + 1} points`}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange({ ...answer, points: Number.isFinite(parsed) ? parsed : 0 });
        }}
      />
      <div className="row-controls">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Move answer ${index + 1} up`}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label={`Move answer ${index + 1} down`}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove answer ${index + 1}`}
        >
          ✕
        </button>
      </div>
      <div className="answer-row-full">
        <AliasList
          aliases={answer.aliases}
          onChange={(aliases) => onChange({ ...answer, aliases })}
        />
      </div>
    </div>
  );
}

type Props = {
  setId: string | null;
  onReturn: () => void;
};

export default function AuthoringScreen({ setId, onReturn }: Props) {
  const [draft, setDraft] = useState<SavedGameSet>(() => {
    if (setId === null) return createEmptyGameSet();
    const existing = getGameSet(setId);
    return existing ? cloneGameSet(existing) : createEmptyGameSet();
  });
  const [editingRoundId, setEditingRoundId] = useState<string | null>(draft.rounds[0]?.id ?? null);

  const issues = validateGameSet(draft);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const canSave = !hasErrors(issues);

  const editingRound = draft.rounds.find((round) => round.id === editingRoundId) ?? null;

  function updateField<K extends keyof SavedGameSet>(key: K, value: SavedGameSet[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateRound(roundId: string, updater: (round: RoundDefinition) => RoundDefinition) {
    setDraft((current) => ({
      ...current,
      rounds: current.rounds.map((round) => (round.id === roundId ? updater(round) : round)),
    }));
  }

  function updateAnswer(
    roundId: string,
    answerId: string,
    updater: (answer: AnswerDefinition) => AnswerDefinition,
  ) {
    updateRound(roundId, (round) => ({
      ...round,
      answers: round.answers.map((answer) =>
        answer.id === answerId ? updater(answer) : answer,
      ),
    }));
  }

  function addRound() {
    const round = createEmptyRound();
    setDraft((current) => ({ ...current, rounds: [...current.rounds, round] }));
    setEditingRoundId(round.id);
  }

  function removeRound(roundId: string) {
    setDraft((current) => ({
      ...current,
      rounds: current.rounds.filter((round) => round.id !== roundId),
    }));
    if (editingRoundId === roundId) {
      setEditingRoundId(null);
    }
  }

  function duplicateCurrentRound(roundId: string) {
    const source = draft.rounds.find((round) => round.id === roundId);
    if (!source) return;
    const copy = duplicateRound(source);
    const index = draft.rounds.findIndex((round) => round.id === roundId);
    const rounds = [...draft.rounds];
    rounds.splice(index + 1, 0, copy);
    setDraft((current) => ({ ...current, rounds }));
    setEditingRoundId(copy.id);
  }

  function moveRound(index: number, direction: -1 | 1) {
    const rounds = moveItem(draft.rounds, index, direction);
    setDraft((current) => ({ ...current, rounds }));
  }

  function addAnswer(roundId: string) {
    updateRound(roundId, (round) => ({
      ...round,
      answers: [...round.answers, createEmptyAnswer()],
    }));
  }

  function removeAnswer(roundId: string, answerId: string) {
    updateRound(roundId, (round) => ({
      ...round,
      answers: round.answers.filter((answer) => answer.id !== answerId),
    }));
  }

  function moveAnswer(roundId: string, index: number, direction: -1 | 1) {
    updateRound(roundId, (round) => ({
      ...round,
      answers: moveItem(round.answers, index, direction),
    }));
  }

  function persist(andReturn: boolean) {
    if (!canSave) return;
    const updated: SavedGameSet = { ...draft, updatedAt: new Date().toISOString() };
    saveGameSet(updated);
    setDraft(updated);
    if (andReturn) onReturn();
  }

  return (
    <div className="authoring-screen">
      <header className="authoring-header">
        <div>
          <h1 className="authoring-title">Game Authoring</h1>
          <p className="authoring-subtitle">Create and edit a Class Feud game set.</p>
        </div>
        <button type="button" onClick={onReturn}>
          ← Back to Library
        </button>
      </header>

      <section className="authoring-section">
        <div className="field">
          <label className="field-label" htmlFor="game-title">
            Game Title
          </label>
          <input
            id="game-title"
            type="text"
            className="field-input field-input--lg"
            value={draft.title}
            placeholder="e.g. Fractions Review"
            onChange={(event) => updateField('title', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="game-description">
            Description (optional)
          </label>
          <textarea
            id="game-description"
            className="field-input"
            rows={2}
            value={draft.description}
            placeholder="A short note about this game…"
            onChange={(event) => updateField('description', event.target.value)}
          />
        </div>
      </section>

      {issues.length > 0 ? (
        <section className="validation-summary" aria-label="Validation issues">
          {errors.length > 0 ? (
            <ul className="issue-list">
              {errors.map((issue, index) => (
                <li key={index} className="issue issue--error">
                  <span className="issue-mark">✕</span> {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="issue-list">
              {warnings.map((issue, index) => (
                <li key={index} className="issue issue--warning">
                  <span className="issue-mark">⚠</span> {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="authoring-section">
        <div className="authoring-section-head">
          <h2>Rounds</h2>
          <button type="button" onClick={addRound}>
            + Add Round
          </button>
        </div>

        {draft.rounds.length === 0 ? (
          <p className="authoring-empty">No rounds yet. Add a round to get started.</p>
        ) : (
          <div className="round-list">
            {draft.rounds.map((round, index) => (
              <div
                key={round.id}
                className={
                  round.id === editingRoundId ? 'round-row round-row--active' : 'round-row'
                }
              >
                <span className="round-order">{index + 1}</span>
                <button
                  type="button"
                  className="round-row-main"
                  onClick={() => setEditingRoundId(round.id)}
                >
                  <span className="round-row-title">{round.title || 'Untitled round'}</span>
                  <span className="round-row-meta">
                    {round.category || 'No category'} · {round.answers.length} answers ·{' '}
                    {MULTIPLIER_LABELS[round.multiplier]}
                  </span>
                </button>
                <div className="row-controls">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveRound(index, -1)}
                    aria-label={`Move round ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.rounds.length - 1}
                    onClick={() => moveRound(index, 1)}
                    aria-label={`Move round ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateCurrentRound(round.id)}
                    aria-label={`Duplicate round ${round.title || index + 1}`}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRound(round.id)}
                    aria-label={`Remove round ${round.title || index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingRound ? (
        <section className="round-editor">
          <h3 className="round-editor-title">Edit Round {draft.rounds.findIndex((r) => r.id === editingRound.id) + 1}</h3>

          <div className="field">
            <label className="field-label" htmlFor="round-title">
              Round Title
            </label>
            <input
              id="round-title"
              type="text"
              className="field-input"
              value={editingRound.title}
              placeholder="e.g. Parts of a Plant"
              onChange={(event) => updateRound(editingRound.id, (r) => ({ ...r, title: event.target.value }))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="round-category">
              Category
            </label>
            <input
              id="round-category"
              type="text"
              className="field-input"
              value={editingRound.category}
              placeholder="e.g. Science"
              onChange={(event) => updateRound(editingRound.id, (r) => ({ ...r, category: event.target.value }))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="round-prompt">
              Question
            </label>
            <input
              id="round-prompt"
              type="text"
              className="field-input field-input--lg"
              value={editingRound.prompt}
              placeholder="e.g. Name a part of a plant."
              onChange={(event) => updateRound(editingRound.id, (r) => ({ ...r, prompt: event.target.value }))}
            />
          </div>

          <div className="field">
            <span className="field-label" id="round-multiplier-label">
              Multiplier
            </span>
            <div className="multiplier-picker" role="group" aria-labelledby="round-multiplier-label">
              {MULTIPLIERS.map((multiplier) => (
                <button
                  key={multiplier}
                  type="button"
                  className={
                    editingRound.multiplier === multiplier
                      ? 'mult-option mult-option--on'
                      : 'mult-option'
                  }
                  aria-pressed={editingRound.multiplier === multiplier}
                  onClick={() => updateRound(editingRound.id, (r) => ({ ...r, multiplier }))}
                >
                  {multiplier}×
                </button>
              ))}
            </div>
          </div>

          <div className="answers-editor">
            <div className="answers-editor-head">
              <span className="field-label">Answers</span>
              <button type="button" onClick={() => addAnswer(editingRound.id)}>
                + Add Answer
              </button>
            </div>
            {editingRound.answers.map((answer, index) => (
              <AnswerRow
                key={answer.id}
                answer={answer}
                index={index}
                count={editingRound.answers.length}
                onChange={(next) => updateAnswer(editingRound.id, answer.id, () => next)}
                onRemove={() => removeAnswer(editingRound.id, answer.id)}
                onMove={(direction) => moveAnswer(editingRound.id, index, direction)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="authoring-footer">
        <button type="button" onClick={() => onReturn()}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canSave}
          onClick={() => persist(false)}
        >
          Save
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canSave}
          onClick={() => persist(true)}
        >
          Save &amp; Return
        </button>
      </footer>
    </div>
  );
}
