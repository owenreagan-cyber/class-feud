// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANSWER_DURATION_SECONDS, useAnswerTimer } from './useAnswerTimer';
import type { AnswerTimerApi } from './useAnswerTimer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onExpire, onApi }: { onExpire?: () => void; onApi: (api: AnswerTimerApi) => void }) {
  const api = useAnswerTimer(onExpire);
  useEffect(() => {
    onApi(api);
  });
  return null;
}

function render(element: ReactElement): { root: Root; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    root,
    unmount: () => act(() => root.unmount()),
  };
}

type Ctx = { view: { unmount: () => void }; api: AnswerTimerApi };

function mount(onExpire?: () => void, strict = false): Ctx {
  const ctx = {} as Ctx;
  const onApi = (a: AnswerTimerApi) => {
    ctx.api = a;
  };
  const tree = <Harness onExpire={onExpire} onApi={onApi} />;
  ctx.view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return ctx;
}

describe('useAnswerTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('1. defaults to a 5-second answer duration', () => {
    const ctx = mount();
    expect(DEFAULT_ANSWER_DURATION_SECONDS).toBe(5);
    expect(ctx.api.answerTimer.durationSeconds).toBe(5);
    expect(ctx.api.answerTimer.remainingSeconds).toBe(5);
    ctx.view.unmount();
  });

  it('2. supports a 3-second duration', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 3));
    expect(ctx.api.answerTimer.durationSeconds).toBe(3);
    expect(ctx.api.answerTimer.remainingSeconds).toBe(3);
    ctx.view.unmount();
  });

  it('3. supports a 5-second duration', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    expect(ctx.api.answerTimer.durationSeconds).toBe(5);
    expect(ctx.api.answerTimer.remainingSeconds).toBe(5);
    ctx.view.unmount();
  });

  it('4/5. start() begins running and associates the timer with the given team', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-blue'));
    expect(ctx.api.answerTimer.status).toBe('running');
    expect(ctx.api.answerTimer.teamId).toBe('team-blue');
    ctx.view.unmount();
  });

  it('6. counts down over time', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(2000));
    expect(ctx.api.answerTimer.remainingSeconds).toBe(3);
    ctx.view.unmount();
  });

  it('7. never goes below zero', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 3));
    act(() => vi.advanceTimersByTime(10_000));
    expect(ctx.api.answerTimer.remainingSeconds).toBe(0);
    expect(ctx.api.answerTimer.status).toBe('expired');
    ctx.view.unmount();
  });

  it('8/10. expiry fires the onExpire callback exactly once', () => {
    const onExpire = vi.fn();
    const ctx = mount(onExpire);
    act(() => ctx.api.start('team-red', 3));
    act(() => vi.advanceTimersByTime(3000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    ctx.view.unmount();
  });

  it('18. pause freezes the remaining time', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(2000));
    act(() => ctx.api.pause());
    expect(ctx.api.answerTimer.status).toBe('paused');
    const frozen = ctx.api.answerTimer.remainingSeconds;
    act(() => vi.advanceTimersByTime(5000));
    expect(ctx.api.answerTimer.remainingSeconds).toBe(frozen);
    expect(ctx.api.answerTimer.status).toBe('paused');
    ctx.view.unmount();
  });

  it('19. resume continues counting down from the paused remaining time', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(2000));
    act(() => ctx.api.pause());
    const frozen = ctx.api.answerTimer.remainingSeconds;
    act(() => ctx.api.resume());
    expect(ctx.api.answerTimer.status).toBe('running');
    act(() => vi.advanceTimersByTime(1000));
    expect(ctx.api.answerTimer.remainingSeconds).toBe(frozen - 1);
    ctx.view.unmount();
  });

  it('20. reset restores the full selected duration for the same team', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(4000));
    act(() => ctx.api.reset());
    expect(ctx.api.answerTimer.status).toBe('running');
    expect(ctx.api.answerTimer.teamId).toBe('team-red');
    expect(ctx.api.answerTimer.remainingSeconds).toBe(5);
    ctx.view.unmount();
  });

  it('21. switching duration 5→3 while running restarts deterministically at 3', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(2000));
    act(() => ctx.api.setDuration(3));
    expect(ctx.api.answerTimer.status).toBe('running');
    expect(ctx.api.answerTimer.durationSeconds).toBe(3);
    expect(ctx.api.answerTimer.remainingSeconds).toBe(3);
    ctx.view.unmount();
  });

  it('setDuration while idle only changes the next timer’s duration (no team, does not start)', () => {
    const ctx = mount();
    act(() => ctx.api.setDuration(3));
    expect(ctx.api.answerTimer.status).toBe('idle');
    expect(ctx.api.answerTimer.teamId).toBeNull();
    expect(ctx.api.answerTimer.durationSeconds).toBe(3);
    act(() => ctx.api.start('team-red'));
    expect(ctx.api.answerTimer.durationSeconds).toBe(3);
    ctx.view.unmount();
  });

  it('clear() returns to idle with no team, regardless of prior status', () => {
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    act(() => vi.advanceTimersByTime(5000));
    expect(ctx.api.answerTimer.status).toBe('expired');
    act(() => ctx.api.clear());
    expect(ctx.api.answerTimer.status).toBe('idle');
    expect(ctx.api.answerTimer.teamId).toBeNull();
    ctx.view.unmount();
  });

  it('a fresh start() after expiry can expire again (not a one-shot lock)', () => {
    const onExpire = vi.fn();
    const ctx = mount(onExpire);
    act(() => ctx.api.start('team-red', 3));
    act(() => vi.advanceTimersByTime(3000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => ctx.api.start('team-blue', 3));
    act(() => vi.advanceTimersByTime(3000));
    expect(onExpire).toHaveBeenCalledTimes(2);
    ctx.view.unmount();
  });

  it('unmount cleans up the interval — no orphan timers', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const ctx = mount();
    act(() => ctx.api.start('team-red', 5));
    ctx.view.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('33/34. React Strict Mode does not double-start the timer or duplicate expiry', () => {
    const onExpire = vi.fn();
    const ctx = mount(onExpire, true);
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    act(() => ctx.api.start('team-red', 3));
    // Exactly one interval created for this run, even under Strict Mode.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    ctx.view.unmount();
  });
});
