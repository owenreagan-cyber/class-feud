import { useState } from 'react';
import { normalize } from '../../game/answerMatcher';
import {
  BRAIN_BLITZ_MAX_TARGET,
  BRAIN_BLITZ_MAX_TIMER_SECONDS,
  BRAIN_BLITZ_MIN_TARGET,
  BRAIN_BLITZ_MIN_TIMER_SECONDS,
} from '../../game/brainBlitzTypes';
import type {
  BrainBlitzAnswer,
  BrainBlitzConfig,
  BrainBlitzQuestion,
} from '../../game/brainBlitzTypes';
import { createEmptyBrainBlitzAnswer, createEmptyBrainBlitzQuestion } from '../../content/gameSet';

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

type AliasEditorProps = {
  aliases: string[];
  onChange: (aliases: string[]) => void;
};

function AliasEditor({ aliases, onChange }: AliasEditorProps) {
  const [draft, setDraft] = useState('');

  function addAlias() {
    const value = draft.trim();
    if (value === '') return;
    if (aliases.some((alias) => normalize(alias) === normalize(value))) {
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

type AnswerEditorProps = {
  answer: BrainBlitzAnswer;
  index: number;
  count: number;
  onChange: (answer: BrainBlitzAnswer) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
};

function AnswerEditor({ answer, index, count, onChange, onRemove, onMove }: AnswerEditorProps) {
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
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move answer ${index + 1} up`}>
          ↑
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move answer ${index + 1} down`}>
          ↓
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove answer ${index + 1}`}>
          ✕
        </button>
      </div>
      <div className="answer-row-full">
        <AliasEditor aliases={answer.aliases} onChange={(aliases) => onChange({ ...answer, aliases })} />
      </div>
    </div>
  );
}

type Props = {
  config: BrainBlitzConfig;
  onChange: (config: BrainBlitzConfig) => void;
};

export default function BrainBlitzAuthoring({ config, onChange }: Props) {
  function updateQuestion(questionId: string, updater: (q: BrainBlitzQuestion) => BrainBlitzQuestion) {
    onChange({
      ...config,
      questions: config.questions.map((q) => (q.id === questionId ? updater(q) : q)),
    });
  }

  function updateAnswer(
    questionId: string,
    answerId: string,
    updater: (a: BrainBlitzAnswer) => BrainBlitzAnswer,
  ) {
    updateQuestion(questionId, (q) => ({
      ...q,
      answers: q.answers.map((a) => (a.id === answerId ? updater(a) : a)),
    }));
  }

  function addQuestion() {
    const q = createEmptyBrainBlitzQuestion();
    onChange({ ...config, questions: [...config.questions, q] });
  }

  function removeQuestion(questionId: string) {
    onChange({ ...config, questions: config.questions.filter((q) => q.id !== questionId) });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    onChange({ ...config, questions: moveItem(config.questions, index, direction) });
  }

  function addAnswer(questionId: string) {
    updateQuestion(questionId, (q) => ({ ...q, answers: [...q.answers, createEmptyBrainBlitzAnswer()] }));
  }

  function removeAnswer(questionId: string, answerId: string) {
    updateQuestion(questionId, (q) => ({ ...q, answers: q.answers.filter((a) => a.id !== answerId) }));
  }

  function moveAnswer(questionId: string, index: number, direction: -1 | 1) {
    updateQuestion(questionId, (q) => ({ ...q, answers: moveItem(q.answers, index, direction) }));
  }

  return (
    <section className="authoring-section" aria-label="Brain Blitz final round">
      <div className="authoring-section-head">
        <h2>Brain Blitz Final Round</h2>
      </div>

      <label className="bb-enable">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        Enable Brain Blitz
      </label>

      {config.enabled && (
        <>
          <div className="bb-config-row">
            <div className="field">
              <label className="field-label" htmlFor="blitz-timer">
                Timer (seconds)
              </label>
              <input
                id="blitz-timer"
                type="number"
                className="field-input"
                value={config.timerSeconds}
                min={BRAIN_BLITZ_MIN_TIMER_SECONDS}
                max={BRAIN_BLITZ_MAX_TIMER_SECONDS}
                step={1}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onChange({ ...config, timerSeconds: Number.isFinite(parsed) ? parsed : config.timerSeconds });
                }}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="blitz-target">
                Target Score
              </label>
              <input
                id="blitz-target"
                type="number"
                className="field-input"
                value={config.targetScore}
                min={BRAIN_BLITZ_MIN_TARGET}
                max={BRAIN_BLITZ_MAX_TARGET}
                step={1}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onChange({ ...config, targetScore: Number.isFinite(parsed) ? parsed : config.targetScore });
                }}
              />
            </div>
          </div>

          <div className="answers-editor">
            <div className="answers-editor-head">
              <span className="field-label">Questions</span>
              <button type="button" onClick={addQuestion}>
                + Add Question
              </button>
            </div>

            {config.questions.map((question, index) => (
              <div key={question.id} className="bb-question-card">
                <div className="bb-question-head">
                  <span className="round-order">{index + 1}</span>
                  <input
                    type="text"
                    className="answer-text-input"
                    value={question.prompt}
                    aria-label={`Question ${index + 1} prompt`}
                    placeholder="Question prompt (e.g. Name a punctuation mark.)"
                    onChange={(event) =>
                      updateQuestion(question.id, (q) => ({ ...q, prompt: event.target.value }))
                    }
                  />
                  <input
                    type="text"
                    className="answer-text-input bb-question-category"
                    value={question.category ?? ''}
                    aria-label={`Question ${index + 1} category`}
                    placeholder="Category"
                    onChange={(event) =>
                      updateQuestion(question.id, (q) => ({ ...q, category: event.target.value }))
                    }
                  />
                  <div className="row-controls">
                    <button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} aria-label={`Move question ${index + 1} up`}>
                      ↑
                    </button>
                    <button type="button" disabled={index === config.questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label={`Move question ${index + 1} down`}>
                      ↓
                    </button>
                    <button type="button" onClick={() => removeQuestion(question.id)} aria-label={`Remove question ${index + 1}`}>
                      ✕
                    </button>
                  </div>
                </div>

                <div className="answers-editor">
                  <div className="answers-editor-head">
                    <span className="field-label">Answers</span>
                    <button type="button" onClick={() => addAnswer(question.id)}>
                      + Add Answer
                    </button>
                  </div>
                  {question.answers.map((answer, aIndex) => (
                    <AnswerEditor
                      key={answer.id}
                      answer={answer}
                      index={aIndex}
                      count={question.answers.length}
                      onChange={(next) => updateAnswer(question.id, answer.id, () => next)}
                      onRemove={() => removeAnswer(question.id, answer.id)}
                      onMove={(direction) => moveAnswer(question.id, aIndex, direction)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
