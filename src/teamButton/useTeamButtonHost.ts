import { useEffect, useRef, useState } from 'react';
import { useTeamButtonConnection } from './useTeamButtonConnection';
import type { FaceOffPublicState, SessionKind, TeamInfo } from './protocol';

export type TeamButtonHost = {
  status: 'connecting' | 'open' | 'reconnecting' | 'closed';
  connectedTeamIds: string[];
  session: FaceOffPublicState | null;
  error: string | null;
  startSession: (kind: SessionKind, thinkSeconds: number, eligibleTeamIds: string[]) => void;
  resolveSession: () => void;
  resetButtons: () => void;
};

/**
 * Teacher-host hook. The host is authoritative only over arming/resolving the
 * buttons; scoring and possession remain with the game reducer. The host also
 * keeps the server's team registry (names/colors) in sync with runtime teams.
 */
export function useTeamButtonHost(teamInfos: TeamInfo[]): TeamButtonHost {
  const [connectedTeamIds, setConnectedTeamIds] = useState<string[]>([]);
  const [session, setSession] = useState<FaceOffPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teamInfosRef = useRef(teamInfos);

  // Keep the ref in sync for the setTeams logic inside onOpen without writing
  // to refs during render.
  useEffect(() => {
    teamInfosRef.current = teamInfos;
  }, [teamInfos]);

  const { status, send } = useTeamButtonConnection({
    role: 'host',
    onOpen: (sendOnOpen) => {
      sendOnOpen({ type: 'setTeams', teams: teamInfosRef.current });
    },
    onMessage: (message) => {
      switch (message.type) {
        case 'teamsConfig':
          setConnectedTeamIds(message.connectedTeamIds);
          break;
        case 'session':
          setSession(message.session);
          break;
        case 'error':
          setError(message.message);
          break;
        default:
          break;
      }
    },
  });

  // Push runtime team names/colors to the server only when they actually
  // change (avoids churn on every render).
  const lastTeamsRef = useRef<string>('');
  useEffect(() => {
    if (status !== 'open') return;
    const serialized = JSON.stringify(teamInfos);
    if (serialized === lastTeamsRef.current) return;
    lastTeamsRef.current = serialized;
    send({ type: 'setTeams', teams: teamInfos });
  }, [status, send, teamInfos]);

  const startSession = (kind: SessionKind, thinkSeconds: number, eligibleTeamIds: string[]) => {
    send({ type: 'start', kind, thinkSeconds, eligibleTeamIds });
  };

  const resolveSession = () => send({ type: 'resolve' });
  const resetButtons = () => send({ type: 'reset' });

  return { status, connectedTeamIds, session, error, startSession, resolveSession, resetButtons };
}
