import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../game/gameTypes';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
};

export default function SetupScreen({ state, dispatch }: Props) {
  function renameTeam(teamId: string, name: string) {
    dispatch({
      type: 'UPDATE_TEAMS',
      teams: state.teams.map((team) => (team.id === teamId ? { ...team, name } : team)),
    });
  }

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Class Feud</h1>
      <p className="setup-subtitle">Set up your game, then start.</p>

      {state.teams.map((team, index) => (
        <label key={team.id} className="team-setup-row">
          <span className="team-dot" style={{ background: team.color }} />
          <span className="team-number">Team {index + 1}</span>
          <input
            value={team.name}
            onChange={(event) => renameTeam(team.id, event.target.value)}
            aria-label={`Team ${index + 1} name`}
          />
        </label>
      ))}

      <button
        type="button"
        className="primary"
        onClick={() => dispatch({ type: 'START_GAME' })}
      >
        Start Game
      </button>
    </div>
  );
}
