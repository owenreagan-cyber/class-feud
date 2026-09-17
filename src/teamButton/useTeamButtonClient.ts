import { useEffect, useRef, useState } from 'react';
import { useTeamButtonConnection } from './useTeamButtonConnection';
import type { FaceOffPublicState, TeamInfo } from './protocol';

const TEAM_STORAGE_KEY = 'class-feud.team-id';

export type TeamButtonClient = {
  status: 'connecting' | 'open' | 'reconnecting' | 'closed';
  myTeamId: string | null;
  teamConfig: TeamInfo[];
  connectedTeamIds: string[];
  session: FaceOffPublicState | null;
  error: string | null;
  joinTeam: (teamId: string) => void;
  press: (sessionId: string) => void;
};

/** Team-device hook: connect, join a team, and submit press intent only. */
export function useTeamButtonClient(): TeamButtonClient {
  const [myTeamId, setMyTeamId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TEAM_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [teamConfig, setTeamConfig] = useState<TeamInfo[]>([]);
  const [connectedTeamIds, setConnectedTeamIds] = useState<string[]>([]);
  const [session, setSession] = useState<FaceOffPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myTeamIdRef = useRef(myTeamId);

  // Keep the ref in sync for the rejoin logic inside onOpen without writing
  // to refs during render.
  useEffect(() => {
    myTeamIdRef.current = myTeamId;
  }, [myTeamId]);

  const { status, send } = useTeamButtonConnection({
    role: 'team',
    onOpen: (sendOnOpen) => {
      const teamId = myTeamIdRef.current;
      if (teamId) sendOnOpen({ type: 'join', teamId });
    },
    onMessage: (message, sendOnMessage) => {
      switch (message.type) {
        case 'teamsConfig':
          setTeamConfig(message.teams);
          setConnectedTeamIds(message.connectedTeamIds);
          // Recover a lost association (e.g. the host refreshed and the server
          // reset team links). Only re-join when our team still exists in the
          // runtime config but the server no longer lists it as connected — and
          // only after the host has repopulated teams (avoids an empty-teams race).
          {
            const stored = myTeamIdRef.current;
            if (
              stored &&
              !message.connectedTeamIds.includes(stored) &&
              message.teams.some((team) => team.id === stored)
            ) {
              sendOnMessage({ type: 'join', teamId: stored });
            }
          }
          break;
        case 'session':
          setSession(message.session);
          break;
        case 'welcome':
          if (message.teamId) {
            setMyTeamId(message.teamId);
            try {
              sessionStorage.setItem(TEAM_STORAGE_KEY, message.teamId);
            } catch {
              // storage unavailable — still works for this session
            }
          }
          break;
        case 'error':
          setError(message.message);
          break;
        default:
          break;
      }
    },
  });

  const joinTeam = (teamId: string) => {
    setMyTeamId(teamId);
    try {
      sessionStorage.setItem(TEAM_STORAGE_KEY, teamId);
    } catch {
      // storage unavailable — still works for this session
    }
    send({ type: 'join', teamId });
  };

  const press = (sessionId: string) => {
    send({ type: 'press', sessionId });
  };

  return { status, myTeamId, teamConfig, connectedTeamIds, session, error, joinTeam, press };
}
