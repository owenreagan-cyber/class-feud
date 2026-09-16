import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, ReactNode } from 'react';
import {
  getActiveTeam,
  getAllRevealed,
  getCurrentRound,
  getEligibleStealTeams,
  getRevealedCount,
  getRoundValue,
  getRoundWinner,
  getStealTeam,
  getTiedTeams,
  getWinner,
} from '../../game/gameSelectors';
import { MAX_STRIKES, MULTIPLIER_LABELS, PHASE_LABELS } from '../../game/gameTypes';
import type { FeudAnswer, GameAction, GameState, Team } from '../../game/gameTypes';
import { matchAnswer } from '../../game/answerMatcher';
import type { AnswerMatchResult, MatchQuality } from '../../game/answerMatcher';
import { isBrainBlitzEnabled } from '../../game/brainBlitzTypes';
import BrainBlitzTeacherControls from './BrainBlitzTeacherControls';

const QUALITY_LABEL: Record<MatchQuality, string> = {
  exact: 'Exact match',
  alias: 'Exact alias match',
  normalized: 'Normalized match',
  fuzzy: 'Spelling appears close',
  ambiguous: 'Multiple possible matches',
  alreadyRevealed: 'Already on the board',
  none: 'No match found',
};

function ConsoleSection({ title, children }: { title: string; children: ReactNode }) {
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
  disabled,
}: {
  team: Team;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const className = ['team-pick', active ? 'team-pick--active' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={{ '--team-color': team.color } as CSSProperties}
    >
      <span className="team-pick-dot" />
      {label}
    </button>
  );
}

type MatchPanelProps = {
  match: AnswerMatchResult;
  phase: 'playing' | 'steal';
  answers: FeudAnswer[];
  onReveal: (answerId: string) => void;
  onStrike: () => void;
  onChooseAnother: () => void;
  onTryAgain: () => void;
  onStealSuccess: (answerId: string) => void;
  onStealFailed: () => void;
};

function MatchPanel({
  match,
  phase,
  answers,
  onReveal,
  onStrike,
  onChooseAnother,
  onTryAgain,
  onStealSuccess,
  onStealFailed,
}: MatchPanelProps) {
  const answer = match.answerId ? answers.find((a) => a.id === match.answerId) : null;
  const candidates = match.candidateIds
    .map((id) => answers.find((a) => a.id === id))
    .filter((a): a is FeudAnswer => a !== undefined);

  const isStrong = match.quality === 'exact' || match.quality === 'alias' || match.quality === 'normalized';

  return (
    <div className="match-panel" role="status" aria-live="polite" data-quality={match.quality}>
      {(isStrong || match.quality === 'fuzzy') && answer && (
        <>
          <div className="match-headline">{isStrong ? 'Likely match' : 'Possible match'}</div>
          <div className="match-answer">{answer.text}</div>
          <div className="match-quality">
            {QUALITY_LABEL[match.quality]}
            {match.quality === 'fuzzy' && match.confidence !== null
              ? ` (${Math.round(match.confidence * 100)}%)`
              : ''}
          </div>
          {phase === 'playing' ? (
            <div className="button-row">
              <button className="success" onClick={() => onReveal(match.answerId!)}>
                Reveal {answer.text}
              </button>
              <button className="danger" onClick={onStrike}>
                Mark Strike
              </button>
              <button onClick={onChooseAnother}>Choose Another</button>
            </div>
          ) : (
            <div className="button-row">
              <button className="success" onClick={() => onStealSuccess(match.answerId!)}>
                Steal Success + Reveal
              </button>
              <button className="danger" onClick={onStealFailed}>
                Steal Failed
              </button>
              <button onClick={onChooseAnother}>Choose Another</button>
            </div>
          )}
        </>
      )}

      {match.quality === 'ambiguous' && (
        <>
          <div className="match-headline">Possible matches</div>
          <div className="match-quality">{QUALITY_LABEL.ambiguous}</div>
          <div className="candidate-list">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                className="success"
                onClick={() =>
                  phase === 'playing' ? onReveal(candidate.id) : onStealSuccess(candidate.id)
                }
              >
                {phase === 'playing' ? 'Reveal' : 'Success + Reveal'} {candidate.text}
              </button>
            ))}
          </div>
          <div className="button-row">
            {phase === 'playing' ? (
              <button className="danger" onClick={onStrike}>
                Strike / No Match
              </button>
            ) : (
              <button className="danger" onClick={onStealFailed}>
                Steal Failed
              </button>
            )}
            <button onClick={onTryAgain}>Try Again</button>
          </div>
        </>
      )}

      {match.quality === 'alreadyRevealed' && (
        <>
          <div className="match-headline">Already on the board</div>
          <div className="match-answer">{answer?.text}</div>
          <div className="button-row">
            {phase === 'playing' ? (
              <button onClick={onTryAgain}>Clear / Continue</button>
            ) : (
              <>
                <button className="danger" onClick={onStealFailed}>
                  Steal Failed
                </button>
                <button onClick={onTryAgain}>Clear</button>
              </>
            )}
          </div>
        </>
      )}

      {match.quality === 'none' && (
        <>
          <div className="match-headline">No match found</div>
          <div className="button-row">
            {phase === 'playing' ? (
              <>
                <button className="danger" onClick={onStrike}>
                  Add Strike
                </button>
                <button onClick={onTryAgain}>Try Again</button>
              </>
            ) : (
              <>
                <button className="danger" onClick={onStealFailed}>
                  Steal Failed
                </button>
                <button onClick={onTryAgain}>Try Again</button>
              </>
            )}
          </div>
          {phase === 'playing' && (
            <div className="console-hint">Reveal an answer manually below.</div>
          )}
        </>
      )}
    </div>
  );
}

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
};

