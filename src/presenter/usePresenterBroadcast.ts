import { useEffect, useRef } from 'react';
import type { GameState } from '../game/gameTypes';
import type { AnswerTimerState } from '../game/useAnswerTimer';
import type { WrongAnswerEvent } from '../game/useWrongAnswerFeedback';
import { PRESENTER_CHANNEL, isBroadcastChannelSupported } from './presenterSync';
import type { PresenterSnapshot } from './presenterSync';

/**
 * Teacher-side broadcast. Posts the full presenter-visible snapshot (game
 * state + transient presentation fields) to any open presenter windows on
 * every change. The teacher remains authoritative; this only mirrors state.
 * Purely additive — it never mutates game state or changes any rule.
 */
export function usePresenterBroadcast(
  state: GameState,
  answerTimer: AnswerTimerState,
  wrongAnswerEvent: WrongAnswerEvent | null,
): void {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!isBroadcastChannelSupported()) return;
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    seqRef.current += 1;
    const snapshot: PresenterSnapshot = {
      seq: seqRef.current,
      state,
      answerTimer,
      wrongAnswer: wrongAnswerEvent,
    };
    channel.postMessage(snapshot);
  }, [state, answerTimer, wrongAnswerEvent]);
}
