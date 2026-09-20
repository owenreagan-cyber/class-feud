import { useEffect } from 'react';
import type { Dispatch } from 'react';
import PresenterGameView from '../components/presenter/PresenterGameView';
import TeacherGameView from '../components/teacher/TeacherGameView';
import type { GameAction, GameState } from '../game/gameTypes';
import { getRevealedCount } from '../game/gameSelectors';
import { useAnswerTimer } from '../game/useAnswerTimer';
import { useBrainBlitzTimer } from '../game/useBrainBlitzTimer';
import { useRevealSound } from '../game/useRevealSound';
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
  const answerTimer = useAnswerTimer(() => showWrongAnswerFeedback(false));

  // Presentation-only reveal chime: once per newly revealed answer.
  useRevealSound(getRevealedCount(state));

  // The answer timer only ever makes sense while a face-off or steal session
  // could be establishing who's answering. Any other phase (playing,
  // roundOver, gameOver, brainBlitz, setup) force-clears it as a backstop —
  // covers round end, new board, game end, and Brain Blitz start without
  // needing an explicit clear() call at every one of those dispatch sites.
  const clearAnswerTimer = answerTimer.clear;
  useEffect(() => {
    if (state.phase !== 'tossup' && state.phase !== 'steal') {
      clearAnswerTimer();
    }
  }, [state.phase, clearAnswerTimer]);

  return (
    <div className="game-screen">
      {onExitToLibrary ? (
        <button type="button" className="game-exit" onClick={onExitToLibrary}>
          ← Library
        </button>
      ) : null}
      <PresenterGameView state={state} wrongAnswerEvent={wrongAnswerEvent} answerTimer={answerTimer.answerTimer} />
      <TeacherGameView
        state={state}
        dispatch={dispatch}
        canUndo={canUndo}
        onWrongAnswer={showWrongAnswerFeedback}
        answerTimer={answerTimer}
      />
    </div>
  );
}
