import { useEffect, useRef } from 'react';
import { playRevealDing, unlockAudio } from '../teamButton/audio';

/**
 * Presentation-only reveal chime. Plays exactly once for each newly revealed
 * answer, never for already-revealed answers, and never on re-render or React
 * Strict Mode's double-invoked effects. Reads no GameState directly — the
 * caller passes the current revealed count (derived from a selector).
 *
 * Mirrors `useWrongAnswerFeedback`'s best-effort contract: audio is cosmetic
 * and can never affect score/state logic; `unlockAudio`/`playRevealDing` are
 * wrapped so a missed unlock or audio failure degrades to silence, not an error.
 */
export function useRevealSound(revealedCount: number): void {
  const lastCountRef = useRef(revealedCount);

  useEffect(() => {
    if (revealedCount > lastCountRef.current) {
      try {
        unlockAudio();
        playRevealDing();
      } catch {
        // Presentation audio is best-effort; never let it interrupt gameplay.
      }
    }
    lastCountRef.current = revealedCount;
  }, [revealedCount]);
}
