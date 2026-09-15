import type { GameState } from '../../game/gameTypes';

export default function Scoreboard({ state }: { state: GameState }) {
  return (
    <div className="scoreboard">
      {state.teams.map((team) => {
        const isActive = team.id === state.activeTeamId;
        return (
          <div
            key={team.id}
            className={isActive ? 'team-card team-card--active' : 'team-card'}
            style={{ borderColor: team.color }}
          >
            <span className="team-name">{team.name}</span>
            <span className="team-score">{team.score}</span>
            {isActive && (
              <span className="control-tag" style={{ background: team.color }}>
                CONTROL
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
