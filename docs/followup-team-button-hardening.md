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
   Manually verified once on a physical iPad (locked ~45s, server evicted the
   stale claim, device reclaimed its team on wake with no "already joined"
   error) — a real automated E2E for this is still the open item.

4. **Host-reconnect-preserves-joins E2E.** The room-level test proves team joins
   survive a host replacement, but there is no end-to-end test through the Vite
   WebSocket server and the client hook that reproduces a real host reconnect
   and confirms iPads do not re-join. Manually verified once on a physical
   iPad (host page reload while a team was connected; team stayed connected
   with no rejoin) — a real automated E2E for this is still the open item.

5. **Duplicate-device ownership matrix.** Two devices racing for the same team
   is only partially covered (reject + client rollback). There is no matrix of
   all race outcomes (same device re-join, two fresh devices, stale welcome vs
   fresh error) with the resulting ownership.

None of these were implemented in the "Guard teacher host role and preserve
team joins" change.

## Deferred from the post-physical-test presentation review

Prompted by the physical iPad certification session. None of this was built —
recorded here for a future dedicated design/implementation pass.

6. **Teacher Team Button HUD state clarity.** The teacher can currently infer
   session kind/state/press winner/eligibility, but has to read it out of the
   existing panel rather than seeing it summarized at a glance. A compact
   status header (session kind, button state, current answering team,
   eligibility) would help mid-class.

7. **Post-press answer timer.** A distinct pacing timer that starts once a team
   is FIRST, shown on the teacher HUD, with a teacher-visible expiry cue.
   Two design decisions to preserve for whoever builds this:
   - **The answer timer is pacing only.** It must never mutate score, strikes,
     or possession on expiry — it is a visual/audio cue for the teacher, who
     stays fully authoritative over reveal/strike/no-answer, including after
     expiry (a student can be mid-answer when the buzzer sounds).
   - **THINK, PRESS ORDER, and ANSWER TIMER are three separate concepts** and
     must not be collapsed into one state machine or share a duration/timer
     implementation: THINK is the pre-press countdown (`faceOffMachine`'s
     existing `thinkSeconds`), PRESS ORDER is who buzzed and in what order,
     and ANSWER TIMER is a new, independent post-press pacing clock.

8. **Sound layer (reveal / strike / timeout cues).** Beyond the existing
   ready-ding and first-press sound, add reveal/correct and
   wrong-answer/timeout cues. Must be original/generated audio (no copyrighted
   Family Feud sounds), must never be required for game logic (Safari can
   block autoplay), and must not duplicate on rerender or replay on reload.

9. **Strike and reveal presenter feedback.** A more game-show-like strike
   overlay (large "X", brief animation) and a reveal treatment beyond the
   current flip animation, shown on the projector.

10. **Team Button "CONNECTING…" flicker during phase transitions.** The panel
    unmounts/remounts across tossup→playing→steal, showing a brief
    "CONNECTING…" even though nothing is actually wrong. This is **not**
    caused by the socket remount clearing stale session state anymore — the
    "Guard teacher host role and preserve team joins" change already fixed
    that; a host `hello` now resets only the transient face-off machine and
    preserves the team roster and live joins. The flicker itself is now purely
    cosmetic copy (the panel briefly shows a generic connecting state during
    an expected, intentional transition, not a real reconnect). Worth
    revisiting whether the UI can distinguish "expected transition" from
    "genuine network loss" and word the copy accordingly — no networking
    changes needed, just a possible copy/state distinction.
