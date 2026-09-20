import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';
import { TEAM_BUTTON_HTTP_PORT } from './teamButtonWs';

// Guard the classroom-port determinism contract: HTTP is pinned (strictPort)
// so Vite fails loudly instead of silently falling back onto another port —
// including the Team Buttons WebSocket port (5174).
describe('vite.config classroom port safety', () => {
  it('pins the dev HTTP port and enables strictPort', () => {
    expect(viteConfig.server?.port).toBe(TEAM_BUTTON_HTTP_PORT);
    expect(viteConfig.server?.strictPort).toBe(true);
  });

  it('pins the preview HTTP port and enables strictPort', () => {
    expect(viteConfig.preview?.port).toBe(TEAM_BUTTON_HTTP_PORT);
    expect(viteConfig.preview?.strictPort).toBe(true);
  });
});
