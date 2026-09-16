// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrainBlitzTimer } from './useBrainBlitzTimer';
import type { GameAction } from './gameTypes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function TimerHarness({ running, onTick }: { running: boolean; onTick: () => void }) {
  useBrainBlitzTimer(running, onTick as unknown as (action: GameAction) => void);
  return null;
}

function render(element: ReactElement): { root: Root; rerender: (el: ReactElement) => void; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    root,
    rerender: (el) => {
      act(() => {
        root.render(el);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useBrainBlitzTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('sets up a single interval and ticks once per second', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const onTick = vi.fn();
    const view = render(<TimerHarness running onTick={onTick} />);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onTick).toHaveBeenCalledTimes(3);
    view.unmount();
  });

  it('cleans up the interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const onTick = vi.fn();
    const view = render(<TimerHarness running onTick={onTick} />);
    view.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the interval when paused', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const onTick = vi.fn();
    const view = render(<TimerHarness running onTick={onTick} />);
    view.rerender(<TimerHarness running={false} onTick={onTick} />);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('does not create duplicate intervals across pause/resume', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const onTick = vi.fn();
    const view = render(<TimerHarness running onTick={onTick} />);
    view.rerender(<TimerHarness running={false} onTick={onTick} />);
    view.rerender(<TimerHarness running onTick={onTick} />);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    // After resume, exactly one interval is active: one tick per second.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
