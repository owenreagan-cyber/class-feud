import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { teamButtonWsPlugin } from './server/teamButtonWs.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), teamButtonWsPlugin()],
})
