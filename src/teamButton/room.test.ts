import { describe, expect, it } from 'vitest';
import { TeamButtonRoom } from './room';
import type { ServerMessage } from './protocol';

type FakeClient = { id: string; sent: ServerMessage[] };

function makeClient(room: TeamButtonRoom): FakeClient {
  const sent: ServerMessage[] = [];
  const id = room.register((message) => sent.push(message));
  return { id, sent };
}

function last(client: FakeClient, type: ServerMessage['type']): ServerMessage | undefined {
  return [...client.sent].reverse().find((message) => message.type === type);
}

const TEAMS = [
  { id: 'team-red', name: 'Red', color: '#ef4444' },
  { id: 'team-blue', name: 'Blue', color: '#3b82f6' },
];

function setup(): { room: TeamButtonRoom; host: FakeClient } {
  const room = new TeamButtonRoom(() => 0);
  const host = makeClient(room);
  room.handleMessage(host.id, { type: 'hello', role: 'host' });
  room.handleMessage(host.id, { type: 'setTeams', teams: TEAMS });
  return { room, host };
}

function join(room: TeamButtonRoom, teamId: string): FakeClient {
  const client = makeClient(room);
  room.handleMessage(client.id, { type: 'hello', role: 'team' });
  room.handleMessage(client.id, { type: 'join', teamId });
  return client;
}

function startFaceoff(room: TeamButtonRoom, host: FakeClient): void {
  room.handleMessage(host.id, {
    type: 'start',
    kind: 'faceoff',
    thinkSeconds: 1,
    eligibleTeamIds: ['team-red', 'team-blue'],
  });
  room.tick(); // 1 -> ready
}

describe('TeamButtonRoom', () => {
  it('assigns a team on join and reports the runtime name/color', () => {
    const { room } = setup();
    const red = join(room, 'team-red');
    expect(last(red, 'welcome')).toMatchObject({
      teamId: 'team-red',
      teamName: 'Red',
      teamColor: '#ef4444',
    });
  });

  it('rejects a duplicate team join while the first stays', () => {
    const { room } = setup();
    const red = join(room, 'team-red');
    const dup = makeClient(room);
    room.handleMessage(dup.id, { type: 'hello', role: 'team' });
    room.handleMessage(dup.id, { type: 'join', teamId: 'team-red' });
    expect(last(dup, 'error')).toBeDefined();
    // The duplicate never got the team; the original is untouched.
    expect(last(dup, 'welcome')).toMatchObject({ teamId: null });
    expect(last(red, 'welcome')).toMatchObject({ teamId: 'team-red' });
  });

  it('rejects an unknown team join', () => {
    const { room } = setup();
    const client = makeClient(room);
    room.handleMessage(client.id, { type: 'hello', role: 'team' });
    room.handleMessage(client.id, { type: 'join', teamId: 'team-nope' });
    expect(last(client, 'error')).toBeDefined();
  });

  it('reports connected teams and updates on disconnect', () => {
    const { room, host } = setup();
    join(room, 'team-red');
    const blue = join(room, 'team-blue');
    let config = last(host, 'teamsConfig') as { connectedTeamIds: string[] };
    expect(config.connectedTeamIds).toEqual(['team-red', 'team-blue']);

    room.unregister(blue.id);
    config = last(host, 'teamsConfig') as { connectedTeamIds: string[] };
    expect(config.connectedTeamIds).toEqual(['team-red']);
  });

  it('reconnect restores a team association safely', () => {
    const { room } = setup();
    const red = join(room, 'team-red');
    room.unregister(red.id); // device drops
    const rejoin = join(room, 'team-red'); // new device re-joins the vacant team
    expect(last(rejoin, 'welcome')).toMatchObject({ teamId: 'team-red', teamName: 'Red' });
  });

  it('rejects malformed messages without crashing', () => {
    const { room, host } = setup();
    room.handleMessage(host.id, {
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 'x',
      eligibleTeamIds: ['a'],
    });
    expect(last(host, 'error')).toBeDefined();
    room.handleMessage(host.id, null);
    room.handleMessage(host.id, 'garbage');
    // Room still works afterward.
    room.handleMessage(host.id, {
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 3,
      eligibleTeamIds: ['team-red'],
    });
    expect(last(host, 'session')).toBeDefined();
  });

  it('host start broadcasts a session and ticks to ready', () => {
    const { room, host } = setup();
    room.handleMessage(host.id, {
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 2,
      eligibleTeamIds: ['team-red', 'team-blue'],
    });
    expect((last(host, 'session') as { session: { phase: string } }).session.phase).toBe('thinking');

    room.tick();
    room.tick();
    expect((last(host, 'session') as { session: { phase: string } }).session.phase).toBe('ready');
  });

  it('accepts a press from a joined team and records server order', () => {
    const { room, host } = setup();
    const red = join(room, 'team-red');
    const blue = join(room, 'team-blue');
    startFaceoff(room, host);
    const ready = last(host, 'session') as { session: { sessionId: string } };
    room.handleMessage(red.id, { type: 'press', sessionId: ready.session.sessionId });
    room.handleMessage(blue.id, { type: 'press', sessionId: ready.session.sessionId });
    const after = last(host, 'session') as {
      session: { pressOrder: Array<{ teamId: string; at: number }> };
    };
    expect(after.session.pressOrder.map((entry) => entry.teamId)).toEqual([
      'team-red',
      'team-blue',
    ]);
  });

  it('press from a client that has not joined a team is ignored', () => {
    const { room, host } = setup();
    const ghost = makeClient(room);
    room.handleMessage(ghost.id, { type: 'hello', role: 'team' });
    startFaceoff(room, host);
    const ready = last(host, 'session') as { session: { sessionId: string } };
    room.handleMessage(ghost.id, { type: 'press', sessionId: ready.session.sessionId });
    const after = last(host, 'session') as { session: { pressOrder: unknown[] } };
    expect(after.session.pressOrder).toEqual([]);
  });

  it('non-host cannot start a session', () => {
    const { room } = setup();
    const red = join(room, 'team-red');
    room.handleMessage(red.id, {
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 1,
      eligibleTeamIds: ['team-red'],
    });
    expect(last(red, 'error')).toBeDefined();
    expect(room.isThinking()).toBe(false);
  });

  it('manual fallback: the room is functional with zero clients', () => {
    const room = new TeamButtonRoom(() => 0);
    expect(room.isThinking()).toBe(false);
    expect(() => room.tick()).not.toThrow();
  });

  it('new host connection clears stale team associations', () => {
    const { room, host } = setup();
    join(room, 'team-red');
    const secondHost = makeClient(room);
    room.handleMessage(secondHost.id, { type: 'hello', role: 'host' });
    const config = last(secondHost, 'teamsConfig') as { teams: unknown[]; connectedTeamIds: string[] };
    expect(config.teams).toEqual([]);
    expect(config.connectedTeamIds).toEqual([]);
    // The old host is no longer authoritative.
    room.handleMessage(host.id, {
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 1,
      eligibleTeamIds: ['team-red'],
    });
    expect(last(host, 'error')).toBeDefined();
  });
});
