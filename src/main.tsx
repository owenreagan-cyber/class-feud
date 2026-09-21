import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TeamButtonClientView from './teamButton/TeamButtonClientView'
import PresenterScreen from './presenter/PresenterScreen'

const path = window.location.pathname.replace(/\/+$/, '')
const isTeamButtonRoute = path === '/team-button'
const isPresenterRoute = path === '/presenter'

let view: React.ReactNode = <App />
if (isTeamButtonRoute) {
  view = <TeamButtonClientView />
} else if (isPresenterRoute) {
  view = <PresenterScreen />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {view}
  </StrictMode>,
)
