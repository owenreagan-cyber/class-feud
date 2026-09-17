// Shared Team Buttons protocol (client <-> local WebSocket server).
//
// Team Buttons are a LOCAL classroom enhancement: one browser host (teacher)
// plus one browser client per team, connected over a small LAN WebSocket
// server. No accounts, no cloud, no student personal information. Clients only
// submit team identity and button-press intent; the server is the single
// authority for press ordering and eligibility.

export const TEAM_BUTTON_WS_PORT = 5174;

export type Role = 'host' | 'team';

/** A face-off ("who answers first") or a steal ("who gets the steal attempt"). */
export type SessionKind = 'faceoff' | 'steal';

/**
 * Button lifecycle. `thinking` is the countdown before the button goes live;
 * `ready` is when presses are accepted; `resolved` rejects any further press.
 */
export type ButtonPhase = 'idle' | 'thinking' | 'ready' | 'resolved';

export type TeamInfo = {
  id: string;
  name: string;
  color: string;
};

/** One accepted press, in server arrival order. `at` is server time (QA only). */
export type PressEntry = {
  teamId: string;
  at: number;
};

/** Broadcast view of the live session (never includes internal server fields). */
export type FaceOffPublicState = {
  sessionId: string | null;
  kind: SessionKind;
  phase: ButtonPhase;
  /** Seconds remaining in the think countdown (0 once ready). */
  remaining: number;
  /** Teams allowed to press this session. */
  eligibleTeamIds: string[];
  /** Accepted presses in server arrival order. */
  pressOrder: PressEntry[];
};

// ----------------------------------------------------------------- messages --

export type ClientMessage =
  | { type: 'hello'; role: Role }
  | { type: 'join'; teamId: string }
  | { type: 'press'; sessionId: string }
  | { type: 'start'; kind: SessionKind; thinkSeconds: number; eligibleTeamIds: string[] }
  | { type: 'reset' }
  | { type: 'resolve' }
  | { type: 'setTeams'; teams: TeamInfo[] };

export type ServerMessage =
  | {
      type: 'welcome';
      role: Role;
      teamId: string | null;
      teamName: string | null;
      teamColor: string | null;
    }
  | { type: 'teamsConfig'; teams: TeamInfo[]; connectedTeamIds: string[] }
  | { type: 'session'; session: FaceOffPublicState }
  | { type: 'error'; message: string };

// ------------------------------------------------------------------ config --

export const DEFAULT_THINK_SECONDS = 3;
export const STEAL_THINK_SECONDS = 5;
export const FACE_OFF_THINK_OPTIONS = [2, 3, 5] as const;
export const MIN_THINK_SECONDS = 1;
export const MAX_THINK_SECONDS = 30;

// ------------------------------------------------------------------ guards --

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTeamInfo(value: unknown): value is TeamInfo {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Validate an inbound (already JSON-parsed) client message. Returns null when
 * the payload is malformed so the server can safely reject it without ever
 * trusting arbitrary socket data (session ids, team ids, event types).
 */
export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'hello':
      return value.role === 'host' || value.role === 'team'
        ? { type: 'hello', role: value.role }
        : null;
    case 'join':
      return typeof value.teamId === 'string' && value.teamId !== ''
        ? { type: 'join', teamId: value.teamId }
        : null;
    case 'press':
      return typeof value.sessionId === 'string'
        ? { type: 'press', sessionId: value.sessionId }
        : null;
    case 'start':
      return (
        (value.kind === 'faceoff' || value.kind === 'steal') &&
        typeof value.thinkSeconds === 'number' &&
        isStringArray(value.eligibleTeamIds)
      )
        ? {
            type: 'start',
            kind: value.kind,
            thinkSeconds: value.thinkSeconds,
            eligibleTeamIds: value.eligibleTeamIds,
          }
        : null;
    case 'reset':
      return { type: 'reset' };
    case 'resolve':
      return { type: 'resolve' };
    case 'setTeams':
      return Array.isArray(value.teams) && value.teams.every(isTeamInfo)
        ? { type: 'setTeams', teams: value.teams }
        : null;
    default:
      return null;
  }
}
