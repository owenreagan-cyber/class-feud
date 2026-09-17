// Face-off / steal state machine (pure, dependency-free).
//
// Owns ONLY button ordering and eligibility. It never touches game scoring,
// possession, or phase — those stay with the game reducer. The server wraps
// this machine with a WebSocket transport; the machine is the single source of
// truth for when presses are accepted and in what order they rank.

import type {
  ButtonPhase,
  FaceOffPublicState,
  PressEntry,
  SessionKind,
} from './protocol.ts';

export type FaceOffState = FaceOffPublicState & {
  /** Teams that already pressed this session (spam/stale press protection). */
  pressedTeamIds: ReadonlySet<string>;
};

export type FaceOffEvent =
  | { type: 'start'; kind: SessionKind; thinkSeconds: number; eligibleTeamIds: string[] }
  | { type: 'tick' }
  | { type: 'press'; teamId: string; sessionId: string; at: number }
  | { type: 'reset' }
  | { type: 'resolve' };

let sessionCounter = 0;

/** Monotonic, unique session id so stale presses from a prior session are ignored. */
export function nextSessionId(): string {
  sessionCounter += 1;
  return `fo-${sessionCounter}-${Date.now().toString(36)}`;
}

export function createIdleFaceOff(): FaceOffState {
  return {
    sessionId: null,
    kind: 'faceoff',
    phase: 'idle',
    remaining: 0,
    eligibleTeamIds: [],
    pressOrder: [],
    pressedTeamIds: new Set<string>(),
  };
}

/** Strip the private `pressedTeamIds` set before broadcasting to clients. */
export function toPublicFaceOff(state: FaceOffState): FaceOffPublicState {
  return {
    sessionId: state.sessionId,
    kind: state.kind,
    phase: state.phase,
    remaining: state.remaining,
    eligibleTeamIds: state.eligibleTeamIds,
    pressOrder: state.pressOrder.map((entry) => ({ ...entry })),
  };
}

/**
 * Reduce the machine by one event. Returns the same reference when the event
 * is a no-op (so callers can cheaply detect "nothing changed").
 */
export function reduceFaceOff(state: FaceOffState, event: FaceOffEvent): FaceOffState {
  switch (event.type) {
    case 'start': {
      if (event.eligibleTeamIds.length === 0) return state;
      const thinkSeconds = Math.min(
        Math.max(1, Math.floor(event.thinkSeconds)),
        30,
      );
      return {
        sessionId: nextSessionId(),
        kind: event.kind,
        phase: 'thinking',
        remaining: thinkSeconds,
        eligibleTeamIds: [...event.eligibleTeamIds],
        pressOrder: [],
        pressedTeamIds: new Set<string>(),
      };
    }

    case 'tick': {
      if (state.phase !== 'thinking') return state;
      const remaining = state.remaining - 1;
      return {
        ...state,
        remaining,
        phase: remaining <= 0 ? 'ready' : 'thinking',
      };
    }

    case 'press': {
      // Only accepted while live AND from the correct session AND an eligible
      // team that has not already pressed. A press during LOCKED/THINKING, a
      // stale session id, a duplicate, or an ineligible team is ignored.
      if (state.phase !== 'ready') return state;
      if (state.sessionId === null || event.sessionId !== state.sessionId) return state;
      if (!state.eligibleTeamIds.includes(event.teamId)) return state;
      if (state.pressedTeamIds.has(event.teamId)) return state;

      const pressOrder: PressEntry[] = [...state.pressOrder, { teamId: event.teamId, at: event.at }];
      const pressedTeamIds = new Set(state.pressedTeamIds).add(event.teamId);
      return { ...state, pressOrder, pressedTeamIds };
    }

    case 'resolve': {
      if (state.phase === 'idle' || state.phase === 'resolved') return state;
      return { ...state, phase: 'resolved' };
    }

    case 'reset':
      return createIdleFaceOff();

    default:
      return state;
  }
}

/** Whether the given team has an accepted press in the current session. */
export function hasPressed(state: FaceOffState, teamId: string): boolean {
  return state.pressOrder.some((entry) => entry.teamId === teamId);
}

/** The team that pressed first, or null when no presses yet. */
export function firstPressTeamId(state: FaceOffState): string | null {
  return state.pressOrder[0]?.teamId ?? null;
}

export type { ButtonPhase, PressEntry, SessionKind };
