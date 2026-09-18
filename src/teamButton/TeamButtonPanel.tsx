import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTeamButtonHost } from './useTeamButtonHost';
import { unlockAudio } from './audio';
import { DEFAULT_THINK_SECONDS, FACE_OFF_THINK_OPTIONS, STEAL_THINK_SECONDS } from './protocol';
import type { GamePhase, Team } from '../game/gameTypes';
import type { AnswerTimerApi } from '../game/useAnswerTimer';
import AnswerTimerHud from './AnswerTimerHud';

export type TeamButtonPanelProps = {
  teams: Team[];
  phase: GamePhase;
  activeTeamId: string | null;
  noAnswerTeamIds: string[];
  onSetActiveTeam: (teamId: string) => void;
  onMarkNoAnswer: (teamId: string) => void;
  onSetStealTeam: (teamId: string) => void;
  /** Post-press pacing timer — cosmetic only, never determines FIRST/press order. */
  answerTimer: AnswerTimerApi;
};

/**
 * Teacher control panel for Team Buttons. The button layer only determines
 * press order; scoring/possession stay with the game reducer. Fully playable
 * without any connected devices via the manual fallback controls.
 */
export default function TeamButtonPanel({
  teams,
  phase,
  activeTeamId,
  noAnswerTeamIds,
  onSetActiveTeam,
  onMarkNoAnswer,
  onSetStealTeam,
  answerTimer,
}: TeamButtonPanelProps) {
  const teamInfos = useMemo(() => teams.map(({ id, name, color }) => ({ id, name, color })), [teams]);
  const host = useTeamButtonHost(teamInfos);
  const [thinkSeconds, setThinkSeconds] = useState<number>(DEFAULT_THINK_SECONDS);
  const [responderIndex, setResponderIndex] = useState(0);
  const [manualTeamId, setManualTeamId] = useState<string>('');

  const session = host.session;
  const pressOrder = session?.pressOrder ?? [];
  const isFaceoff = phase === 'tossup';
  const isSteal = phase === 'steal';
  const sessionLive = session !== null && session.sessionId !== null && session.phase !== 'idle';

  const eligibleStealIds = teams
    .filter((team) => team.id !== activeTeamId && !noAnswerTeamIds.includes(team.id))
    .map((team) => team.id);

  const responder = pressOrder[responderIndex] ?? null;
  const responderTeam = responder ? teams.find((team) => team.id === responder.teamId) : null;

  // The answer timer only ever consumes press order — it never determines
  // FIRST/press acceptance. Face-off: whoever is currently displayed as
  // "Answering" (the responder at responderIndex). Steal: only the very
  // first eligible presser (queued/later stealers never get a timer).
  // Guarded by a ref so a rerender or Strict Mode double-invoke with the
  // same derived team id never restarts the timer.
  const currentAnsweringTeamId = isFaceoff ? (responder?.teamId ?? null) : isSteal ? (pressOrder[0]?.teamId ?? null) : null;
  const lastReportedTeamIdRef = useRef<string | null>(null);
  const { start: startAnswerTimer, clear: clearAnswerTimer } = answerTimer;
  useEffect(() => {
    if (currentAnsweringTeamId === lastReportedTeamIdRef.current) return;
    lastReportedTeamIdRef.current = currentAnsweringTeamId;
    if (currentAnsweringTeamId) {
      startAnswerTimer(currentAnsweringTeamId);
    } else {
      clearAnswerTimer();
    }
  }, [currentAnsweringTeamId, startAnswerTimer, clearAnswerTimer]);

  const joinUrl = `${window.location.origin}/team-button`;

  const startFaceoff = () => {
    unlockAudio();
    setResponderIndex(0);
    host.startSession('faceoff', thinkSeconds, teams.map((team) => team.id));
  };

  const startSteal = () => {
    unlockAudio();
    setResponderIndex(0);
    host.startSession('steal', STEAL_THINK_SECONDS, eligibleStealIds);
  };

  const advanceResponder = () => {
    setResponderIndex((index) => index + 1);
  };

  const resolveAndControl = (teamId: string) => {
    onSetActiveTeam(teamId);
    host.resolveSession();
    // CORRECT ends the face-off outright (possession is granted immediately,
    // with no separate "awaiting judgment" window) — clear right away rather
    // than waiting on the derived effect above, which won't see any change
    // since pressOrder/responderIndex are untouched by this action.
    lastReportedTeamIdRef.current = null;
    clearAnswerTimer();
  };

  if (host.demoted) {
    return (
      <section className="tb-panel" aria-label="Team Buttons">
        <div className="tb-panel-header">
          <h3>TEAM BUTTONS</h3>
        </div>
        <div className="tb-demoted" role="alert">
          TEACHER CONTROL MOVED TO ANOTHER DEVICE
          <span className="tb-demoted-detail">
            Another device opened the teacher host URL and is now controlling Team Buttons. This
            window is no longer authoritative — close it or reopen the teacher URL to take control
            back.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="tb-panel" aria-label="Team Buttons">
      <div className="tb-panel-header">
        <h3>TEAM BUTTONS</h3>
        <span className="tb-server-state">
          {host.status === 'open' ? 'SERVER READY' : host.status === 'reconnecting' ? 'RECONNECTING…' : 'CONNECTING…'}
        </span>
      </div>

      <div className="tb-join-url">
        <span>Join on each iPad:</span>
        <code>{joinUrl}</code>
      </div>

      <div className="tb-connected-list">
        {teams.map((team) => (
          <div
            key={team.id}
            className={host.connectedTeamIds.includes(team.id) ? 'tb-connected tb-connected--on' : 'tb-connected'}
            style={{ '--team-color': team.color } as CSSProperties}
          >
            <span className="tb-team-name">{team.name.toUpperCase()}</span>
            <span className="tb-team-state">
              {host.connectedTeamIds.includes(team.id) ? 'CONNECTED' : 'NOT CONNECTED'}
            </span>
          </div>
        ))}
      </div>

      {isFaceoff && (
        <div className="tb-faceoff">
          {!sessionLive ? (
            <div className="tb-faceoff-start">
              <label className="tb-think-label">
                Think time:
                <select
                  value={thinkSeconds}
                  onChange={(event) => setThinkSeconds(Number(event.target.value))}
                >
                  {FACE_OFF_THINK_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} sec
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="primary" onClick={startFaceoff}>
                START FACE-OFF
              </button>
            </div>
          ) : (
            <div className="tb-live" role="status" aria-live="polite">
              {session.phase === 'thinking' && <span className="tb-countdown-inline">{session.remaining}</span>}
              {session.phase === 'ready' && <span className="tb-live-ready">BUTTONS LIVE — TAP TO ANSWER</span>}
              {session.phase === 'resolved' && <span className="tb-live-resolved">FACE-OFF RESOLVED</span>}
            </div>
          )}

          {pressOrder.length > 0 && (
            <div className="tb-press-order">
              <h4>PRESS ORDER</h4>
              <ol>
                {pressOrder.map((entry, index) => {
                  const team = teams.find((candidate) => candidate.id === entry.teamId);
                  const isCurrent = index === responderIndex;
                  return (
                    <li key={`${entry.teamId}-${index}`} className={isCurrent ? 'tb-current' : ''}>
                      <span className="tb-rank">{index + 1}</span>
                      <span className="tb-press-name">{team?.name ?? entry.teamId}</span>
                      {isCurrent && <span className="tb-current-tag">ANSWERING</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {responder && (
            <div className="tb-answer-window">
              <h4>Answering: {responderTeam?.name ?? responder.teamId}</h4>
              <div className="tb-answer-actions">
                <button type="button" className="success" onClick={() => resolveAndControl(responder.teamId)}>
                  CORRECT
                </button>
                <button type="button" className="danger" onClick={advanceResponder}>
                  INCORRECT
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    onMarkNoAnswer(responder.teamId);
                    advanceResponder();
                  }}
                >
                  NO ANSWER
                </button>
              </div>
              {responder && noAnswerTeamIds.includes(responder.teamId) && (
                <span className="tb-steal-block">STEAL ELIGIBILITY: BLOCKED</span>
              )}
            </div>
          )}
        </div>
      )}

      {isSteal && (
        <div className="tb-steal">
          {!sessionLive ? (
            <div className="tb-steal-start">
              <button type="button" className="primary" onClick={startSteal}>
                START STEAL ({STEAL_THINK_SECONDS} SEC)
              </button>
              <span className="tb-eligible">
                Eligible: {teams.filter((team) => eligibleStealIds.includes(team.id)).map((team) => team.name).join(', ') || 'none'}
              </span>
            </div>
          ) : (
            <div className="tb-live" role="status" aria-live="polite">
              {session.phase === 'thinking' && <span className="tb-countdown-inline">{session.remaining}</span>}
              {session.phase === 'ready' && <span className="tb-live-ready">STEAL BUTTONS LIVE</span>}
              {session.phase === 'resolved' && <span className="tb-live-resolved">STEAL RESOLVED</span>}
            </div>
          )}

          {pressOrder.length > 0 && (
            <div className="tb-press-order">
              <h4>STEAL PRESS</h4>
              <ol>
                {pressOrder.map((entry, index) => {
                  const team = teams.find((candidate) => candidate.id === entry.teamId);
                  return (
                    <li key={`${entry.teamId}-${index}`}>
                      <span className="tb-rank">{index + 1}</span>
                      <span className="tb-press-name">{team?.name ?? entry.teamId}</span>
                      {index === 0 && (
                        <button
                          type="button"
                          className="success"
                          onClick={() => {
                            onSetStealTeam(entry.teamId);
                            host.resolveSession();
                          }}
                        >
                          GIVE STEAL
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="tb-manual">
        <h4>MANUAL CONTROL</h4>
        <div className="tb-manual-row">
          <select value={manualTeamId} onChange={(event) => setManualTeamId(event.target.value)}>
            <option value="">Set first team…</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!manualTeamId}
            onClick={() => {
              onSetActiveTeam(manualTeamId);
              setManualTeamId('');
            }}
          >
            SET FIRST TEAM
          </button>
        </div>
        <div className="tb-manual-row">
          <button
            type="button"
            onClick={() => {
              host.resetButtons();
              lastReportedTeamIdRef.current = null;
              clearAnswerTimer();
            }}
          >
            RESET BUTTONS
          </button>
          <button
            type="button"
            onClick={() => {
              setResponderIndex(0);
              host.resetButtons();
              lastReportedTeamIdRef.current = null;
              clearAnswerTimer();
            }}
          >
            IGNORE BUTTON RESULT
          </button>
        </div>
      </div>

      <AnswerTimerHud teams={teams} answerTimer={answerTimer} />

      {host.error && <span className="tb-error" role="alert">{host.error}</span>}
    </section>
  );
}
