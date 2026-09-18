import type { Dispatch } from 'react';
import PresenterGameView from '../components/presenter/PresenterGameView';
import TeacherGameView from '../components/teacher/TeacherGameView';
import type { GameAction, GameState } from '../game/gameTypes';
import { useBrainBlitzTimer } from '../game/useBrainBlitzTimer';
import { useWrongAnswerFeedback } from '../game/useWrongAnswerFeedback';

type Props = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canUndo: boolean;
  onExitToLibrary?: () => void;
};

export default function GameScreen({ state, dispatch, canUndo, onExitToLibrary }: Props) {
  useBrainBlitzTimer(state.brainBlitz?.timerRunning ?? false, dispatch);
  const { wrongAnswerEvent, showWrongAnswerFeedback } = useWrongAnswerFeedback();

  return (
    <div className="game-screen">
      {onExitToLibrary ? (
        <button type="button" className="game-exit" onClick={onExitToLibrary}>
          ← Library
        </button>
      ) : null}
      <PresenterGameView state={state} wrongAnswerEvent={wrongAnswerEvent} />
      <TeacherGameView
        state={state}
        dispatch={dispatch}
        canUndo={canUndo}
        onWrongAnswer={showWrongAnswerFeedback}
      />
    </div>
  );
}
