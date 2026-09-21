// Presenter synchronization. The teacher window is the single source of truth
// for game state; the dedicated presenter route is display-only and receives a
// live snapshot over BroadcastChannel (same-origin, same Mac). localStorage
// (gamePersistence) remains the durable recovery source for presenter refresh
// and late-open.
//
// Audio ownership: the teacher owns ALL presentation audio (reveal ding,
// wrong-answer sound, Team Button sounds). The presenter route is visual-only
// and never plays a sound, so teacher + presenter never double a ding.

import type { GameState } from '../game/gameTypes';
import type { AnswerTimerState } from '../game/useAnswerTimer';
import type { WrongAnswerEvent } from '../game/useWrongAnswerFeedback';

export const PRESENTER_CHANNEL = 'class-feud-presenter';

/**
 * A monotonic sequence so a presenter can drop out-of-order/stale snapshots.
 * BroadcastChannel is ordered per sender, but the counter defends against
 * reconnecting channels or any future multi-writer confusion.
 */
export type PresenterSnapshot = {
  seq: number;
  state: GameState;
  answerTimer: AnswerTimerState | null;
  wrongAnswer: WrongAnswerEvent | null;
};

export function isBroadcastChannelSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}
