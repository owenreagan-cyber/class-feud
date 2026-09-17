// Team Buttons room — server-side authority for face-off/steal sessions.
//
// Pure and transport-agnostic: it holds no socket/timer of its own. The Vite
// WebSocket plugin (server/teamButtonWs.ts) owns sockets and the 1-second
// tick interval and calls into this room. Keeping the room pure makes it fully
// unit-testable with fake clients.

import {
  createIdleFaceOff,
  reduceFaceOff,
  toPublicFaceOff,
} from './faceOffMachine.ts';
import type { FaceOffState } from './faceOffMachine.ts';
import { parseClientMessage } from './protocol.ts';
import type { ClientMessage, Role, ServerMessage, TeamInfo } from './protocol.ts';

export type RoomClient = {
  id: string;
  role: Role | null;
  teamId: string | null;
  send: (message: ServerMessage) => void;
};

let clientCounter = 0;
function nextClientId(): string {
  clientCounter += 1;
  return `c-${clientCounter}`;
}

export class TeamButtonRoom {
  private clients = new Map<string, RoomClient>();
  private hostId: string | null = null;
  private teams: TeamInfo[] = [];
  private machine: FaceOffState = createIdleFaceOff();
  private readonly now: () => number;
  // Optional shared secret used ONLY as an accidental host-role takeover
  // guard. It is NOT authentication or a security credential: any client on
  // the LAN can read it, so it just prevents a student device from
  // accidentally claiming the host role. `null` disables the guard (tests and
  // default behavior).
  private readonly hostKey: string | null;

  constructor(now: () => number = () => Date.now(), hostKey: string | null = null) {
    this.now = now;
    this.hostKey = hostKey;
  }

  /** Register a new connection; returns its client id. Role is set by `hello`. */
  register(send: (message: ServerMessage) => void): string {
    const id = nextClientId();
    this.clients.set(id, { id, role: null, teamId: null, send });
    return id;
  }

  unregister(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    if (this.hostId === clientId) this.hostId = null;
    this.broadcastTeamsConfig();
  }

  handleMessage(clientId: string, raw: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    const message = parseClientMessage(raw);
    if (!message) {
      client.send({ type: 'error', message: 'Malformed message rejected.' });
      return;
    }
    this.dispatch(client, message);
  }

  /** Advance the think countdown by one second (called by the plugin). */
  tick(): void {
    if (this.machine.phase !== 'thinking') return;
    this.machine = reduceFaceOff(this.machine, { type: 'tick' });
    this.broadcastSession();
  }

  isThinking(): boolean {
    return this.machine.phase === 'thinking';
  }

  private dispatch(client: RoomClient, message: ClientMessage): void {
    switch (message.type) {
      case 'hello': {
        if (
          message.role === 'host' &&
          this.hostKey !== null &&
          message.hostKey !== this.hostKey
        ) {
          // Reject the accidental/unauthorized host claim without touching
          // this client's role or the current host's authority. The existing
          // valid host (if any) stays authoritative.
          client.send({ type: 'error', message: 'Host key mismatch.' });
          return;
        }
        client.role = message.role;
        if (message.role === 'host') {
          // A (re)connecting host takes over: demote the previous host and
          // reset only the transient button session. Configured teams and any
          // live team-client joins are preserved; a later `setTeams` prunes
          // stale teams normally.
          if (this.hostId !== null && this.hostId !== client.id) {
            const old = this.clients.get(this.hostId);
            if (old) {
              old.role = 'team';
              old.send({ type: 'demoted' });
            }
          }
          this.hostId = client.id;
          this.machine = createIdleFaceOff();
        }
        client.send({
          type: 'welcome',
          role: message.role,
          teamId: client.teamId,
          teamName: this.teamName(client.teamId),
          teamColor: this.teamColor(client.teamId),
        });
        this.broadcastTeamsConfig();
        this.broadcastSession();
        return;
      }

      case 'setTeams': {
        if (!this.isHost(client)) return this.deny(client);
        this.teams = message.teams.map((team) => ({ ...team }));
        // Drop associations for teams that no longer exist.
        for (const existing of this.clients.values()) {
          if (existing.teamId && !this.teams.some((team) => team.id === existing.teamId)) {
            existing.teamId = null;
          }
        }
        this.broadcastTeamsConfig();
        return;
      }

      case 'join': {
        if (client.role !== 'team') return this.deny(client);
        const team = this.teams.find((entry) => entry.id === message.teamId);
        if (!team) {
          client.send({ type: 'error', message: 'Unknown team.' });
          return;
        }
        const occupied = this.clientForTeam(message.teamId);
        if (occupied && occupied.id !== client.id) {
          client.send({ type: 'error', message: 'That team is already joined.' });
          return;
        }
        client.teamId = team.id;
        client.send({
          type: 'welcome',
          role: 'team',
          teamId: team.id,
          teamName: team.name,
          teamColor: team.color,
        });
        this.broadcastTeamsConfig();
        return;
      }

      case 'press': {
        if (client.role !== 'team' || client.teamId === null) return this.deny(client);
        const before = this.machine;
        this.machine = reduceFaceOff(this.machine, {
          type: 'press',
          teamId: client.teamId,
          sessionId: message.sessionId,
          at: this.now(),
        });
        if (this.machine !== before) this.broadcastSession();
        return;
      }

      case 'start': {
        if (!this.isHost(client)) return this.deny(client);
        this.machine = reduceFaceOff(this.machine, {
          type: 'start',
          kind: message.kind,
          thinkSeconds: message.thinkSeconds,
          eligibleTeamIds: message.eligibleTeamIds,
        });
        this.broadcastSession();
        return;
      }

      case 'resolve': {
        if (!this.isHost(client)) return this.deny(client);
        this.machine = reduceFaceOff(this.machine, { type: 'resolve' });
        this.broadcastSession();
        return;
      }

      case 'reset': {
        if (!this.isHost(client)) return this.deny(client);
        this.machine = reduceFaceOff(this.machine, { type: 'reset' });
        this.broadcastSession();
        return;
      }

      default:
        return;
    }
  }

  private isHost(client: RoomClient): boolean {
    return client.role === 'host' && client.id === this.hostId;
  }

  private deny(client: RoomClient): void {
    client.send({ type: 'error', message: 'Not authorized for that action.' });
  }

  private clientForTeam(teamId: string): RoomClient | null {
    for (const client of this.clients.values()) {
      if (client.teamId === teamId) return client;
    }
    return null;
  }

  private teamName(teamId: string | null): string | null {
    if (teamId === null) return null;
    return this.teams.find((team) => team.id === teamId)?.name ?? null;
  }

  private teamColor(teamId: string | null): string | null {
    if (teamId === null) return null;
    return this.teams.find((team) => team.id === teamId)?.color ?? null;
  }

  private connectedTeamIds(): string[] {
    const ids: string[] = [];
    for (const client of this.clients.values()) {
      if (client.teamId && !ids.includes(client.teamId)) ids.push(client.teamId);
    }
    return ids;
  }

  private broadcastTeamsConfig(): void {
    this.broadcast({
      type: 'teamsConfig',
      teams: this.teams.map((team) => ({ ...team })),
      connectedTeamIds: this.connectedTeamIds(),
    });
  }

  private broadcastSession(): void {
    this.broadcast({ type: 'session', session: toPublicFaceOff(this.machine) });
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.clients.values()) {
      client.send(message);
    }
  }
}
