import { useEffect, useState } from 'react';

function query(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reactive `prefers-reduced-motion` flag. Returns false when the media query
 * is unsupported (e.g. jsdom without matchMedia), so the default animated
 * behavior remains intact in tests unless explicitly mocked.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(query);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Legacy Safari (< 14) fallback.
    if (typeof (mql as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener === 'function') {
      (mql as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onChange);
      return () =>
        (mql as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(onChange);
    }
    return;
  }, []);

  return reduced;
}
