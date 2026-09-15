import type { CSSProperties } from 'react';
import type { GameState } from '../../game/gameTypes';

export default function Scoreboard({ state }: { state: GameState }) {
  return (
    <div className="scoreboard">
      {state.teams.map((team) => {
        const isActive = team.id === state.activeTeamId;
        const style = { '--team-color': team.color } as CSSProperties;
        return (
          <div
            key={team.id}
            className={isActive ? 'team-card team-card--active' : 'team-card'}
            style={style}
          >
            <span className="team-name">{team.name}</span>
            <span className="team-score">{team.score}</span>
            {isActive && <span className="control-tag">CONTROL</span>}
          </div>
        );
      })}
    </div>
  );
}
