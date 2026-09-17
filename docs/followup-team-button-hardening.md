# Team Button Hardening — Follow-up Notes

> **Intentionally deferred.** This file records hardening work that was NOT
> implemented. Do not start these items without a fresh design/review pass.

## Deferred items

1. **Full host-role transition matrix.** The room currently handles the happy
   paths (valid takeover, rejected takeover, old-host demotion) but there is no
   exhaustive table of every `(old role, new hello role, key match)` pair and
   the resulting authority/team/session state. Formalize this matrix and turn
   each cell into a test.

2. **Formal room lifecycle invariant.** Write down the invariants the room must
   hold across connect/join/steal/host-replace/disconnect (e.g. "at most one
   authoritative host", "a team id is held by at most one connected client",
   "team registry and team-client associations are independent of transient
   session state"). Fuzz or property-test these invariants.

3. **Real sleeping-device heartbeat E2E.** The heartbeat sweep is unit-tested
   with fake sockets only. A real end-to-end test that puts a real socket to
   sleep (no pong) and asserts it is terminated, versus a healthy socket that
   keeps ponging and survives, is still needed. Keep it out of the fast suite.

4. **Host-reconnect-preserves-joins E2E.** The room-level test proves team joins
   survive a host replacement, but there is no end-to-end test through the Vite
   WebSocket server and the client hook that reproduces a real host reconnect
   and confirms iPads do not re-join.

5. **Duplicate-device ownership matrix.** Two devices racing for the same team
   is only partially covered (reject + client rollback). There is no matrix of
   all race outcomes (same device re-join, two fresh devices, stale welcome vs
   fresh error) with the resulting ownership.

None of these were implemented in the "Guard teacher host role and preserve
team joins" change.
