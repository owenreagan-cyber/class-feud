import type { Team } from '../game/gameTypes';
import type { AnswerTimerApi } from '../game/useAnswerTimer';

/**
 * Compact teacher HUD for the post-press answer timer. Purely a pacing
 * display/control surface — every button here calls the answer-timer API
 * only, never the game reducer, never Team Buttons networking.
 */
export default function AnswerTimerHud({ teams, answerTimer }: { teams: Team[]; answerTimer: AnswerTimerApi }) {
  const { answerTimer: state, pause, resume, reset, setDuration } = answerTimer;
  const hasTeam = state.teamId !== null;
  const team = hasTeam ? teams.find((candidate) => candidate.id === state.teamId) : null;

  return (
    <div className="tb-answer-timer" role="status" aria-live="polite">
      <h4>ANSWER TIMER</h4>
      <div className="tb-answer-timer-row">
        <span className="tb-answer-timer-label">ANSWERING</span>
        <span className="tb-answer-timer-team">{hasTeam ? team?.name ?? state.teamId : '—'}</span>
      </div>
      <div className="tb-answer-timer-row">
        <span className="tb-answer-timer-label">ANSWER TIME</span>
        <span className="tb-answer-timer-value">
          {state.status === 'expired' ? 'EXPIRED' : state.remainingSeconds}
        </span>
        {state.status === 'paused' && <span className="tb-answer-timer-tag">PAUSED</span>}
      </div>
      <div className="tb-answer-timer-controls">
        {hasTeam && state.status === 'running' && (
          <button type="button" onClick={pause}>
            PAUSE
          </button>
        )}
        {hasTeam && state.status === 'paused' && (
          <button type="button" onClick={resume}>
            RESUME
          </button>
        )}
        {hasTeam && (
          <button type="button" onClick={reset}>
            RESET
          </button>
        )}
        <button
          type="button"
          className={state.durationSeconds === 3 ? 'tb-duration-active' : ''}
          onClick={() => setDuration(3)}
        >
          3 SEC
        </button>
        <button
          type="button"
          className={state.durationSeconds === 5 ? 'tb-duration-active' : ''}
          onClick={() => setDuration(5)}
        >
          5 SEC
        </button>
      </div>
    </div>
  );
}
