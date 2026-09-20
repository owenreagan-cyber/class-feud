import { describe, expect, it } from 'vitest';
import { buildJoinUrl, isLoopbackHost } from './joinAddress';

describe('isLoopbackHost', () => {
  it.each(['localhost', 'LOCALHOST', ' localhost ', '127.0.0.1', '::1', '[::1]'])(
    'flags loopback host %j',
    (hostname) => {
      expect(isLoopbackHost(hostname)).toBe(true);
    },
  );

  it.each(['192.168.1.20', '10.0.0.5', '172.16.0.2', 'my-mac.local', 'fe80::1'])(
    'treats LAN host %j as reachable',
    (hostname) => {
      expect(isLoopbackHost(hostname)).toBe(false);
    },
  );
});

describe('buildJoinUrl', () => {
  it('appends the team-button path to the origin', () => {
    expect(buildJoinUrl('http://192.168.1.20:5173')).toBe(
      'http://192.168.1.20:5173/team-button',
    );
  });
});
