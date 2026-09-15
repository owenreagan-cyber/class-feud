import type { Dispatch } from 'react';
import GameBoard from '../components/board/GameBoard';
import TeacherConsole from '../components/teacher/TeacherConsole';
import type { GameAction, GameState } from '../game/gameTypes';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
};

export default function GameScreen({ state, dispatch, canUndo }: Props) {
  return (
    <div className="game-screen">
      <GameBoard state={state} />
      <TeacherConsole state={state} dispatch={dispatch} canUndo={canUndo} />
    </div>
  );
}
