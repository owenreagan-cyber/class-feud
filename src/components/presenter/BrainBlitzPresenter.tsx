import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import {
  getBrainBlitzAchieved,
  getBrainBlitzCurrentQuestion,
  getBrainBlitzFinalistTeam,
  getBrainBlitzQuestions,
  getBrainBlitzTotalScore,
} from '../../game/gameSelectors';
import type { GameState } from '../../game/gameTypes';
import type { BrainBlitzStatus } from '../../game/brainBlitzTypes';

function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);
  return <span className="bb-count-up">{display}</span>;
}

function TimerBlock({ seconds, expired }: { seconds: number; expired: boolean }) {
  return (
    <div className="bb-presenter-timer">
      <span
        className="bb-presenter-timer-value"
        aria-label={`Brain Blitz timer, ${formatSeconds(seconds)} remaining`}
      >
        {formatSeconds(seconds)}
      </span>
      {expired && (
        <span className="bb-presenter-expired" role="status">
          Time's up
        </span>
      )}
    </div>
  );
}

export default function BrainBlitzPresenter({ state }: { state: GameState }) {
  const blitz = state.brainBlitz;
  if (!blitz) return null;

  const status: BrainBlitzStatus = blitz.status;
  const question = getBrainBlitzCurrentQuestion(state);
  const totalQuestions = getBrainBlitzQuestions(state).length;
  const finalist = getBrainBlitzFinalistTeam(state);

  return (
    <main className="presenter-main bb-presenter">
      <motion.div
        className="bb-presenter-head"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="bb-presenter-title">Brain Blitz</span>
        {finalist && <span className="bb-presenter-finalist">{finalist.name}</span>}
      </motion.div>

      {status === 'setup' && (
        <div className="result-panel">
          <span className="result-kicker">Final round</span>
          <h2 className="result-headline">Brain Blitz</h2>
          {finalist ? (
            <span className="control-line">{finalist.name} is up!</span>
          ) : (
            <span className="control-line">Get ready…</span>
          )}
        </div>
      )}

      {(status === 'player1Ready' || status === 'player2Ready') && (
        <div className="result-panel">
          <span className="result-kicker">Brain Blitz</span>
          <h2 className="result-headline">
            {status === 'player1Ready' ? 'Player 1' : 'Player 2'} — Get Ready
          </h2>
        </div>
      )}

      {(status === 'player1Active' || status === 'player2Active') && question && (
        <>
          <div className="bb-presenter-question-meta">
            <span className="bb-presenter-player">
              {status === 'player1Active' ? 'Player 1' : 'Player 2'}
            </span>
            <span className="bb-presenter-count">
              Question {blitz.currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>
          <TimerBlock seconds={blitz.remainingSeconds} expired={blitz.timerExpired} />
          <h1 className="prompt bb-presenter-prompt">{question.prompt}</h1>
          {question.category ? <p className="category">{question.category}</p> : null}
        </>
      )}

      {status === 'player1Complete' && (
        <div className="result-panel">
          <span className="result-kicker">Brain Blitz</span>
          <h2 className="result-headline">Player 1 Complete</h2>
          {/* Player 1 answer details are intentionally hidden from the presenter. */}
        </div>
      )}

      {status === 'complete' && (
        <motion.div
          className="result-panel bb-result"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="result-kicker">Brain Blitz results</span>

          {blitz.playerMode === 'two' ? (
            <div className="bb-result-scores">
              <div className="bb-result-row">
                <span>Player 1</span>
                <CountUp value={blitz.player1Score} />
              </div>
              <div className="bb-result-row">
                <span>Player 2</span>
                <CountUp value={blitz.player2Score} />
              </div>
            </div>
          ) : null}

          <div className="bb-result-row bb-result-row--total">
            <span>Total</span>
            <CountUp value={getBrainBlitzTotalScore(state)} />
          </div>
          <div className="bb-result-row">
            <span>Target</span>
            <span>{blitz.targetScore}</span>
          </div>

          <motion.h2
            className="result-headline"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.2 }}
          >
            {getBrainBlitzAchieved(state) ? 'You did it!' : 'Great run!'}
          </motion.h2>
        </motion.div>
      )}
    </main>
  );
}
