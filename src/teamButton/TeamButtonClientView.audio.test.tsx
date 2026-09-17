// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: string[] = [];

vi.mock('./audio', () => ({
  unlockAudio: vi.fn(() => calls.push('unlockAudio')),
  playReadyDing: vi.fn(() => calls.push('playReadyDing')),
  playFirstPress: vi.fn(() => calls.push('playFirstPress')),
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
    calls.push('socket.send:' + JSON.parse(data).type);
  }

  close() {
    this.onclose?.();
  }

  open() {
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

async function importView() {
  const mod = await import('./TeamButtonClientView');
  return mod.default;
}

describe('TeamButtonClientView audio unlock wiring', () => {
  beforeEach(() => {
    calls.length = 0;
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal(
      'sessionStorage',
      (() => {
        const store = new Map<string, string>();
        return {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => void store.set(key, value),
          removeItem: (key: string) => void store.delete(key),
        };
      })(),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('the team-join tap synchronously calls unlockAudio before the join completes', async () => {
    const TeamButtonClientView = await importView();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TeamButtonClientView />));

    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    act(() =>
      socket.receive({
        type: 'teamsConfig',
        teams: [{ id: 'red', name: 'Red', color: '#f00' }],
        connectedTeamIds: [],
      }),
    );

    const joinButton = container.querySelector('.tb-join-button') as HTMLButtonElement;
    expect(joinButton).toBeTruthy();

    expect(calls).not.toContain('unlockAudio');
    act(() => joinButton.click());
    // unlockAudio must have run synchronously as part of handling the click,
    // in the same synchronous tick as (and before) the join send.
    expect(calls).toContain('unlockAudio');
    expect(calls).toContain('socket.send:join');
    expect(calls.indexOf('unlockAudio')).toBeLessThan(calls.indexOf('socket.send:join'));

    act(() => root.unmount());
  });

  it('READY plays a ding exactly once per transition into ready', async () => {
    const TeamButtonClientView = await importView();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TeamButtonClientView />));

    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    act(() =>
      socket.receive({
        type: 'teamsConfig',
        teams: [{ id: 'red', name: 'Red', color: '#f00' }],
        connectedTeamIds: [],
      }),
    );
    const joinButton = container.querySelector('.tb-join-button') as HTMLButtonElement;
    act(() => joinButton.click());
    act(() => socket.receive({ type: 'welcome', role: 'team', teamId: 'red', teamName: 'Red', teamColor: '#f00' }));

    const thinking = {
      sessionId: 'fo-1',
      kind: 'faceoff',
      phase: 'thinking',
      remaining: 1,
      eligibleTeamIds: ['red'],
      pressOrder: [],
    };
    act(() => socket.receive({ type: 'session', session: thinking }));
    expect(calls.filter((c) => c === 'playReadyDing')).toHaveLength(0);

    const ready = { ...thinking, phase: 'ready', remaining: 0 };
    act(() => socket.receive({ type: 'session', session: ready }));
    expect(calls.filter((c) => c === 'playReadyDing')).toHaveLength(1);

    // A duplicate broadcast of the same ready session must not replay the ding.
    act(() => socket.receive({ type: 'session', session: { ...ready } }));
    expect(calls.filter((c) => c === 'playReadyDing')).toHaveLength(1);

    act(() => root.unmount());
  });

  it('a press sends to the server before touching audio, and a double tap does not double-send or double-play', async () => {
    const TeamButtonClientView = await importView();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TeamButtonClientView />));

    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    act(() =>
      socket.receive({
        type: 'teamsConfig',
        teams: [{ id: 'red', name: 'Red', color: '#f00' }],
        connectedTeamIds: [],
      }),
    );
    const joinButton = container.querySelector('.tb-join-button') as HTMLButtonElement;
    act(() => joinButton.click());
    act(() => socket.receive({ type: 'welcome', role: 'team', teamId: 'red', teamName: 'Red', teamColor: '#f00' }));

    const ready = {
      sessionId: 'fo-1',
      kind: 'faceoff',
      phase: 'ready',
      remaining: 0,
      eligibleTeamIds: ['red'],
      pressOrder: [],
    };
    act(() => socket.receive({ type: 'session', session: ready }));
    calls.length = 0; // isolate this test's assertions from the join/ready sequence above

    const answerButton = container.querySelector('.tb-answer-button') as HTMLButtonElement;
    expect(answerButton).toBeTruthy();

    act(() => answerButton.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    const pressIndex = calls.indexOf('socket.send:press');
    const audioIndex = calls.indexOf('playFirstPress');
    expect(pressIndex).toBeGreaterThanOrEqual(0);
    expect(audioIndex).toBeGreaterThan(pressIndex);

    // Rapid second tap: the press latch blocks a second send/sound entirely.
    act(() => answerButton.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(calls.filter((c) => c === 'socket.send:press')).toHaveLength(1);
    expect(calls.filter((c) => c === 'playFirstPress')).toHaveLength(1);

    act(() => root.unmount());
  });
});
