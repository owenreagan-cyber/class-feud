import { motion } from 'framer-motion';
import {
  getActiveTeam,
  getCurrentRound,
  getRoundValue,
  getRoundWinner,
  getStealTeam,
  getTiedTeams,
  getWinner,
} from '../../game/gameSelectors';
import { MULTIPLIER_LABELS } from '../../game/gameTypes';
import type { FeudRound, GameState } from '../../game/gameTypes';
import { isBrainBlitzEnabled } from '../../game/brainBlitzTypes';
import type { AnswerTimerState } from '../../game/useAnswerTimer';
import type { WrongAnswerEvent } from '../../game/useWrongAnswerFeedback';
import AnswerBoard from '../board/AnswerBoard';
import StrikeIndicators from '../board/StrikeIndicators';
import Scoreboard from '../scoreboard/Scoreboard';
import BrainBlitzPresenter from './BrainBlitzPresenter';
import WrongAnswerOverlay from './WrongAnswerOverlay';

function statusText(state: GameState): string {
  switch (state.phase) {
    case 'tossup':
      return 'Toss-up: who will take control?';
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
      return 'Steal attempt';
    }
    default:
      return '';
  }
}

/**
 * Restrained projected pacing display — visible only while a team is
 * established as currently answering (face-off or steal). Never implies an
 * automatic strike/no-answer on its own; expiry copy stays neutral ("TIME").
 */
function AnswerTimerBadge({ teamName, answerTimer }: { teamName: string; answerTimer: AnswerTimerState }) {
  return (
    <div className="presenter-answer-timer" role="status" aria-live="polite">
      <span className="presenter-answer-timer-team">{teamName}</span>
      <span className="presenter-answer-timer-label">ANSWER</span>
      <span className="presenter-answer-timer-value">
        {answerTimer.status === 'expired' ? 'TIME' : answerTimer.remainingSeconds}
      </span>
      {answerTimer.status === 'paused' && <span className="presenter-answer-timer-tag">PAUSED</span>}
    </div>
  );
}

function RoundIntro({ round, roundNumber }: { round: FeudRound; roundNumber: number }) {
  return (
    <motion.div
      className="round-intro"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <span className="intro-round">Round {roundNumber}</span>
      <span className="intro-multiplier">{MULTIPLIER_LABELS[round.multiplier]}</span>
      <span className="intro-category">{round.category}</span>
    </motion.div>
  );
}

function RoundOverView({ state }: { state: GameState }) {
  const winner = getRoundWinner(state);
  return (
    <div className="result-panel">
      <span className="result-kicker">Round over</span>
      <h2 className="result-headline">
        {winner ? `${winner.name} wins the round` : 'Round complete'}
      </h2>
      <span className="result-amount">+{getRoundValue(state)} points</span>
    </div>
  );
}

function GameOverView({ state }: { state: GameState }) {
  const winner = getWinner(state);
  const tied = getTiedTeams(state);
  return (
    <div className="result-panel">
      <span className="result-kicker">Game over</span>
      {tied.length > 0 ? (
        <>
          <h2 className="result-headline">Tie game</h2>
          <div className="tied-teams">
            {tied.map((team) => (
              <span key={team.id} className="tied-team" style={{ borderColor: team.color }}>
                {team.name}
              </span>
            ))}
          </div>
        </>
      ) : (
        <h2 className="result-headline">{winner ? `${winner.name} wins!` : 'Game over'}</h2>
      )}
      {isBrainBlitzEnabled(state.brainBlitzConfig) && (
        <span className="bb-available">Brain Blitz available</span>
      )}
    </div>
  );
}

export default function PresenterGameView({
  state,
  wrongAnswerEvent = null,
  answerTimer = null,
}: {
  state: GameState;
  wrongAnswerEvent?: WrongAnswerEvent | null;
  answerTimer?: AnswerTimerState | null;
}) {
  const round = getCurrentRound(state);
  const answeringTeamName = answerTimer?.teamId
    ? (state.teams.find((team) => team.id === answerTimer.teamId)?.name ?? null)
    : null;
  const roundNumber = state.currentRoundIndex + 1;
  const totalRounds = state.rounds.length;

  if (state.phase === 'brainBlitz') {
    return (
      <div className="presenter">
        <header className="presenter-header">
          <span className="brand">Class Feud</span>
          <span className="multiplier-badge">Brain Blitz</span>
        </header>
        <Scoreboard state={state} />
        <BrainBlitzPresenter state={state} />
      </div>
    );
  }

  return (
    <div className="presenter">
      <header className="presenter-header">
        <span className="brand">Class Feud</span>
        <span className="round-badge">
          Round {roundNumber} of {totalRounds}
        </span>
        <span className="multiplier-badge">{MULTIPLIER_LABELS[round.multiplier]}</span>
      </header>

      <Scoreboard state={state} />

      {(state.phase === 'tossup' || state.phase === 'steal') && answerTimer && answeringTeamName && (
        <AnswerTimerBadge teamName={answeringTeamName} answerTimer={answerTimer} />
      )}

      {(state.phase === 'playing' || state.phase === 'steal') && (
        <div className="status-strip">
          <div className="pot-display">
            <span className="status-label">Round Pot</span>
            <span className="status-value">{getRoundValue(state)}</span>
          </div>
          <div className="strike-display">
            <span className="status-label">Strikes</span>
            <StrikeIndicators strikes={state.strikes} />
          </div>
          <span className="control-line">{statusText(state)}</span>
        </div>
      )}

      <main className="presenter-main">
        {state.phase === 'tossup' && (
          <>
            <RoundIntro round={round} roundNumber={roundNumber} />
            <p className="category">{round.category}</p>
            <h1 className="prompt">{round.prompt}</h1>
            <p className="control-line control-line--tossup">{statusText(state)}</p>
          </>
        )}

        {state.phase === 'playing' && (
          <>
            <p className="category">{round.category}</p>
            <h1 className="prompt">{round.prompt}</h1>
            <AnswerBoard answers={round.answers} />
          </>
        )}

        {state.phase === 'steal' && (
          <>
            <p className="category">{round.category}</p>
            <h1 className="prompt">{round.prompt}</h1>
            <AnswerBoard answers={round.answers} />
          </>
        )}

        {state.phase === 'roundOver' && <RoundOverView state={state} />}
        {state.phase === 'gameOver' && <GameOverView state={state} />}
      </main>

      <WrongAnswerOverlay event={wrongAnswerEvent} />
    </div>
  );
}
