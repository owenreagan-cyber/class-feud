import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer as createNetServer } from 'node:net';
import { teamButtonWsPlugin } from './teamButtonWs';
import { TEAM_BUTTON_WS_PORT } from '../src/teamButton/protocol';

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once('error', () => resolve(true)); // EADDRINUSE
    probe.once('listening', () => {
      probe.close(() => resolve(false));
    });
    probe.listen(port, '::');
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

describe('teamButtonWsPlugin lifecycle', () => {
  const originalVitest = process.env.VITEST;

  afterEach(() => {
    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;
    vi.restoreAllMocks();
  });

  it('binds, tears down, and re-binds without leaving a duplicate heartbeat interval', async () => {
    // This single test intentionally binds a real, test-owned listener, so it
    // must bypass the "no real socket during vitest" guard.
    delete process.env.VITEST;

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
});
