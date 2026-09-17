import type { FaceOffPublicState } from './protocol';

export type TeamButtonViewKind =
  | 'locked'
  | 'thinking'
  | 'ready'
  | 'first'
  | 'queued'
  | 'ineligible'
  | 'waiting';

export type TeamButtonViewState = {
  kind: TeamButtonViewKind;
  /** True only when a fresh press may be submitted right now. */
  canPress: boolean;
  /** Seconds remaining in the think countdown (null unless `thinking`). */
  countdown: number | null;
  /**
   * Presentation-only flag: true when the live session is a steal, for
   * labeling purposes. Derived independently of `kind`/`canPress` and never
   * consulted by eligibility or press logic.
   */
  isSteal: boolean;
};

type CoreViewState = Omit<TeamButtonViewState, 'isSteal'>;

/**
 * Derive the team device's button state from the server-broadcast session.
 * The server is the authority: a press is only ever legal when this returns
 * `canPress: true`, which requires a live `ready` session with the team
 * eligible and not already pressed.
 *
 * `isSteal` is spliced on afterward from `session.kind` alone, entirely
 * independent of this core derivation, so labeling a session as a steal can
 * never influence eligibility, press-order, or `canPress`.
 */
function deriveCoreViewState(
  session: FaceOffPublicState | null,
  teamId: string,
): CoreViewState {
  if (!session || session.sessionId === null || session.phase === 'idle') {
    return { kind: 'locked', canPress: false, countdown: null };
  }

  if (session.kind === 'steal' && !session.eligibleTeamIds.includes(teamId)) {
    return { kind: 'ineligible', canPress: false, countdown: null };
  }

  const alreadyPressed = session.pressOrder.some((entry) => entry.teamId === teamId);

  switch (session.phase) {
    case 'thinking':
      return { kind: 'thinking', canPress: false, countdown: session.remaining };
    case 'ready':
      if (alreadyPressed) {
        return session.pressOrder[0]?.teamId === teamId
          ? { kind: 'first', canPress: false, countdown: null }
          : { kind: 'queued', canPress: false, countdown: null };
      }
      return { kind: 'ready', canPress: true, countdown: null };
    case 'resolved':
      return { kind: 'waiting', canPress: false, countdown: null };
    default:
      return { kind: 'locked', canPress: false, countdown: null };
  }
}

export function deriveTeamButtonState(
  session: FaceOffPublicState | null,
  teamId: string,
): TeamButtonViewState {
  return {
    ...deriveCoreViewState(session, teamId),
    isSteal: session?.kind === 'steal',
  };
}
