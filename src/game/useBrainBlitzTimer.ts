import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { GameAction } from './gameTypes';

/**
 * Drives the Brain Blitz countdown. This hook is purely presentational/advisory:
 * it never mutates scoring and only dispatches `BRAIN_BLITZ_TICK` once per
 * second while `running` is true.
 *
 * Guarantees:
 * - exactly one interval at a time (effect keyed on `running`)
 * - interval cleared on pause, on unmount, and on navigation away
 * - never ticks below zero (enforced by the reducer, not here)
 *
 * The reducer owns `remainingSeconds`; this hook only schedules the ticks.
 */
export function useBrainBlitzTimer(running: boolean, dispatch: Dispatch<GameAction>): void {
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      dispatch({ type: 'BRAIN_BLITZ_TICK' });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, dispatch]);
}
