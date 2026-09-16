import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import {
  getBrainBlitzCurrentQuestion,
  getBrainBlitzFinalistTeam,
  getBrainBlitzTotalScore,
  getBrainBlitzAchieved,
  isBrainBlitzAnswerUsedByPlayer1,
} from '../../game/gameSelectors';
import { matchAnswer } from '../../game/answerMatcher';
import type { AnswerMatchResult, MatchQuality } from '../../game/answerMatcher';
import type { FeudAnswer, GameAction, GameState, Team } from '../../game/gameTypes';
import type { BrainBlitzAnswer, BrainBlitzQuestion, BrainBlitzStatus } from '../../game/brainBlitzTypes';

const QUALITY_LABEL: Record<MatchQuality, string> = {
  exact: 'Exact match',
  alias: 'Exact alias match',
  normalized: 'Normalized match',
  fuzzy: 'Spelling appears close',
  ambiguous: 'Multiple possible matches',
  alreadyRevealed: 'Already on the board',
  none: 'No match found',
};

function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Adapt Brain Blitz answers to the runtime answer shape the matcher expects. */
function matchBrainBlitz(guess: string, question: BrainBlitzQuestion): AnswerMatchResult {
  const answers: FeudAnswer[] = question.answers.map((answer) => ({
    ...answer,
    revealed: false,
  }));
  return matchAnswer(guess, answers);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="console-section">
      <h3>{title}</h3>
      <div className="console-section-body">{children}</div>
    </section>
  );
}

function TeamButton({
  team,
  label,
  onClick,
  active,
}: {
  team: Team;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={active ? 'team-pick team-pick--active' : 'team-pick'}
      onClick={onClick}
      style={{ '--team-color': team.color } as CSSProperties}
    >
      <span className="team-pick-dot" />
      {label}
    </button>
  );
}

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
};

