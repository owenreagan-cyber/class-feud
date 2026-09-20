// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let value: boolean | null = null;

function Harness({ onValue }: { onValue: (v: boolean) => void }) {
  onValue(usePrefersReducedMotion());
  return null;
}

function mount(): Root {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness onValue={(v) => { value = v; }} />));
  return root;
}

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return mql;
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('returns false when the media query is unsupported', () => {
    // jsdom without a stubbed matchMedia: window.matchMedia may be undefined.
    const root = mount();
    expect(value).toBe(false);
    root.unmount();
  });

  it('returns true when the user prefers reduced motion', () => {
    mockMatchMedia(true);
    const root = mount();
    expect(value).toBe(true);
    root.unmount();
  });

  it('returns false when the user does not prefer reduced motion', () => {
    mockMatchMedia(false);
    const root = mount();
    expect(value).toBe(false);
    root.unmount();
  });
});
