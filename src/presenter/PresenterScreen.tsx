import { useCallback, useEffect, useState } from 'react';
import PresenterGameView from '../components/presenter/PresenterGameView';
import { usePresenterState } from './usePresenterState';

function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/**
 * Dedicated, display-only projector surface. Renders only the presenter game
 * view (no teacher controls, no answer entry, no admin) fed by read-only
 * synchronized state. Offers an ENTER FULLSCREEN control (a user gesture is
 * required by the browser for fullscreen).
 */
export default function PresenterScreen() {
  const { state, answerTimer, wrongAnswer } = usePresenterState();
  const [fullscreen, setFullscreen] = useState<boolean>(isFullscreen);

  useEffect(() => {
    const onChange = () => setFullscreen(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen()) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  if (state.phase === 'setup') {
    return (
      <div className="presenter-route">
        <div className="presenter-waiting" role="status">
          <span className="brand">Class Feud</span>
          <p className="control-line">Waiting for the game to start…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="presenter-route">
      <div className="presenter-toolbar">
        <button type="button" className="presenter-fullscreen" onClick={toggleFullscreen}>
          {fullscreen ? 'EXIT FULLSCREEN' : 'ENTER FULLSCREEN'}
        </button>
      </div>
      <PresenterGameView state={state} wrongAnswerEvent={wrongAnswer} answerTimer={answerTimer} />
    </div>
  );
}
