import { WebSocket, WebSocketServer } from 'ws';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { TeamButtonRoom } from '../src/teamButton/room.ts';
import { TEAM_BUTTON_WS_PORT } from '../src/teamButton/protocol.ts';
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  sweepHeartbeat,
} from './heartbeat.ts';
import type { HeartbeatClient } from './heartbeat.ts';

/** The HTTP (Vite) port the classroom runbook targets. Must match vite.config.ts. */
export const TEAM_BUTTON_HTTP_PORT = 5173;

/** Explicit LAN bind for the Team Buttons WebSocket (all IPv4 interfaces). */
export const TEAM_BUTTON_WS_HOST = '0.0.0.0';

// Accidental host-role takeover guard (NOT authentication): the teacher host
// supplies this value in the URL query (`?host=teacher`) and the room only
// accepts a host `hello` whose `hostKey` matches. Any LAN peer can read it, so
// it does not authenticate anyone or act as a security credential/login — it
// only stops a student device from accidentally claiming the host role.
const TEACHER_HOST_KEY = process.env.CLASS_FEUD_HOST_KEY ?? 'teacher';

/**
 * Vite plugin that runs the local Team Buttons WebSocket server alongside the
 * dev/preview HTTP server. One command (`npm run dev -- --host`) serves both
 * the app and the button server; team iPads open the app URL and connect to
 * the WebSocket on the fixed port below.
 */
export function teamButtonWsPlugin(
  options: { heartbeatIntervalMs?: number } = {},
): Plugin {
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const room = new TeamButtonRoom(() => Date.now(), TEACHER_HOST_KEY);
  const heartbeatClients = new Set<HeartbeatClient>();

  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

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
    // Bind explicitly to all IPv4 interfaces: classroom iPads reach the Mac
    // over an IPv4 LAN address, and this avoids depending on the `ws` library's
    // implicit IPv6 `::` dual-stack default.
    wss = new WebSocketServer({ host: TEAM_BUTTON_WS_HOST, port: TEAM_BUTTON_WS_PORT });

    wss.on('listening', () => {
      console.log(
        `[Team Buttons] WebSocket server listening on ws://${TEAM_BUTTON_WS_HOST}:${TEAM_BUTTON_WS_PORT}`,
      );
    });

    // Heartbeat: terminate clients that stop answering pings.
    heartbeatInterval = setInterval(() => {
      if (!wss) return; // guard against a teardown race during shutdown
      sweepHeartbeat(heartbeatClients);
    }, heartbeatIntervalMs);

    wss.on('connection', (socket) => {
      const clientId = room.register((message) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      });

      const client: HeartbeatClient = { socket, alive: true };
      heartbeatClients.add(client);
      // A pong marks the client alive again so the next sweep does not
      // terminate it.
      socket.on('pong', () => {
        client.alive = true;
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
      socket.on('close', () => {
        heartbeatClients.delete(client);
        room.unregister(clientId);
      });
      socket.on('error', () => {
        // A single client error must not take the server down.
      });
    });

    // If the port is already taken, Team Buttons are unavailable but the app
    // continues to work via manual face-off control (hard fallback). Surface
    // the failure so the teacher knows to use manual mode.
    wss.on('error', (err: Error) => {
      console.error(
        '[Team Buttons] WebSocket server unavailable on ' +
          TEAM_BUTTON_WS_HOST +
          ':' +
          TEAM_BUTTON_WS_PORT +
          ' (' +
          err.message +
          '). Team Buttons disabled — use manual face-off.',
      );
    });
  }

  function logStartup(httpPort: number): void {
    // Deliberately do not guess the Wi-Fi IP: the runbook (`ipconfig getifaddr
    // en0`) remains authoritative for the actual address. `<host>` is a
    // placeholder for that address.
    console.log('Class Feud:');
    console.log(`  HTTP: http://<host>:${httpPort}`);
    console.log(`  Team Buttons WebSocket: ws://${TEAM_BUTTON_WS_HOST}:${TEAM_BUTTON_WS_PORT}`);
  }

  /**
   * Idempotent teardown: clears the heartbeat (and think) intervals, nulls
   * their references, captures and nulls `wss`, then closes the captured
   * server. Safe to call multiple times.
   */
  function stop(): void {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    const server = wss;
    wss = null;
    if (server) {
      server.close();
    }
  }

  return {
    name: 'class-feud-team-buttons',
    configureServer(server?: ViteDevServer) {
      start();
      // Vitest also loads vite.config.ts and invokes these hooks for its own
      // server; skip the banner there (start() already no-ops under VITEST).
      if (server && process.env.VITEST !== 'true') {
        logStartup(server.config.server.port ?? TEAM_BUTTON_HTTP_PORT);
      }
    },
    configurePreviewServer(server?: PreviewServer) {
      start();
      if (server && process.env.VITEST !== 'true') {
        logStartup(server.config.preview.port ?? TEAM_BUTTON_HTTP_PORT);
      }
    },
    closeServer() {
      stop();
    },
    closePreviewServer() {
      stop();
    },
  };
}
