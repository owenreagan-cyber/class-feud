import { useCallback, useRef, useState } from 'react';
import { playWrongAnswerSound, unlockAudio } from '../teamButton/audio';

export type WrongAnswerEvent = { id: number; strong: boolean };

/**
 * Cosmetic-only wrong-answer presentation trigger (presenter X overlay + a
 * short tone). Never reads or writes GameState — call it alongside a real
 * game action, not instead of one. Must be called synchronously from a real
 * user-gesture handler (e.g. a teacher button click) so the shared
 * AudioContext singleton stays unlocked on iOS Safari.
 *
 * Wired today from strike and failed-steal handlers; written to be reusable
 * later by an answer-timer expiry without any changes here.
 */
export function useWrongAnswerFeedback() {
  const [wrongAnswerEvent, setWrongAnswerEvent] = useState<WrongAnswerEvent | null>(null);
  const idRef = useRef(0);

  const showWrongAnswerFeedback = useCallback((strong = false) => {
    idRef.current += 1;
    setWrongAnswerEvent({ id: idRef.current, strong });
    try {
      unlockAudio();
      playWrongAnswerSound();
    } catch {
      // Presentation audio is best-effort; never let it interrupt gameplay.
    }
  }, []);

  return { wrongAnswerEvent, showWrongAnswerFeedback };
}
