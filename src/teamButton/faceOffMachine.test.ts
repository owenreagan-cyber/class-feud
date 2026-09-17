import { describe, expect, it } from 'vitest';
import {
  createIdleFaceOff,
  firstPressTeamId,
  hasPressed,
  reduceFaceOff,
} from './faceOffMachine';
import type { FaceOffState } from './faceOffMachine';

function startFaceoff(eligible: string[] = ['red', 'blue', 'green', 'gold']): FaceOffState {
  return reduceFaceOff(createIdleFaceOff(), {
    type: 'start',
    kind: 'faceoff',
    thinkSeconds: 3,
    eligibleTeamIds: eligible,
  });
}

function ready(state: FaceOffState): FaceOffState {
  let next = state;
  // Tick until the think countdown reaches READY.
  while (next.phase === 'thinking') {
    next = reduceFaceOff(next, { type: 'tick' });
  }
  return next;
}

describe('face-off machine', () => {
  it('each face-off session has a unique id', () => {
    const a = startFaceoff();
    const b = startFaceoff();
    expect(a.sessionId).not.toBeNull();
    expect(b.sessionId).not.toBeNull();
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('rejects a press while locked (idle)', () => {
    const idle = createIdleFaceOff();
    const next = reduceFaceOff(idle, {
      type: 'press',
      teamId: 'red',
      sessionId: 'whatever',
      at: 1,
    });
    expect(next).toBe(idle);
    expect(next.pressOrder).toHaveLength(0);
  });

  it('rejects a press during thinking (before ready)', () => {
    const thinking = startFaceoff();
    const next = reduceFaceOff(thinking, {
      type: 'press',
      teamId: 'red',
      sessionId: thinking.sessionId!,
      at: 1,
    });
    expect(next).toBe(thinking);
    expect(next.pressOrder).toHaveLength(0);
  });

  it('accepts a press once ready', () => {
    const live = ready(startFaceoff());
    expect(live.phase).toBe('ready');
    const next = reduceFaceOff(live, {
      type: 'press',
      teamId: 'red',
      sessionId: live.sessionId!,
      at: 100,
    });
    expect(next.pressOrder).toHaveLength(1);
    expect(next.pressOrder[0].teamId).toBe('red');
  });

  it('ranks presses in server arrival order', () => {
    const live = ready(startFaceoff());
    let next = live;
    for (const [teamId, at] of [
      ['green', 10],
      ['red', 20],
      ['gold', 30],
      ['blue', 40],
    ] as const) {
      next = reduceFaceOff(next, {
        type: 'press',
        teamId,
        sessionId: live.sessionId!,
        at,
      });
    }
    expect(next.pressOrder.map((entry) => entry.teamId)).toEqual([
      'green',
      'red',
      'gold',
      'blue',
    ]);
    expect(firstPressTeamId(next)).toBe('green');
  });

  it('ignores a duplicate press from the same team', () => {
    const live = ready(startFaceoff());
    const first = reduceFaceOff(live, {
      type: 'press',
      teamId: 'red',
      sessionId: live.sessionId!,
      at: 10,
    });
    const dup = reduceFaceOff(first, {
      type: 'press',
      teamId: 'red',
      sessionId: live.sessionId!,
      at: 20,
    });
    expect(dup).toBe(first);
    expect(dup.pressOrder).toHaveLength(1);
  });

  it('ignores a press with a stale session id', () => {
    const live = ready(startFaceoff());
    const next = reduceFaceOff(live, {
      type: 'press',
      teamId: 'red',
      sessionId: 'stale-session',
      at: 10,
    });
    expect(next).toBe(live);
  });

  it('ignores presses after the session is resolved', () => {
    const live = ready(startFaceoff());
    const resolved = reduceFaceOff(live, { type: 'resolve' });
    expect(resolved.phase).toBe('resolved');
    const next = reduceFaceOff(resolved, {
      type: 'press',
      teamId: 'red',
      sessionId: live.sessionId!,
      at: 10,
    });
    expect(next).toBe(resolved);
    expect(next.pressOrder).toHaveLength(0);
  });

  it('reset clears press order and returns to idle', () => {
    const live = ready(startFaceoff());
    const pressed = reduceFaceOff(live, {
      type: 'press',
      teamId: 'red',
      sessionId: live.sessionId!,
      at: 10,
    });
    const reset = reduceFaceOff(pressed, { type: 'reset' });
    expect(reset.phase).toBe('idle');
    expect(reset.sessionId).toBeNull();
    expect(reset.pressOrder).toHaveLength(0);
    expect(hasPressed(reset, 'red')).toBe(false);
  });

  it('rejects a press from an ineligible team (steal eligibility)', () => {
    const live = ready(startFaceoff(['blue', 'green']));
    const next = reduceFaceOff(live, {
      type: 'press',
      teamId: 'red', // not eligible
      sessionId: live.sessionId!,
      at: 10,
    });
    expect(next).toBe(live);
  });

  it('tracks which teams have pressed', () => {
    const live = ready(startFaceoff());
    const pressed = reduceFaceOff(live, {
      type: 'press',
      teamId: 'gold',
      sessionId: live.sessionId!,
      at: 10,
    });
    expect(hasPressed(pressed, 'gold')).toBe(true);
    expect(hasPressed(pressed, 'red')).toBe(false);
  });
});
