import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer as createNetServer } from 'node:net';
import { WebSocket } from 'ws';
import { teamButtonWsPlugin, TEAM_BUTTON_WS_HOST } from './teamButtonWs';
import { TEAM_BUTTON_WS_PORT } from '../src/teamButton/protocol';

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once('error', () => resolve(true)); // EADDRINUSE
    probe.once('listening', () => {
      probe.close(() => resolve(false));
    });
    probe.listen(port, '0.0.0.0');
  });
}

async function waitForPortState(port: number, wantInUse: boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const inUse = await portInUse(port);
    if (inUse === wantInUse) return;
    if (Date.now() > deadline) {
      throw new Error(
        `port ${port} did not reach ${wantInUse ? 'in-use' : 'free'} state within ${timeoutMs}ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return;
    if (Date.now() > deadline) throw new Error('condition not met within timeout');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('teamButtonWsPlugin lifecycle', () => {
  const originalVitest = process.env.VITEST;

  beforeEach(() => {
    delete process.env.VITEST;
  });

  afterEach(() => {
    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;
    vi.restoreAllMocks();
  });

  it('binds, tears down, and re-binds without leaving a duplicate heartbeat interval', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const plugin = teamButtonWsPlugin({ heartbeatIntervalMs: 60_000 });
    const start = plugin.configureServer as unknown as () => void;
    const stop = plugin.closeServer as unknown as () => void;

    // 1. bind
    start();
    await waitForPortState(TEAM_BUTTON_WS_PORT, true);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1); // exactly one heartbeat interval
    const firstTimer = setIntervalSpy.mock.results[0].value as ReturnType<typeof setInterval>;

    // 2. teardown
    stop();
    await waitForPortState(TEAM_BUTTON_WS_PORT, false);
    expect(clearIntervalSpy).toHaveBeenCalledWith(firstTimer);

    // 3. re-bind with the same plugin
    start();
    await waitForPortState(TEAM_BUTTON_WS_PORT, true);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2); // one new interval, not two
    const secondTimer = setIntervalSpy.mock.results[1].value as ReturnType<typeof setInterval>;
    expect(secondTimer).not.toBe(firstTimer);

    // 4. final teardown
    stop();
    await waitForPortState(TEAM_BUTTON_WS_PORT, false);
    expect(clearIntervalSpy).toHaveBeenCalledWith(secondTimer);
    // Every created interval was cleared — no duplicate heartbeat survives.
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it('binds explicitly to 0.0.0.0 and accepts a LAN client', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const plugin = teamButtonWsPlugin({ heartbeatIntervalMs: 60_000 });
    const start = plugin.configureServer as unknown as () => void;
    const stop = plugin.closeServer as unknown as () => void;

    start();
    await waitForPortState(TEAM_BUTTON_WS_PORT, true);
    await waitFor(() =>
      logSpy.mock.calls.flat().join(' ').includes(`ws://${TEAM_BUTTON_WS_HOST}:${TEAM_BUTTON_WS_PORT}`),
    );

    // A client can actually connect over loopback, proving the bind is live.
    const client = new WebSocket(`ws://127.0.0.1:${TEAM_BUTTON_WS_PORT}`);
    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    client.close();

    stop();
    await waitForPortState(TEAM_BUTTON_WS_PORT, false);
    logSpy.mockRestore();
  });

  it('logs a clear error and keeps manual fallback when the WS port is taken', async () => {
    const blocker = createNetServer();
    await new Promise<void>((resolve) => blocker.listen(TEAM_BUTTON_WS_PORT, '0.0.0.0', resolve));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin = teamButtonWsPlugin({ heartbeatIntervalMs: 60_000 });
    const start = plugin.configureServer as unknown as () => void;
    const stop = plugin.closeServer as unknown as () => void;

    expect(() => start()).not.toThrow();
    await waitFor(() =>
      errSpy.mock.calls.flat().join(' ').includes('WebSocket server unavailable'),
    );

    stop();
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
    errSpy.mockRestore();
  });

  it('logs the classroom startup summary', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const plugin = teamButtonWsPlugin({ heartbeatIntervalMs: 60_000 });
    const configure = plugin.configureServer as unknown as (
      server: { config: { server: { port?: number } } },
    ) => void;
    const stop = plugin.closeServer as unknown as () => void;

    configure({ config: { server: { port: 5173 } } });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Class Feud:');
    expect(output).toContain('HTTP: http://<host>:5173');
    expect(output).toContain(`Team Buttons WebSocket: ws://${TEAM_BUTTON_WS_HOST}:${TEAM_BUTTON_WS_PORT}`);

    stop();
    await waitForPortState(TEAM_BUTTON_WS_PORT, false);
    logSpy.mockRestore();
  });
});
