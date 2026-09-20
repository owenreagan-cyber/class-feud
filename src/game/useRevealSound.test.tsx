// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevealSound } from './useRevealSound';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../teamButton/audio', () => ({
  unlockAudio: vi.fn(),
  playRevealDing: vi.fn(),
}));

import { playRevealDing } from '../teamButton/audio';

function Harness({ count, onCount }: { count: number; onCount: (n: number) => void }) {
  useRevealSound(count);
  onCount(count);
  return null;
}

function mount(count: number): { root: Root; rerender: (n: number) => void; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (n: number) =>
    act(() => {
      root.render(<Harness count={n} onCount={() => {}} />);
    });
  render(count);
  return {
    root,
    rerender: (n) => render(n),
    unmount: () => act(() => root.unmount()),
  };
}

describe('useRevealSound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not ding on initial mount (no reveal yet)', () => {
    const { unmount } = mount(0);
    expect(playRevealDing).not.toHaveBeenCalled();
    unmount();
  });

  it('does not ding on mount when answers are already revealed', () => {
    const { unmount } = mount(3);
    expect(playRevealDing).not.toHaveBeenCalled();
    unmount();
  });

  it('dings exactly once when the revealed count increases', () => {
    const ctx = mount(0);
    ctx.rerender(1);
    expect(playRevealDing).toHaveBeenCalledTimes(1);
    ctx.unmount();
  });

  it('does not replay the ding when the count stays the same (re-render)', () => {
    const ctx = mount(0);
    ctx.rerender(1);
    ctx.rerender(1);
    ctx.rerender(1);
    expect(playRevealDing).toHaveBeenCalledTimes(1);
    ctx.unmount();
  });

  it('dings once per distinct reveal across multiple reveals', () => {
    const ctx = mount(0);
    ctx.rerender(1);
    ctx.rerender(2);
    ctx.rerender(3);
    expect(playRevealDing).toHaveBeenCalledTimes(3);
    ctx.unmount();
  });
});
