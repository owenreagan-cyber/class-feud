import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { createHistory, createInitialState, historyReducer } from './gameReducer';
import type { HistoryState } from './gameReducer';
import { loadPersistedState, savePersistedState } from './gamePersistence';
import type { GameAction, GameState } from './gameTypes';

export type UseGameResult = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
};

function createInitialHistory(): HistoryState {
  const persisted = loadPersistedState();
  return createHistory(persisted ?? createInitialState());
}

export function useGame(): UseGameResult {
  const [history, dispatch] = useReducer(historyReducer, undefined, createInitialHistory);
  const state = history.present;

  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  return { state, dispatch, canUndo: history.past.length > 0 };
}