export default function BrainBlitzTeacherControls({ state, dispatch }: Props) {
  const blitz = state.brainBlitz;
  const status: BrainBlitzStatus | null = blitz?.status ?? null;
  const finalist = getBrainBlitzFinalistTeam(state);
  const question = getBrainBlitzCurrentQuestion(state);

  const [guess, setGuess] = useState('');
  const [match, setMatch] = useState<AnswerMatchResult | null>(null);
  const [choosing, setChoosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset transient entry state when the live question/status changes.
  const key = `${status}:${blitz?.currentQuestionIndex ?? 0}`;
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setGuess('');
    setMatch(null);
    setChoosing(false);
  }

  const active = status === 'player1Active' || status === 'player2Active';
  const isPlayer2 = status === 'player2Active';

  function clearMatch() {
    setGuess('');
    setMatch(null);
    setChoosing(false);
  }

  function evaluate() {
    if (guess.trim() === '' || !question) return;
    setMatch(matchBrainBlitz(guess, question));
    setChoosing(false);
  }

  function resolve(rawResponse: string, resolution: 'accepted' | 'noMatch' | 'skipped', answerId?: string) {
    dispatch({ type: 'BRAIN_BLITZ_RESOLVE', rawResponse, resolution, answerId });
    setGuess('');
    setMatch(null);
    setChoosing(false);
  }

  // Classroom-speed keyboard shortcuts for Brain Blitz. Safe: gated on focus.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        clearMatch();
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTyping) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Enter') {
        evaluate();
        return;
      }
      if (event.key === 'u' || event.key === 'U') {
        dispatch({ type: 'UNDO' });
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        // Space only advances from a safe "ready" state — never auto-resolves.
        if (status === 'player1Ready' || status === 'player2Ready') {
          dispatch({ type: 'BRAIN_BLITZ_BEGIN_PLAYER' });
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, guess, question, dispatch]);

  if (!blitz || !status) return null;

  const renderActiveMatch = () => {
    if (!question) return null;
    const matchedAnswer = match?.answerId
      ? question.answers.find((a) => a.id === match.answerId)
      : null;
    const candidates = (match?.candidateIds ?? [])
      .map((id) => question.answers.find((a) => a.id === id))
      .filter((a): a is BrainBlitzAnswer => a !== undefined);
    const strong =
      match?.quality === 'exact' || match?.quality === 'alias' || match?.quality === 'normalized';
    const isDuplicate =
      isPlayer2 &&
      !!match?.answerId &&
      isBrainBlitzAnswerUsedByPlayer1(state, question.id, match.answerId);

    return (
      <div
        className="match-panel"
        role="status"
        aria-live="polite"
        data-quality={match?.quality ?? 'none'}
      >
        {(strong || match?.quality === 'fuzzy') && matchedAnswer && (
          <>
            <div className="match-headline">{strong ? 'Likely match' : 'Possible match'}</div>
            <div className="match-answer">{matchedAnswer.text}</div>
            <div className="match-quality">
              {QUALITY_LABEL[match!.quality]}
              {match!.quality === 'fuzzy' && match!.confidence !== null
                ? ` (${Math.round(match!.confidence * 100)}%)`
                : ''}
            </div>
            {isDuplicate && (
              <div className="bb-duplicate" role="alert">
                Already used by Player 1 — scores 0 for this question.
              </div>
            )}
            <div className="button-row">
              <button
                className="success"
                onClick={() => resolve(guess, 'accepted', matchedAnswer.id)}
              >
                {isDuplicate ? 'Accept (duplicate)' : `Accept ${matchedAnswer.text}`}
              </button>
              <button className="danger" onClick={() => resolve(guess, 'noMatch')}>
                No Match
              </button>
              <button onClick={() => setChoosing(true)}>Choose Answer</button>
              <button onClick={() => resolve(guess, 'skipped')}>Skip</button>
            </div>
          </>
        )}

        {match?.quality === 'ambiguous' && (
          <>
            <div className="match-headline">Possible matches</div>
            <div className="match-quality">{QUALITY_LABEL.ambiguous}</div>
            <div className="candidate-list">
              {candidates.map((candidate) => {
                const dup = isBrainBlitzAnswerUsedByPlayer1(state, question.id, candidate.id);
                return (
                  <button
                    key={candidate.id}
                    className="success"
                    onClick={() => resolve(guess, 'accepted', candidate.id)}
                  >
                    {dup ? 'Duplicate: ' : ''}
                    {candidate.text} · {candidate.points}
                  </button>
                );
              })}
            </div>
            <div className="button-row">
              <button className="danger" onClick={() => resolve(guess, 'noMatch')}>
                No Match
              </button>
              <button onClick={() => resolve(guess, 'skipped')}>Skip</button>
              <button onClick={() => setChoosing(true)}>Choose Answer</button>
            </div>
          </>
        )}

        {match?.quality === 'none' && (
          <>
            <div className="match-headline">No match found</div>
            <div className="button-row">
              <button className="danger" onClick={() => resolve(guess, 'noMatch')}>
                No Match
              </button>
              <button onClick={() => resolve(guess, 'skipped')}>Skip</button>
              <button onClick={() => setChoosing(true)}>Choose Answer</button>
            </div>
          </>
        )}
      </div>
    );
  };

  // -------- Setup --------
  if (status === 'setup') {
    return (
      <>
        <Section title="Brain Blitz finalist">
          {finalist ? (
            <div className="console-hint">Finalist: {finalist.name}</div>
          ) : (
            <>
              <div className="console-hint">Choose Brain Blitz finalist:</div>
              <div className="team-pick-grid">
                {state.teams.map((team) => (
                  <TeamButton
                    key={team.id}
                    team={team}
                    label={team.name}
                    onClick={() => dispatch({ type: 'BRAIN_BLITZ_SET_FINALIST', teamId: team.id })}
                  />
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="Player mode">
          <div className="button-row">
            <button
              className="primary"
              disabled={!finalist}
              onClick={() => dispatch({ type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'one' })}
            >
              One Player
            </button>
            <button
              className="primary"
              disabled={!finalist}
              onClick={() => dispatch({ type: 'BRAIN_BLITZ_SET_PLAYER_MODE', playerMode: 'two' })}
            >
              Two Players
            </button>
          </div>
        </Section>
      </>
    );
  }

  // -------- Ready states --------
  if (status === 'player1Ready' || status === 'player2Ready') {
    const playerLabel = status === 'player1Ready' ? 'Player 1' : 'Player 2';
    return (
      <Section title={`${playerLabel} ready`}>
        <div className="console-hint">
          {question ? `Up next: "${question.prompt}"` : 'Questions ready.'}
        </div>
        <div className="button-row">
          <button
            className="primary"
            onClick={() => dispatch({ type: 'BRAIN_BLITZ_BEGIN_PLAYER' })}
          >
            Start {playerLabel}
          </button>
        </div>
      </Section>
    );
  }

  // -------- Active states --------
  if (active && question) {
    return (
      <>
        <Section title={`${isPlayer2 ? 'Player 2' : 'Player 1'} · Question ${blitz.currentQuestionIndex + 1}`}>
          <div className="console-hint">{question.prompt}</div>
          <div className="bb-timer-row" aria-label="Brain Blitz timer">
            <span className="bb-timer-value" aria-label={`${formatSeconds(blitz.remainingSeconds)} remaining`}>
              {formatSeconds(blitz.remainingSeconds)}
            </span>
            {blitz.timerExpired ? <span className="bb-expired">Time's up</span> : null}
            <div className="button-row">
              {blitz.timerRunning ? (
                <button onClick={() => dispatch({ type: 'BRAIN_BLITZ_PAUSE' })}>Pause</button>
              ) : (
                <button onClick={() => dispatch({ type: 'BRAIN_BLITZ_RESUME' })}>Resume</button>
              )}
              <button className="danger" onClick={() => dispatch({ type: 'BRAIN_BLITZ_END_PLAYER' })}>
                End Player
              </button>
            </div>
          </div>
        </Section>

        <Section title="Student response">
          <label className="guess-label" htmlFor="blitz-guess">
            Student Response
          </label>
          <div className="guess-row">
            <input
              id="blitz-guess"
              ref={inputRef}
              type="text"
              value={guess}
              autoComplete="off"
              placeholder="Type a student's answer…"
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  evaluate();
                }
              }}
            />
            <button className="primary" onClick={evaluate}>
              Evaluate
            </button>
          </div>
          {match && renderActiveMatch()}
          {choosing && (
            <div className="candidate-list">
              {question.answers.map((answer) => {
                const dup = isBrainBlitzAnswerUsedByPlayer1(state, question.id, answer.id);
                return (
                  <button
                    key={answer.id}
                    className="success"
                    onClick={() => resolve(guess, 'accepted', answer.id)}
                  >
                    {dup ? 'Duplicate: ' : ''}
                    {answer.text} · {answer.points}
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </>
    );
  }

  // -------- Player 1 complete (two-player only) --------
  if (status === 'player1Complete') {
    return (
      <Section title="Player 1 complete">
        <div className="console-hint">Player 1 score: {blitz.player1Score}</div>
        <div className="button-row">
          <button
            className="primary"
            onClick={() => dispatch({ type: 'BRAIN_BLITZ_NEXT_PLAYER' })}
          >
            Begin Player 2
          </button>
        </div>
      </Section>
    );
  }

  // -------- Complete --------
  if (status === 'complete') {
    const total = getBrainBlitzTotalScore(state);
    const achieved = getBrainBlitzAchieved(state);
    return (
      <Section title="Brain Blitz results">
        <div className="console-hint">
          {blitz.playerMode === 'two' ? (
            <>
              Player 1: {blitz.player1Score} · Player 2: {blitz.player2Score} · Total: {total}
            </>
          ) : (
            <>Total: {total}</>
          )}{' '}
          · Target: {blitz.targetScore}
        </div>
        <div className="console-hint">
          {achieved ? 'Target achieved — great run!' : 'Below target — great run!'}
        </div>
        <div className="button-row">
          <button className="primary" onClick={() => dispatch({ type: 'BRAIN_BLITZ_EXIT' })}>
            End Game
          </button>
        </div>
      </Section>
    );
  }

  return null;
}
