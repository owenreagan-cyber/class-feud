// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeamButtonConnection, CONNECTION_WARNING_DELAY_MS } from './useTeamButtonConnection';
import type { TeamButtonConnection } from './useTeamButtonConnection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;
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
    void data;
  }

  close() {
    this.onclose?.();
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  error() {
    this.onerror?.();
  }
}

let latest: TeamButtonConnection | null = null;

function Harness({ onConn }: { onConn: (c: TeamButtonConnection) => void }) {
  const conn = useTeamButtonConnection({
    role: 'team',
    onOpen: () => {},
    onMessage: () => {},
  });
  onConn(conn);
  return null;
}

function mount(): Root {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness onConn={(c) => { latest = c; }} />));
  return root;
}

describe('useTeamButtonConnection stalled warning', () => {
  beforeEach(() => {
    latest = null;
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('does not warn before the delay elapses', () => {
    const root = mount();
    act(() => vi.advanceTimersByTime(CONNECTION_WARNING_DELAY_MS - 1));
    expect(latest?.stalled).toBe(false);
    act(() => root.unmount());
  });

  it('sets stalled after the delay while the socket stays unopened', () => {
    const root = mount();
    act(() => vi.advanceTimersByTime(CONNECTION_WARNING_DELAY_MS));
    expect(latest?.stalled).toBe(true);
    act(() => root.unmount());
  });

  it('clears stalled when the socket opens', () => {
    const root = mount();
    act(() => vi.advanceTimersByTime(CONNECTION_WARNING_DELAY_MS));
    expect(latest?.stalled).toBe(true);

    act(() => FakeWebSocket.instances[0].open());
    expect(latest?.stalled).toBe(false);
    expect(latest?.status).toBe('open');
    act(() => root.unmount());
  });

  it('keeps reconnecting after the warning fires and stays stalled', () => {
    const root = mount();
    act(() => vi.advanceTimersByTime(CONNECTION_WARNING_DELAY_MS));
    expect(latest?.stalled).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);

    // The unopened socket errors and closes; the hook must schedule a retry.
    act(() => FakeWebSocket.instances[0].error());
    act(() => vi.advanceTimersByTime(5000)); // enough for the capped backoff
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);

    // The warning persists across reconnect attempts until a socket opens.
    expect(latest?.stalled).toBe(true);

    // Opening the replacement socket clears it.
    act(() => FakeWebSocket.instances[FakeWebSocket.instances.length - 1].open());
    expect(latest?.stalled).toBe(false);
    act(() => root.unmount());
  });
});
