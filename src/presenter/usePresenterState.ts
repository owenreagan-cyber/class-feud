import { useEffect, useRef, useState } from 'react';
import { createInitialState } from '../game/gameReducer';
import { loadPersistedState } from '../game/gamePersistence';
import type { GameState } from '../game/gameTypes';
import type { AnswerTimerState } from '../game/useAnswerTimer';
import type { WrongAnswerEvent } from '../game/useWrongAnswerFeedback';
import { PRESENTER_CHANNEL, isBroadcastChannelSupported } from './presenterSync';
import type { PresenterSnapshot } from './presenterSync';

export type PresenterState = {
  state: GameState;
  answerTimer: AnswerTimerState | null;
  wrongAnswer: WrongAnswerEvent | null;
};

/**
 * Presenter-side, read-only state. Initializes from the teacher's persisted
 * localStorage snapshot (so a refresh or late-open restores a safe current
 * state), then follows live BroadcastChannel snapshots. It exposes NO dispatch
 * and never writes localStorage, so the presenter can never mutate the game or
 * compete with the teacher as an authority.
 */
export function usePresenterState(): PresenterState {
  const [snapshot, setSnapshot] = useState<PresenterState>(() => {
    const persisted = loadPersistedState();
    return {
      state: persisted ?? createInitialState(),
      answerTimer: null,
      wrongAnswer: null,
    };
  });
  const seqRef = useRef(0);

  useEffect(() => {
    if (!isBroadcastChannelSupported()) return;
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channel.onmessage = (event) => {
      const data = event.data as PresenterSnapshot | undefined;
      if (
        data &&
        typeof data.seq === 'number' &&
        data.seq > seqRef.current &&
        data.state
      ) {
        seqRef.current = data.seq;
        setSnapshot({
          state: data.state,
          answerTimer: data.answerTimer ?? null,
          wrongAnswer: data.wrongAnswer ?? null,
        });
      }
    };
    return () => channel.close();
  }, []);

  return snapshot;
}
