// iPad join-address helpers. Pure and host-independent so the QR guard can be
// unit-tested without a browser. The teacher's page origin determines the QR
// value; we only guard against loopback origins that iPads cannot reach.

/**
 * Loopback hostnames cannot be used as an iPad join address: an iPad resolving
 * `localhost`/`127.0.0.1`/`::1` reaches itself, not the teacher's Mac.
 */
export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
}

/** Build the iPad join URL from the teacher page's origin. */
export function buildJoinUrl(origin: string): string {
  return `${origin}/team-button`;
}
