import type { CSSProperties, Dispatch } from 'react';
import {
  MAX_TEAMS,
  MIN_TEAMS,
  MULTIPLIER_LABELS,
  TEAM_COLORS,
} from '../game/gameTypes';
import type { GameAction, GameState, Multiplier } from '../game/gameTypes';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
};

const MULTIPLIERS: Multiplier[] = [1, 2, 3];

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export default function SetupScreen({ state, dispatch }: Props) {
  const selectedCount = state.rounds.length;

  function addTeam() {
    dispatch({ type: 'ADD_TEAM' });
  }

  function removeTeam(teamId: string) {
    dispatch({ type: 'REMOVE_TEAM', teamId });
  }

  function renameTeam(teamId: string, name: string) {
    dispatch({ type: 'RENAME_TEAM', teamId, name });
  }

  function setTeamColor(teamId: string, color: string) {
    dispatch({ type: 'SET_TEAM_COLOR', teamId, color });
  }

  function moveTeam(index: number, direction: -1 | 1) {
    const ids = moveItem(state.teams, index, direction).map((team) => team.id);
    dispatch({ type: 'REORDER_TEAMS', teamIds: ids });
  }

  function toggleRound(roundId: string) {
    dispatch({ type: 'TOGGLE_ROUND', roundId });
  }

  function moveRound(index: number, direction: -1 | 1) {
    const ids = moveItem(state.rounds, index, direction).map((round) => round.id);
    dispatch({ type: 'REORDER_ROUNDS', roundIds: ids });
  }

  function setRoundMultiplier(roundId: string, multiplier: Multiplier) {
    dispatch({ type: 'SET_ROUND_MULTIPLIER', roundId, multiplier });
  }

  return (
    <div className="setup-screen">
      <header className="setup-header">
        <h1 className="setup-title">Class Feud</h1>
        <p className="setup-subtitle">Set up teams and rounds, then start.</p>
      </header>

      <section className="setup-section">
        <div className="setup-section-head">
          <h2>Teams</h2>
          <span className="setup-count">
            {state.teams.length}/{MAX_TEAMS}
          </span>
        </div>

        <div className="team-rows">
          {state.teams.map((team, index) => (
            <div
              key={team.id}
              className="team-setup-row"
              style={{ '--team-color': team.color } as CSSProperties}
            >
              <span className="team-dot" />
              <span className="team-number">Team {index + 1}</span>
              <input
                value={team.name}
                onChange={(event) => renameTeam(team.id, event.target.value)}
                aria-label={`Team ${index + 1} name`}
              />
              <div className="color-picker" role="radiogroup" aria-label={`${team.name} color`}>
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    role="radio"
                    aria-checked={team.color === color.value}
                    className={
                      team.color === color.value ? 'swatch swatch--selected' : 'swatch'
                    }
                    style={{ background: color.value }}
                    title={color.label}
                    aria-label={color.label}
                    onClick={() => setTeamColor(team.id, color.value)}
                  />
                ))}
              </div>
              <div className="row-controls">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveTeam(index, -1)}
                  aria-label={`Move ${team.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === state.teams.length - 1}
                  onClick={() => moveTeam(index, 1)}
                  aria-label={`Move ${team.name} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={state.teams.length <= MIN_TEAMS}
                  onClick={() => removeTeam(team.id)}
                  aria-label={`Remove ${team.name}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={state.teams.length >= MAX_TEAMS}
          onClick={addTeam}
        >
          + Add Team
        </button>
      </section>

      <section className="setup-section">
        <div className="setup-section-head">
          <h2>Rounds</h2>
          <span className="setup-count">{selectedCount} selected</span>
        </div>

        <div className="round-rows">
          {state.rounds.map((round, index) => (
            <div key={round.id} className="round-setup-row">
              <span className="round-order">{index + 1}</span>
              <div className="round-info">
                <span className="round-title">{round.title}</span>
                <span className="round-meta">
                  {round.category} · {round.answers.length} answers
                </span>
              </div>
              <div className="multiplier-picker">
                {MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={round.multiplier === m ? 'mult-option mult-option--on' : 'mult-option'}
                    onClick={() => setRoundMultiplier(round.id, m)}
                    title={MULTIPLIER_LABELS[m]}
                  >
                    {m}×
                  </button>
                ))}
              </div>
              <div className="row-controls">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveRound(index, -1)}
                  aria-label={`Move ${round.title} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === state.rounds.length - 1}
                  onClick={() => moveRound(index, 1)}
                  aria-label={`Move ${round.title} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={state.rounds.length <= 1}
                  onClick={() => toggleRound(round.id)}
                  aria-label={`Remove ${round.title}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="library-list">
          <span className="library-label">Available rounds:</span>
          {state.roundLibrary
            .filter((round) => !state.rounds.some((selected) => selected.id === round.id))
            .map((round) => (
              <button
                key={round.id}
                type="button"
                onClick={() => toggleRound(round.id)}
                title={`${round.category} · ${round.answers.length} answers`}
              >
                + {round.title} ({round.category})
              </button>
            ))}
        </div>
      </section>

      <button
        type="button"
        className="primary start-button"
        onClick={() => dispatch({ type: 'START_GAME' })}
      >
        Start Game
      </button>
    </div>
  );
}
