import type { Dispatch } from 'react';
import PresenterGameView from '../components/presenter/PresenterGameView';
import TeacherGameView from '../components/teacher/TeacherGameView';
import type { GameAction, GameState } from '../game/gameTypes';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
  onExitToLibrary?: () => void;
};

export default function GameScreen({ state, dispatch, canUndo, onExitToLibrary }: Props) {
  return (
    <div className="game-screen">
      {onExitToLibrary ? (
        <button type="button" className="game-exit" onClick={onExitToLibrary}>
          ← Library
        </button>
      ) : null}
      <PresenterGameView state={state} />
      <TeacherGameView state={state} dispatch={dispatch} canUndo={canUndo} />
    </div>
  );
}
