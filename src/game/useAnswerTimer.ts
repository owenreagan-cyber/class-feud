import { useCallback, useEffect, useRef, useState } from 'react';

export type AnswerTimerStatus = 'idle' | 'running' | 'paused' | 'expired';
export type AnswerDurationSeconds = 3 | 5;

export type AnswerTimerState = {
  status: AnswerTimerStatus;
  teamId: string | null;
  durationSeconds: AnswerDurationSeconds;
  remainingSeconds: number;
};

export const DEFAULT_ANSWER_DURATION_SECONDS: AnswerDurationSeconds = 5;
const TICK_MS = 200;

function idleState(durationSeconds: AnswerDurationSeconds): AnswerTimerState {
  return { status: 'idle', teamId: null, durationSeconds, remainingSeconds: durationSeconds };
}

/**
 * Independent post-press "answer" pacing timer — separate from the pre-press
 * THINK countdown (faceOffMachine's `thinkSeconds`) and from Brain Blitz's
 * timer. Pure UI/session state: never touches GameState, never dispatches,
 * so ticks cannot pollute undo history and a page/host refresh simply resets
 * it (acceptable for a cosmetic pacing aid — see docs/followup note).
 *
 * Deadline-based: remaining time is derived from an absolute deadline
 * timestamp rather than decremented per tick, so it can't drift and a paused
 * timer's remaining time survives exactly.
 */
export function useAnswerTimer(onExpire?: () => void) {
  const [state, setState] = useState<AnswerTimerState>(() => idleState(DEFAULT_ANSWER_DURATION_SECONDS));

  const deadlineRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Bumped on every start()/reset()/duration-restart so the expiry-effect
  // below can tell a genuinely new run from a Strict-Mode double-invoke of
  // the same transition.
  const runIdRef = useRef(0);
  const firedForRunIdRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'running' || deadlineRef.current === null) return prev;
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      if (remaining <= 0) {
        return { ...prev, status: 'expired', remainingSeconds: 0 };
      }
      if (remaining === prev.remainingSeconds) return prev;
      return { ...prev, remainingSeconds: remaining };
    });
  }, []);

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [state.status, tick]);

  // Fire onExpire exactly once per run, even under React Strict Mode's
  // double-invoked effects.
  useEffect(() => {
    if (state.status !== 'expired') return;
    if (firedForRunIdRef.current === runIdRef.current) return;
    firedForRunIdRef.current = runIdRef.current;
    onExpireRef.current?.();
  }, [state.status]);

  const start = useCallback((teamId: string, durationSeconds?: AnswerDurationSeconds) => {
    setState((prev) => {
      const duration = durationSeconds ?? prev.durationSeconds;
      runIdRef.current += 1;
      deadlineRef.current = Date.now() + duration * 1000;
      return { status: 'running', teamId, durationSeconds: duration, remainingSeconds: duration };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'running' || deadlineRef.current === null) return prev;
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      deadlineRef.current = null;
      return { ...prev, status: 'paused', remainingSeconds: remaining };
    });
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'paused') return prev;
      deadlineRef.current = Date.now() + prev.remainingSeconds * 1000;
      return { ...prev, status: 'running' };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => {
      if (prev.teamId === null) return prev;
      runIdRef.current += 1;
      deadlineRef.current = Date.now() + prev.durationSeconds * 1000;
      return { ...prev, status: 'running', remainingSeconds: prev.durationSeconds };
    });
  }, []);

  const setDuration = useCallback((durationSeconds: AnswerDurationSeconds) => {
    setState((prev) => {
      if (prev.teamId === null) {
        return { ...prev, durationSeconds, remainingSeconds: durationSeconds };
      }
      // A duration change while a team is established restarts that team's
      // timer at the new duration rather than rescaling remaining time.
      runIdRef.current += 1;
      deadlineRef.current = Date.now() + durationSeconds * 1000;
      return { status: 'running', teamId: prev.teamId, durationSeconds, remainingSeconds: durationSeconds };
    });
  }, []);

  const clear = useCallback(() => {
    deadlineRef.current = null;
    setState((prev) => (prev.status === 'idle' && prev.teamId === null ? prev : idleState(prev.durationSeconds)));
  }, []);

  return { answerTimer: state, start, pause, resume, reset, setDuration, clear };
}

export type AnswerTimerApi = ReturnType<typeof useAnswerTimer>;
