import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TeamButtonClientView from './teamButton/TeamButtonClientView'

const isTeamButtonRoute = window.location.pathname.replace(/\/+$/, '') === '/team-button'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTeamButtonRoute ? <TeamButtonClientView /> : <App />}
  </StrictMode>,
)
