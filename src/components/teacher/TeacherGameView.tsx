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
import type { GameAction, GameState, Team } from '../../game/gameTypes';

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
                    onClick={() =>
                      dispatch({ type: 'REVEAL_ANSWER', answerId: answer.id })
                    }
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
                    onClick={() =>
                      dispatch({ type: 'SET_ACTIVE_TEAM', teamId: team.id })
                    }
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
                        onClick={() =>
                          dispatch({ type: 'SET_STEAL_TEAM', teamId: team.id })
                        }
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="console-hint">{stealTeam.name} steal attempt</div>
                  <div className="button-row">
                    <button
                      className="success"
                      onClick={() => dispatch({ type: 'RESOLVE_STEAL', success: true })}
                    >
                      Steal Success — {stealTeam.name} +{roundValue}
                    </button>
                    <button
                      className="danger"
                      onClick={() => dispatch({ type: 'RESOLVE_STEAL', success: false })}
                    >
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
