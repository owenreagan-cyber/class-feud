import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { sweepHeartbeat } from './heartbeat';
import type { HeartbeatClient } from './heartbeat';

function fakeSocket(readyState: number) {
  return {
    readyState,
    ping: vi.fn<() => void>(),
    terminate: vi.fn<() => void>(),
  };
}

describe('sweepHeartbeat', () => {
  it('terminates a client with alive=false', () => {
    const socket = fakeSocket(WebSocket.OPEN);
    const client: HeartbeatClient = { socket, alive: false };

    sweepHeartbeat([client]);

    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(socket.ping).not.toHaveBeenCalled();
  });

  it('pings an alive OPEN client and marks it false', () => {
    const socket = fakeSocket(WebSocket.OPEN);
    const client: HeartbeatClient = { socket, alive: true };

    sweepHeartbeat([client]);

    expect(socket.ping).toHaveBeenCalledTimes(1);
    expect(socket.terminate).not.toHaveBeenCalled();
    expect(client.alive).toBe(false);
  });

  it('a pong (alive reset to true) prevents termination on the next sweep', () => {
    const socket = fakeSocket(WebSocket.OPEN);
    const client: HeartbeatClient = { socket, alive: true };

    sweepHeartbeat([client]); // ping, alive -> false
    client.alive = true; // simulate the socket's `pong` handler
    sweepHeartbeat([client]); // ping again, but never terminate

    expect(socket.terminate).not.toHaveBeenCalled();
    expect(socket.ping).toHaveBeenCalledTimes(2);
    expect(client.alive).toBe(false);
  });

  it('skips CLOSING and CLOSED sockets (no terminate, no ping)', () => {
    for (const readyState of [WebSocket.CLOSING, WebSocket.CLOSED]) {
      const dead = fakeSocket(readyState);
      sweepHeartbeat([{ socket: dead, alive: false }]);
      expect(dead.terminate).not.toHaveBeenCalled();
      expect(dead.ping).not.toHaveBeenCalled();

      const almostDead = fakeSocket(readyState);
      sweepHeartbeat([{ socket: almostDead, alive: true }]);
      expect(almostDead.terminate).not.toHaveBeenCalled();
      expect(almostDead.ping).not.toHaveBeenCalled();
    }
  });
});
