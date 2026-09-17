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
    const allRounds = toFeudRounds(set.rounds);
    // Default play order (subset) vs. spare boards. Absent = play all rounds.
    const defaultIds = set.defaultRoundIds ?? set.rounds.map((round) => round.id);
    const selected = allRounds.filter((round) => defaultIds.includes(round.id));
    dispatch({
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary: allRounds,
      rounds: selected.length > 0 ? selected : allRounds,
      brainBlitzConfig: set.brainBlitz ?? null,
    });
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
