import type { Dispatch, ReactNode } from 'react';
import {
  getActiveTeam,
  getAllRevealed,
  getCurrentRound,
  getEligibleStealTeams,
  getNextTeam,
  getRevealedCount,
  getRoundValue,
  getStealTeam,
  getWinner,
} from '../../game/gameSelectors';
import { MAX_STRIKES, PHASE_LABELS } from '../../game/gameTypes';
import type { GameAction, GameState } from '../../game/gameTypes';

function ConsoleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="console-section">
      <h3>{title}</h3>
      <div className="console-section-body">{children}</div>
    </section>
  );
}

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
};

export default function TeacherConsole({ state, dispatch, canUndo }: Props) {
  const phase = state.phase;
  const activeTeam = getActiveTeam(state);
  const stealTeam = getStealTeam(state);
  const nextTeam = getNextTeam(state);
  const eligibleStealTeams = getEligibleStealTeams(state);
  const currentRound = getCurrentRound(state);
  const roundValue = getRoundValue(state);
  const revealedCount = getRevealedCount(state);
  const answerCount = currentRound.answers.length;
  const allRevealed = getAllRevealed(state);
  const roundLabel = `Round ${state.currentRoundIndex + 1} / ${state.rounds.length}`;

  return (
    <aside className="teacher-console">
      <div className="console-header">
        <h2>Teacher Console</h2>
        <span className="console-phase">{PHASE_LABELS[phase]}</span>
      </div>

      <div className="console-summary">
        <span>{roundLabel}</span>
        {activeTeam && (
          <span>
            Control: <strong>{activeTeam.name}</strong>
          </span>
        )}
        {phase === 'steal' && stealTeam && (
          <span>
            Stealing: <strong>{stealTeam.name}</strong>
          </span>
        )}
        <span>
          Pot: <strong>{roundValue}</strong>
        </span>
        <span>
          Strikes: <strong>
            {state.strikes}/{MAX_STRIKES}
          </strong>
        </span>
      </div>

      {phase === 'tossup' && (
        <ConsoleSection title="Who takes control?">
          {state.teams.map((team) => (
            <button
              key={team.id}
              className="control"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', teamId: team.id })}
            >
              {team.name} controls
            </button>
          ))}
        </ConsoleSection>
      )}

      {phase === 'playing' && (
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
      )}

      {(phase === 'playing' || phase === 'steal') && (
        <ConsoleSection title="Strikes">
          <div className="button-row">
            <button
              disabled={state.strikes >= MAX_STRIKES}
              onClick={() => dispatch({ type: 'ADD_STRIKE' })}
            >
              Add Strike
            </button>
            <button
              disabled={state.strikes === 0}
              onClick={() => dispatch({ type: 'REMOVE_STRIKE' })}
            >
              Remove Strike
            </button>
          </div>
        </ConsoleSection>
      )}

      {phase === 'playing' && nextTeam && (
        <ConsoleSection title="Possession">
          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', teamId: nextTeam.id })}
          >
            Switch to {nextTeam.name}
          </button>
        </ConsoleSection>
      )}

      {phase === 'steal' && (
        <ConsoleSection title="Resolve steal">
          {stealTeam === null && (
            <div className="console-hint">Choose the stealing team:</div>
          )}
          {stealTeam === null ? (
            eligibleStealTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => dispatch({ type: 'SET_STEAL_TEAM', teamId: team.id })}
              >
                {team.name} steals
              </button>
            ))
          ) : (
            <>
              <button
                className="success"
                onClick={() => dispatch({ type: 'RESOLVE_STEAL', success: true })}
              >
                Correct — {stealTeam.name} +{roundValue}
              </button>
              <button
                className="danger"
                onClick={() => dispatch({ type: 'RESOLVE_STEAL', success: false })}
              >
                Incorrect — {activeTeam?.name ?? 'Controlling team'} +{roundValue}
              </button>
            </>
          )}
        </ConsoleSection>
      )}

      {phase === 'playing' && (
        <ConsoleSection title="Round">
          <button
            className="success"
            onClick={() => dispatch({ type: 'AWARD_ROUND' })}
          >
            Award Round — {activeTeam?.name ?? 'Active team'} +{roundValue}
          </button>
          <button onClick={() => dispatch({ type: 'START_STEAL' })}>
            Force Steal
          </button>
        </ConsoleSection>
      )}

      {phase === 'roundOver' && (
        <ConsoleSection title="Round over">
          <button
            className="primary"
            onClick={() => dispatch({ type: 'NEXT_ROUND' })}
          >
            Next Round
          </button>
          <button onClick={() => dispatch({ type: 'END_GAME' })}>End Game</button>
        </ConsoleSection>
      )}

      {phase === 'gameOver' && (
        <ConsoleSection title="Game over">
          {getWinner(state) && (
            <div className="console-hint">Winner: {getWinner(state)?.name}</div>
          )}
          <button
            className="primary"
            onClick={() => dispatch({ type: 'START_GAME' })}
          >
            Play Again
          </button>
        </ConsoleSection>
      )}

      <div className="console-footer">
        <button disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}>
          Undo
        </button>
        <button className="danger" onClick={() => dispatch({ type: 'RESET_GAME' })}>
          Reset Game
        </button>
      </div>
    </aside>
  );
}
