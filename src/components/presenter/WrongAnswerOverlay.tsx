import { useEffect, useState } from 'react';
import type { WrongAnswerEvent } from '../../game/useWrongAnswerFeedback';

const DISPLAY_MS = 900;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Transient full-board "X" flash for a strike or failed steal. Purely
 * presentational: reads only the event id/strong flag passed in, never
 * GameState, and clears itself on a timer without dispatching anything.
 */
export default function WrongAnswerOverlay({ event }: { event: WrongAnswerEvent | null }) {
  const [visible, setVisible] = useState(false);
  const [lastEventId, setLastEventId] = useState<number | null>(null);

  // Derive "just triggered" from a prop change during render (not inside an
  // effect) so a brand-new event always (re)opens the overlay, even if it's
  // already showing from a strike moments earlier.
  if (event && event.id !== lastEventId) {
    setLastEventId(event.id);
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, lastEventId]);

  if (!visible || !event) return null;

  const className = [
    'wrong-answer-overlay',
    event.strong ? 'wrong-answer-overlay--strong' : '',
    prefersReducedMotion() ? 'wrong-answer-overlay--static' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="status" aria-live="assertive" aria-label="Incorrect answer">
      {event.strong ? (
        <div className="wrong-answer-glyphs wrong-answer-glyphs--triple">
          <span>✕</span>
          <span>✕</span>
          <span>✕</span>
        </div>
      ) : (
        <div className="wrong-answer-glyphs">✕</div>
      )}
    </div>
  );
}
