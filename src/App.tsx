import { useState } from 'react';
import { useGame } from './game/useGame';
import GameScreen from './screens/GameScreen';
import SetupScreen from './screens/SetupScreen';
import LibraryScreen from './screens/LibraryScreen';
import AuthoringScreen from './screens/AuthoringScreen';
import { toFeudRounds } from './content/gameSet';
import type { SavedGameSet } from './content/gameSet';
import { scopeTrackOutRoundLibrary } from './content/trackOutEdition';
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
    // Order follows defaultIds itself (the authored play order), not each
    // round's incidental position in the full board array.
    const defaultIds = set.defaultRoundIds ?? set.rounds.map((round) => round.id);
    const roundsById = new Map(allRounds.map((round) => [round.id, round]));
    const selected = defaultIds
      .map((id) => roundsById.get(id))
      .filter((round): round is (typeof allRounds)[number] => round !== undefined);

    // Track Out's four class rotations share one 18-board pool (no content
    // duplication), but each rotation's + EXTRA BOARD spares must stay scoped
    // to the shared 6-board pool, not the other rotations' regular boards.
    // Every other game set is unaffected (roundLibrary = all of its rounds,
    // same as before).
    const roundLibrary = scopeTrackOutRoundLibrary(set.id, defaultIds, allRounds);

    dispatch({
      type: 'LOAD_GAME_ROUNDS',
      roundLibrary,
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
