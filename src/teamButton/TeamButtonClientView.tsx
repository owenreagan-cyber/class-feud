import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useTeamButtonClient } from './useTeamButtonClient';
import { deriveTeamButtonState } from './teamDeviceState';
import { playFirstPress, playReadyDing } from './audio';
import type { TeamInfo } from './protocol';

/**
 * Full-screen team device view (route `/team-button`). One iPad per team.
 * The server is the authority for state; this view only renders the current
 * server-broadcast session and submits press intent on a fresh tap.
 */
export default function TeamButtonClientView() {
  const client = useTeamButtonClient();
  const { status, myTeamId, teamConfig, connectedTeamIds, session, error } = client;

  if (status !== 'open') {
    return (
      <div className="tb-screen">
        <div className="tb-status-banner" role="status" aria-live="polite">
          {status === 'reconnecting' ? 'RECONNECTING…' : 'CONNECTING…'}
        </div>
        <p className="tb-hint">Checking the button connection…</p>
      </div>
    );
  }

  if (myTeamId === null) {
    return (
      <JoinScreen
        teams={teamConfig}
        connectedTeamIds={connectedTeamIds}
        onJoin={client.joinTeam}
        error={error}
      />
    );
  }

  const myTeam = teamConfig.find((team) => team.id === myTeamId);

  return (
    <TeamButtonView
      team={myTeam ?? { id: myTeamId, name: 'Your Team', color: '#9aa5c8' }}
      session={session}
      onPress={client.press}
    />
  );
}

function JoinScreen({
  teams,
  connectedTeamIds,
  onJoin,
  error,
}: {
  teams: TeamInfo[];
  connectedTeamIds: string[];
  onJoin: (teamId: string) => void;
  error: string | null;
}) {
  if (teams.length === 0) {
    return (
      <div className="tb-screen">
        <h1 className="tb-join-title">JOIN A TEAM</h1>
        <p className="tb-hint" role="status">
          Waiting for the host to open Team Buttons…
        </p>
      </div>
    );
  }
  return (
    <div className="tb-screen">
      <h1 className="tb-join-title">JOIN A TEAM</h1>
      {error && (
        <p className="tb-join-error" role="alert">
          {error}
        </p>
      )}
      <div className="tb-join-grid">
        {teams.map((team) => {
          const taken = connectedTeamIds.includes(team.id);
          return (
            <button
              key={team.id}
              type="button"
              className="tb-join-button"
              disabled={taken}
              onClick={() => onJoin(team.id)}
              style={{ '--team-color': team.color } as CSSProperties}
            >
              <span className="tb-join-dot" aria-hidden="true" />
              {team.name}
              {taken && <span className="tb-taken">CONNECTED</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamButtonView({
  team,
  session,
  onPress,
}: {
  team: TeamInfo;
  session: ReturnType<typeof useTeamButtonClient>['session'];
  onPress: (sessionId: string) => void;
}) {
  const state = deriveTeamButtonState(session, team.id);
  const pressedRef = useRef(false);
  const lastKindRef = useRef(state.kind);
  const lastSessionIdRef = useRef(session?.sessionId ?? null);

  // Reset the local press latch when a NEW session begins (server broadcasts a
  // fresh sessionId per face-off/steal), so a team can press again next round.
  useEffect(() => {
    const sessionId = session?.sessionId ?? null;
    if (sessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = sessionId;
      pressedRef.current = false;
    }
  }, [session?.sessionId]);

  // Play the "ready" ding when the button first goes live.
  useEffect(() => {
    if (state.kind === 'ready' && lastKindRef.current !== 'ready') {
      playReadyDing();
    }
    lastKindRef.current = state.kind;
  }, [state.kind]);

  const handlePointerDown = () => {
    // A press is only valid if it begins while READY. `canPress` is false
    // during LOCKED/THINKING, after our own press, and when ineligible.
    if (!state.canPress || pressedRef.current || !session?.sessionId) return;
    pressedRef.current = true;
    playFirstPress();
    onPress(session.sessionId);
  };

  const headline = () => {
    switch (state.kind) {
      case 'thinking':
        return 'THINK…';
      case 'ready':
        return 'ANSWER READY?';
      case 'first':
        return "YOU'RE FIRST!";
      case 'queued':
        return 'WAIT';
      case 'ineligible':
        return 'NOT ELIGIBLE FOR THIS STEAL';
      case 'waiting':
        return 'KEEP YOUR ANSWER READY';
      default:
        return 'THINK OF YOUR ANSWER';
    }
  };

  const detail = () => {
    switch (state.kind) {
      case 'thinking':
        return 'Wait for the button to light up.';
      case 'ready':
        return 'Tap gently once.';
      case 'first':
        return 'Say your answer.';
      case 'queued':
        return 'Another team pressed first. Keep your answer ready.';
      case 'ineligible':
        return 'This team cannot steal this board.';
      case 'waiting':
        return 'The teacher is resolving the face-off.';
      default:
        return 'The button is locked.';
    }
  };

  const buttonLabel = state.kind === 'ready' ? 'TAP TO ANSWER' : 'BUTTON LOCKED';

  return (
    <div className="tb-screen" style={{ '--team-color': team.color } as CSSProperties}>
      <div className="tb-team-identity">
        <span className="tb-team-dot" aria-hidden="true" />
        <span>TEAM {team.name.toUpperCase()}</span>
      </div>

      <div className="tb-state" role="status" aria-live="polite">
        {state.kind === 'thinking' ? (
          <div className="tb-countdown" aria-label={`${state.countdown} seconds`}>
            {state.countdown}
          </div>
        ) : (
          <h2 className="tb-headline">{headline()}</h2>
        )}
        <p className="tb-detail">{detail()}</p>
      </div>

      <button
        type="button"
        className="tb-answer-button"
        disabled={!state.canPress}
        onPointerDown={handlePointerDown}
        aria-label={buttonLabel}
      >
        {buttonLabel}
      </button>
      <p className="tb-gentle">Tap gently once.</p>
    </div>
  );
}
