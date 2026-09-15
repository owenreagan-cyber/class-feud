import { useGame } from './game/useGame';
import GameScreen from './screens/GameScreen';
import SetupScreen from './screens/SetupScreen';
import './App.css';

export default function App() {
  const { state, dispatch, canUndo } = useGame();

  if (state.phase === 'setup') {
    return <SetupScreen state={state} dispatch={dispatch} />;
  }

  return <GameScreen state={state} dispatch={dispatch} canUndo={canUndo} />;
}