export default function TeacherGameView({ state, dispatch, canUndo }: Props) {
  const phase = state.phase;
  const activeTeam = getActiveTeam(state);
  const stealTeam = getStealTeam(state);
  const eligibleStealTeams = getEligibleStealTeams(state);
  const currentRound = getCurrentRound(state);
  const roundValue = getRoundValue(state);
  const revealedCount = getRevealedCount(state);
  const answerCount = currentRound.answers.length;
  const allRevealed = getAllRevealed(state);
  const roundWinner = getRoundWinner(state);
  const winner = getWinner(state);
  const tied = getTiedTeams(state);

  const [guess, setGuess] = useState('');
  const [match, setMatch] = useState<AnswerMatchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset transient entry state when the phase or round changes (derived-state
  // reset pattern, avoiding a synchronous setState inside an effect).
  const roundKey = `${state.phase}:${state.currentRoundIndex}`;
  const [prevRoundKey, setPrevRoundKey] = useState(roundKey);
  if (prevRoundKey !== roundKey) {
    setPrevRoundKey(roundKey);
    setGuess('');
    setMatch(null);
  }

  const clearMatch = () => {
    setGuess('');
    setMatch(null);
  };

  const chooseAnother = () => {
    setMatch(null);
    inputRef.current?.focus();
  };

  const tryAgain = () => {
    setGuess('');
    setMatch(null);
    inputRef.current?.focus();
  };

  const evaluate = () => {
    if (guess.trim() === '') return;
    setMatch(matchAnswer(guess, currentRound.answers));
  };

  const confirmReveal = (answerId: string) => {
    dispatch({ type: 'REVEAL_ANSWER', answerId });
    clearMatch();
  };

  const markStrike = () => {
    dispatch({ type: 'ADD_STRIKE' });
    clearMatch();
  };

  const confirmStealSuccess = (answerId: string) => {
    dispatch({ type: 'REVEAL_ANSWER', answerId });
    dispatch({ type: 'RESOLVE_STEAL', success: true });
    clearMatch();
  };

  const confirmStealFailed = () => {
    dispatch({ type: 'RESOLVE_STEAL', success: false });
    clearMatch();
  };

  // Classroom-speed keyboard shortcuts. Safe: gated on focus so typing works.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // During Brain Blitz the dedicated controls own the keyboard.
      if (phase === 'brainBlitz') return;

      if (event.key === 'Escape') {
        setGuess('');
        setMatch(null);
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

      if (event.key === 'u' || event.key === 'U') {
        dispatch({ type: 'UNDO' });
        return;
      }
      if (event.key === 'x') {
        dispatch({ type: 'ADD_STRIKE' });
        return;
      }
      if (event.key === 'X') {
        dispatch({ type: 'REMOVE_STRIKE' });
        return;
      }
      if (event.key >= '1' && event.key <= '9' && phase === 'playing') {
        const answer = currentRound.answers[Number(event.key) - 1];
        if (answer && !answer.revealed) {
          dispatch({ type: 'REVEAL_ANSWER', answerId: answer.id });
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, phase, currentRound.answers, state]);

  return (
    <div className="teacher-view">
      <div className="teacher-header">
        <h2>Teacher Controls</h2>
        <span className="console-phase">{PHASE_LABELS[phase]}</span>
        <span className="teacher-round-label">
          {currentRound.title} · {currentRound.category} ·{' '}
          {MULTIPLIER_LABELS[currentRound.multiplier]}
        </span>
      </div>

      <div className="teacher-body">
        {phase === 'brainBlitz' && <BrainBlitzTeacherControls state={state} dispatch={dispatch} />}

        {(phase === 'playing' || phase === 'steal') && (
          <ConsoleSection title="Student Guess">
            <label className="guess-label" htmlFor="student-guess">
              Student Guess
            </label>
            <div className="guess-row">
              <input
                id="student-guess"
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
            {match && (
              <MatchPanel
                match={match}
                phase={phase === 'playing' ? 'playing' : 'steal'}
                answers={currentRound.answers}
                onReveal={confirmReveal}
                onStrike={markStrike}
                onChooseAnother={chooseAnother}
                onTryAgain={tryAgain}
                onStealSuccess={confirmStealSuccess}
                onStealFailed={confirmStealFailed}
              />
            )}
          </ConsoleSection>
        )}

        {phase === 'tossup' && (
          <ConsoleSection title="Toss-up — give control to">
            <div className="team-pick-grid">
              {state.teams.map((team) => (
                <TeamButton
                  key={team.id}
                  team={team}
                  label={team.name}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', teamId: team.id })}
                />
              ))}
            </div>
          </ConsoleSection>
        )}

        {phase === 'playing' && (
          <>
            <ConsoleSection title={`Reveal answers (${revealedCount}/${answerCount})`}>
              {allRevealed && (
                <div className="console-hint">
                  All answers revealed — award the round or force a steal.
                </div>
              )}
              <div className="answer-buttons">
                {currentRound.answers.map((answer) => (
                  <button
                    key={answer.id}
                    className={answer.revealed ? 'revealed' : ''}
                    disabled={answer.revealed}
                    onClick={() => dispatch({ type: 'REVEAL_ANSWER', answerId: answer.id })}
                  >
                    {answer.revealed ? '✓ ' : ''}
                    {answer.text} · {answer.points}
                  </button>
                ))}
              </div>
            </ConsoleSection>

            <ConsoleSection title="Strikes">
              <div className="button-row">
                <button
                  disabled={state.strikes >= MAX_STRIKES}
                  onClick={() => dispatch({ type: 'ADD_STRIKE' })}
                >
                  Add Strike ({state.strikes}/{MAX_STRIKES})
                </button>
                <button
                  disabled={state.strikes === 0}
                  onClick={() => dispatch({ type: 'REMOVE_STRIKE' })}
                >
                  Remove Strike
                </button>
              </div>
            </ConsoleSection>

            <ConsoleSection title="Possession">
              <div className="team-pick-grid">
                {state.teams.map((team) => (
                  <TeamButton
                    key={team.id}
                    team={team}
                    label={`Give to ${team.name}`}
                    active={team.id === state.activeTeamId}
                    disabled={team.id === state.activeTeamId}
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', teamId: team.id })}
                  />
                ))}
              </div>
            </ConsoleSection>

            <ConsoleSection title="Round">
              <div className="button-row">
                <button
                  className="success"
                  onClick={() => dispatch({ type: 'AWARD_ROUND' })}
                >
                  Award Round — {activeTeam?.name ?? 'Active team'} +{roundValue}
                </button>
                <button onClick={() => dispatch({ type: 'START_STEAL' })}>
                  Force Steal
                </button>
              </div>
            </ConsoleSection>
          </>
        )}

        {phase === 'steal' && (
          <>
            <ConsoleSection title="Steal">
              {stealTeam === null ? (
                <>
                  <div className="console-hint">Choose the stealing team:</div>
                  <div className="team-pick-grid">
                    {eligibleStealTeams.map((team) => (
                      <TeamButton
                        key={team.id}
                        team={team}
                        label={`${team.name} steals`}
                        onClick={() => dispatch({ type: 'SET_STEAL_TEAM', teamId: team.id })}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="console-hint">
                    {stealTeam.name} steal attempt — pot {roundValue}
                  </div>
                  <div className="button-row">
                    <button className="danger" onClick={confirmStealFailed}>
                      Steal Failed — {activeTeam?.name ?? 'Controlling team'} +{roundValue}
                    </button>
                  </div>
                </>
              )}
            </ConsoleSection>

            <ConsoleSection title="Correction">
              <div className="button-row">
                <button
                  disabled={state.strikes === 0}
                  onClick={() => dispatch({ type: 'REMOVE_STRIKE' })}
                >
                  Remove Strike
                </button>
              </div>
            </ConsoleSection>
          </>
        )}

        {phase === 'roundOver' && (
          <ConsoleSection title="Round over">
            <div className="console-hint">
              {roundWinner
                ? `${roundWinner.name} won +${roundValue} points`
                : 'Round complete'}
            </div>
            <div className="standings">
              {state.teams.map((team) => (
                <span key={team.id} className="standing-row">
                  {team.name}: <strong>{team.score}</strong>
                </span>
              ))}
            </div>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => dispatch({ type: 'NEXT_ROUND' })}
              >
                Next Round
              </button>
              <button onClick={() => dispatch({ type: 'END_GAME' })}>End Game</button>
            </div>
          </ConsoleSection>
        )}

        {phase === 'gameOver' && (
          <ConsoleSection title="Game over">
            {tied.length > 0 ? (
              <div className="console-hint">
                Tie game — {tied.map((team) => team.name).join(', ')}
              </div>
            ) : (
              <div className="console-hint">{winner ? `${winner.name} wins!` : 'Game over'}</div>
            )}
            <div className="standings">
              {state.teams.map((team) => (
                <span key={team.id} className="standing-row">
                  {team.name}: <strong>{team.score}</strong>
                </span>
              ))}
            </div>
            {isBrainBlitzEnabled(state.brainBlitzConfig) && (
              <div className="button-row">
                <button
                  className="primary"
                  onClick={() => dispatch({ type: 'BRAIN_BLITZ_ENTER' })}
                >
                  Play Brain Blitz
                </button>
              </div>
            )}
            <div className="button-row">
              <button
                className="primary"
                onClick={() => dispatch({ type: 'START_GAME' })}
              >
                Play Again
              </button>
            </div>
          </ConsoleSection>
        )}
      </div>

      <div className="teacher-footer">
        <button disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}>
          Undo
        </button>
        <button className="danger" onClick={() => dispatch({ type: 'RESET_GAME' })}>
          Reset Game
        </button>
      </div>
    </div>
  );
}
