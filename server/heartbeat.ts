// Team Button WebSocket liveness (heartbeat). Narrow by design: this module
// knows ONLY about WebSocket liveness — nothing about teams, roles, or the
// room. The Vite plugin (server/teamButtonWs.ts) owns the interval and the
// `pong` wiring; this module is just the per-sweep logic so it stays fully
// unit-testable with fake sockets.
//
// TODO: real sleeping-device heartbeat E2E (see followup-team-button-hardening.md).

import { WebSocket } from 'ws';

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

/** The subset of a WebSocket that a heartbeat sweep needs. */
export type HeartbeatSocket = {
  readonly readyState: number;
  ping: () => void;
  terminate: () => void;
};

export type HeartbeatClient = {
  socket: HeartbeatSocket;
  /** True until a sweep pings it; reset to true again by the socket's `pong`. */
  alive: boolean;
};

/**
 * One heartbeat sweep. For each client:
 * - CLOSING/CLOSED sockets are skipped entirely.
 * - `alive: false` (missed the last pong) → terminate.
 * - `alive: true` and OPEN → mark false and ping. The caller's `pong` handler
 *   resets `alive` to true so the next sweep does not terminate.
 *
 * Pinging requires the socket to be OPEN; any other live-but-not-open state is
 * left alone for a future sweep.
 */
export function sweepHeartbeat(clients: Iterable<HeartbeatClient>): void {
  for (const client of clients) {
    const { socket } = client;
    if (
      socket.readyState === WebSocket.CLOSING ||
      socket.readyState === WebSocket.CLOSED
    ) {
      continue;
    }
    if (!client.alive) {
      socket.terminate();
      continue;
    }
    if (socket.readyState === WebSocket.OPEN) {
      client.alive = false;
      socket.ping();
    }
  }
}
