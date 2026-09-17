import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol';

describe('parseClientMessage: start.thinkSeconds', () => {
  it('accepts a normal finite thinkSeconds', () => {
    const message = parseClientMessage({
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 3,
      eligibleTeamIds: ['red'],
    });
    expect(message).toEqual({
      type: 'start',
      kind: 'faceoff',
      thinkSeconds: 3,
      eligibleTeamIds: ['red'],
    });
  });

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite thinkSeconds (%s)', (thinkSeconds) => {
    const message = parseClientMessage({
      type: 'start',
      kind: 'faceoff',
      thinkSeconds,
      eligibleTeamIds: ['red'],
    });
    expect(message).toBeNull();
  });
});
