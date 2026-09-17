// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeamButtonClient } from './useTeamButtonClient';
import type { TeamButtonClient } from './useTeamButtonClient';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
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
    this.sent.push(data);
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

function render(element: ReactElement): { rerender: (el: ReactElement) => void; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    rerender: (el) => {
      act(() => {
        root.render(el);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function Harness({ onClient }: { onClient: (client: TeamButtonClient) => void }) {
  const client = useTeamButtonClient();
  onClient(client);
  return null;
}

describe('useTeamButtonClient join rollback', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('sessionStorage', (() => {
      const store = new Map<string, string>();
      return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      };
    })());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rolls back an optimistic team claim when the server rejects the join', () => {
    let latest: TeamButtonClient | null = null;
    const harness = render(<Harness onClient={(c) => { latest = c; }} />);

    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());

    act(() => latest!.joinTeam('red'));
    expect(latest!.myTeamId).toBe('red');

    act(() => socket.receive({ type: 'error', message: 'That team is already joined.' }));

    expect(latest!.myTeamId).toBeNull();
    expect(latest!.error).toBe('That team is already joined.');

    harness.unmount();
  });

  it('keeps the claimed team once the server confirms with a welcome message', () => {
    let latest: TeamButtonClient | null = null;
    const harness = render(<Harness onClient={(c) => { latest = c; }} />);

    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());

    act(() => latest!.joinTeam('blue'));
    act(() => socket.receive({ type: 'welcome', role: 'team', teamId: 'blue', teamName: 'Blue', teamColor: '#00f' }));

    expect(latest!.myTeamId).toBe('blue');

    // An unrelated later error must not roll back a join that already succeeded.
    act(() => socket.receive({ type: 'error', message: 'Not authorized for that action.' }));
    expect(latest!.myTeamId).toBe('blue');

    harness.unmount();
  });
});
