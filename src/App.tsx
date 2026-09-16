import { useState } from 'react';
import { useGame } from './game/useGame';
import GameScreen from './screens/GameScreen';
import SetupScreen from './screens/SetupScreen';
import LibraryScreen from './screens/LibraryScreen';
import AuthoringScreen from './screens/AuthoringScreen';
import { toFeudRounds } from './content/gameSet';
import type { SavedGameSet } from './content/gameSet';
import './App.css';

type Screen = 'library' | 'authoring' | 'play';

export default function App() {
  const { state, dispatch, canUndo } = useGame();
  const [screen, setScreen] = useState<Screen>(() =>
    state.phase !== 'setup' ? 'play' : 'library',
  );
  const [authoringSetId, setAuthoringSetId] = useState<string | null>(null);

  function startGameSet(set: SavedGameSet) {
    const rounds = toFeudRounds(set.rounds);
    dispatch({ type: 'LOAD_GAME_ROUNDS', roundLibrary: rounds, rounds });
    setScreen('play');
  }

  function openAuthoring(setId: string | null) {
    setAuthoringSetId(setId);
    setScreen('authoring');
  }

  if (screen === 'library') {
    return (
      <LibraryScreen
        onCreateNew={() => openAuthoring(null)}
        onEdit={(id) => openAuthoring(id)}
        onStart={startGameSet}
      />
    );
  }

  if (screen === 'authoring') {
    return <AuthoringScreen setId={authoringSetId} onReturn={() => setScreen('library')} />;
  }

  // screen === 'play'
  if (state.phase === 'setup') {
    return <SetupScreen state={state} dispatch={dispatch} onBack={() => setScreen('library')} />;
  }

  return (
    <GameScreen
      state={state}
      dispatch={dispatch}
      canUndo={canUndo}
      onExitToLibrary={() => setScreen('library')}
    />
  );
}
