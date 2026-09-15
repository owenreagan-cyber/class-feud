import {
  getActiveTeam,
  getCurrentRound,
  getRoundValue,
  getStealTeam,
  getWinner,
} from '../../game/gameSelectors';
import { PHASE_LABELS } from '../../game/gameTypes';
import type { GameState } from '../../game/gameTypes';
import Scoreboard from '../scoreboard/Scoreboard';
import AnswerBoard from './AnswerBoard';
import StrikeIndicators from './StrikeIndicators';

function statusText(state: GameState): string {
  switch (state.phase) {
    case 'tossup':
      return 'Face-off: who will take control?';
    case 'playing': {
      const active = getActiveTeam(state);
      return active ? `Controlled by ${active.name}` : '';
    }
    case 'steal': {
      const steal = getStealTeam(state);
      const active = getActiveTeam(state);
      if (steal) {
        return `${steal.name} is stealing from ${active?.name ?? 'the controlling team'}`;
      }
      return 'Steal: choose the stealing team';
    }
    case 'roundOver':
      return 'Round over';
    case 'gameOver': {
      const winner = getWinner(state);
      return winner ? `${winner.name} wins!` : 'Game over';
    }
    default:
      return '';
  }
}

export default function GameBoard({ state }: { state: GameState }) {
  const round = getCurrentRound(state);
  return (
    <div className="game-board">
      <div className="board-top">
        <Scoreboard state={state} />
        <div className="board-meta">
          <span className="round-badge">
            Round {state.currentRoundIndex + 1} / {state.rounds.length}
          </span>
          {round.multiplier > 1 && (
            <span className="multiplier-badge">×{round.multiplier} Points</span>
          )}
          <div className="round-pot">
            <span className="meta-label">Round Pot</span>
            <span className="meta-value">{getRoundValue(state)}</span>
          </div>
          <div className="strikes-block">
            <span className="meta-label">Strikes</span>
            <StrikeIndicators strikes={state.strikes} />
          </div>
          <span className="phase-badge">{PHASE_LABELS[state.phase]}</span>
        </div>
      </div>

      <div className="board-main">
        <p className="category">{round.category}</p>
        <h1 className="prompt">{round.prompt}</h1>
        <p className="control-line">{statusText(state)}</p>
        <AnswerBoard answers={round.answers} />
      </div>
    </div>
  );
}
