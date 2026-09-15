import type { Dispatch } from 'react';
import PresenterGameView from '../components/presenter/PresenterGameView';
import TeacherGameView from '../components/teacher/TeacherGameView';
import type { GameAction, GameState } from '../game/gameTypes';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
};

export default function GameScreen({ state, dispatch, canUndo }: Props) {
  return (
    <div className="game-screen">
      <PresenterGameView state={state} />
      <TeacherGameView state={state} dispatch={dispatch} canUndo={canUndo} />
    </div>
  );
}
