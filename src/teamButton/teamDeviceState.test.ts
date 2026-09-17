import { describe, expect, it } from 'vitest';
import { deriveTeamButtonState } from './teamDeviceState';
import type { FaceOffPublicState } from './protocol';

function session(overrides: Partial<FaceOffPublicState>): FaceOffPublicState {
  return {
    sessionId: 'fo-1',
    kind: 'faceoff',
    phase: 'ready',
    remaining: 0,
    eligibleTeamIds: ['red', 'blue'],
    pressOrder: [],
    ...overrides,
  };
}

describe('deriveTeamButtonState: isSteal is presentation-only', () => {
  it('isSteal is false for a face-off session', () => {
    const state = deriveTeamButtonState(session({ kind: 'faceoff' }), 'red');
    expect(state.isSteal).toBe(false);
  });

  it('isSteal is true for a steal session', () => {
    const state = deriveTeamButtonState(session({ kind: 'steal' }), 'red');
    expect(state.isSteal).toBe(true);
  });

  it('isSteal is false when there is no live session', () => {
    expect(deriveTeamButtonState(null, 'red').isSteal).toBe(false);
    expect(deriveTeamButtonState(session({ sessionId: null }), 'red').isSteal).toBe(false);
  });

  it.each([
    ['thinking', { phase: 'thinking' as const, remaining: 3 }],
    ['ready (unpressed)', { phase: 'ready' as const }],
    [
      'ready (first)',
      { phase: 'ready' as const, pressOrder: [{ teamId: 'red', at: 1 }] },
    ],
    [
      'ready (queued)',
      {
        phase: 'ready' as const,
        pressOrder: [
          { teamId: 'blue', at: 1 },
          { teamId: 'red', at: 2 },
        ],
      },
    ],
    ['resolved', { phase: 'resolved' as const }],
  ])(
    'changing kind alone (faceoff vs steal) does not change kind/canPress/countdown: %s',
    (_label, overrides) => {
      const faceoff = deriveTeamButtonState(session({ ...overrides, kind: 'faceoff' }), 'red');
      const steal = deriveTeamButtonState(session({ ...overrides, kind: 'steal' }), 'red');

      expect(steal.kind).toBe(faceoff.kind);
      expect(steal.canPress).toBe(faceoff.canPress);
      expect(steal.countdown).toBe(faceoff.countdown);
      // The only field that may legitimately differ is the presentation flag.
      expect(faceoff.isSteal).toBe(false);
      expect(steal.isSteal).toBe(true);
    },
  );

  it('ineligible-for-steal is unaffected by isSteal (still driven by eligibleTeamIds)', () => {
    const state = deriveTeamButtonState(
      session({ kind: 'steal', eligibleTeamIds: ['blue'] }),
      'red',
    );
    expect(state.kind).toBe('ineligible');
    expect(state.canPress).toBe(false);
    expect(state.isSteal).toBe(true);
  });
});
