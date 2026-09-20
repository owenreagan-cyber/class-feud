import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { teamButtonWsPlugin, TEAM_BUTTON_HTTP_PORT } from './server/teamButtonWs.ts'

// https://vite.dev/config/
//
// Classroom networking is intentionally deterministic: HTTP is pinned to
// `TEAM_BUTTON_HTTP_PORT` with `strictPort` (so Vite fails loudly instead of
// silently falling back onto another port — including the Team Buttons
// WebSocket port), and the Team Buttons WebSocket server (server/teamButtonWs.ts)
// binds its own fixed port explicitly. Run `npm run dev -- --host` so the app
// is reachable from team iPads on the LAN.
export default defineConfig({
  server: {
    port: TEAM_BUTTON_HTTP_PORT,
    strictPort: true,
  },
  preview: {
    port: TEAM_BUTTON_HTTP_PORT,
    strictPort: true,
  },
  plugins: [react(), teamButtonWsPlugin()],
})
