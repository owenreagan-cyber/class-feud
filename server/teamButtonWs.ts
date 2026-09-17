import { WebSocket, WebSocketServer } from 'ws';
import type { Plugin } from 'vite';
import { TeamButtonRoom } from '../src/teamButton/room.ts';
import { TEAM_BUTTON_WS_PORT } from '../src/teamButton/protocol.ts';

/**
 * Vite plugin that runs the local Team Buttons WebSocket server alongside the
 * dev/preview HTTP server. One command (`npm run dev -- --host`) serves both
 * the app and the button server; team iPads open the app URL and connect to
 * the WebSocket on the fixed port below.
 */
export function teamButtonWsPlugin(): Plugin {
  const room = new TeamButtonRoom();
  let tickInterval: ReturnType<typeof setInterval> | null = null;

  function ensureTicking(): void {
    if (tickInterval) return;
    tickInterval = setInterval(() => {
      room.tick();
      if (!room.isThinking()) {
        if (tickInterval) clearInterval(tickInterval);
        tickInterval = null;
      }
    }, 1000);
  }

  let wss: WebSocketServer | null = null;

  function start(): void {
    // Do not open a real socket during unit test runs (vitest loads this
    // config); the room is tested directly with fake clients instead.
    if (process.env.VITEST === 'true') return;
    if (wss) return;
    wss = new WebSocketServer({ port: TEAM_BUTTON_WS_PORT });

    wss.on('connection', (socket) => {
      const clientId = room.register((message) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      });
      socket.on('message', (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          return; // ignore non-JSON garbage
        }
        room.handleMessage(clientId, parsed);
        if (room.isThinking()) ensureTicking();
      });
      socket.on('close', () => room.unregister(clientId));
      socket.on('error', () => {
        // A single client error must not take the server down.
      });
    });

    // If the port is already taken, Team Buttons are unavailable but the app
    // continues to work via manual face-off control (hard fallback).
    wss.on('error', () => {
      // Leave wss set so we don't retry in a tight loop.
    });
  }

  return {
    name: 'class-feud-team-buttons',
    configureServer() {
      start();
    },
    configurePreviewServer() {
      start();
    },
  };
}
