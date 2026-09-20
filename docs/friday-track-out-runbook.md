# Class Feud — Friday Track Out Runbook

Runbook for live classroom use of **Class Feud — Track 1 Track Out Edition**
with Team Buttons and Brain Blitz. Four rotations, ~20 minutes each, 20–24
students in 4 teams.

> Team Buttons are an **optional enhancement**. The game is fully playable
> without any iPads using manual face-off control. If networking fails at any
> point, switch to manual control and keep playing.

> **Team Buttons require the dev server.** They run on a local WebSocket
> server that `npm run dev` starts alongside the app. Opening a static build
> (`dist/index.html`) will **not** provide Team Buttons. Always start the host
> with `npm run dev -- --host`.

---

## FRIDAY 60-SECOND STARTUP

1. **Close old Class Feud tabs on every team iPad first.** A forgotten tab
   from a prior session/rehearsal stays connected and can silently occupy a
   team slot before you even open the app today.
2. On the Mac:
   ```bash
   cd ~/Projects/class-feud
   ```
3. Get the current Wi-Fi IP:
   ```bash
   ipconfig getifaddr en0
   ```
4. Start Class Feud:
   ```bash
   npm run dev -- --host
   ```
5. Teacher opens:
   `http://<Wi-Fi-IP>:5173/?host=teacher`
6. Team iPads scan the QR code on the teacher panel, or open:
   `http://<Wi-Fi-IP>:5173/team-button`
7. Join Team 1–4.
8. Verify all 4 show **CONNECTED** on the teacher panel.
9. Check each iPad: silent switch **OFF**, volume **up**.
10. Run one READY/press sound check (START FACE-OFF, let one team tap).
11. **RESET BUTTONS.**
12. Start the class game.

### IF AN IPAD CAN'T CONNECT

- **If the page won't load at all** (`http://<Wi-Fi-IP>:5173/team-button`): a
  LAN / firewall / client-isolation issue. The iPad cannot reach the Mac.
- **If the page loads but Team Buttons stays CONNECTING…**: HTTP works but the
  **WebSocket** connection (port `5174`) is failing — usually the Mac firewall
  blocking Node, or the school network blocking device-to-device traffic.
- **If the school Wi-Fi isolates devices** (iPads can't reach each other or the
  Mac): switch to **manual controls** or an approved non-isolated network.
  **App code cannot bypass WLAN client isolation.**

### EMERGENCY FALLBACK

If Team Buttons fail at any point, keep teaching — do not stop class to debug:

- **SET FIRST TEAM** — manually choose who answers.
- **NEXT TEAM** — the INCORRECT / NO ANSWER buttons during a face-off move to
  the next recorded team.
- **MANUAL CONTROL** — the entire game plays without any iPads at all.
- **RESET BUTTONS** — clears a stuck THINK/READY session.
- **IGNORE BUTTON RESULT** — discards the current press order without
  touching any score.

---

## BEFORE CLASS

1. **Start the host** (teacher computer):

   ```bash
   cd ~/Projects/class-feud
   npm run dev -- --host
   ```

   Leave this process running. It serves the app AND the Team Buttons server.

2. **Confirm the local address.** In a second terminal, run:

   ```bash
   ipconfig getifaddr en0
   ```

   This prints the Mac's actual Wi-Fi IP address directly (e.g.
   `192.168.1.20`). Use this address, not the `Network:` lines Vite prints at
   startup — if VPN software or other network tools are running, Vite lists
   every active interface (VPN/tunnel addresses included), and picking the
   wrong one produces a URL the iPads can't reach even though the app looks
   like it started fine. `en0` is the Wi-Fi hardware port on virtually all
   Macs; confirm with `networksetup -listallhardwareports` if unsure. All
   iPads and the teacher browser use `http://<that-address>:5173/...` on the
   same Wi-Fi network.

3. **Open the teacher view** in a browser at:

   ```
   http://<host-address>:5173/?host=teacher
   ```

   The `?host=teacher` value is an **accidental host-role takeover guard**,
   not authentication — it just stops a student device from accidentally
   claiming the teacher's host role (anyone on the LAN can read it). Choose
   **Track 1 — Track Out Edition**, set up **4 teams** (RED, BLUE, GREEN,
   GOLD), and start the game.

4. **Connect up to four iPads.** On each iPad, first **close any Class Feud
   browser tab left open from a prior session or rehearsal** — a tab that's
   still connected will occupy that team's slot and block a clean join. Then
   turn the **ringer/silent switch OFF and volume up** — iOS mutes Web Audio
   (the READY ding and press sound) whenever the switch is in silent mode,
   regardless of in-app volume or code. Then scan the QR code on the teacher
   panel, or open:

   ```
   http://<host-address>:5173/team-button
   ```

   Then tap the team name to join. No login, no names, no roster. Student
   devices use this `/team-button` path and do **not** add the `?host=` query.
   Tapping the team name is also what unlocks sound on that device — it must
   happen before the first face-off for the READY ding to play.

5. **Test one face-off.** From the teacher panel, open **TEAM BUTTONS**,
   press **START FACE-OFF**, confirm the countdown (3…2…1), then have each
   team tap once to confirm press order appears.

6. **Reset** (RESET BUTTONS) and confirm the buttons return to locked.

---

## FOR EACH CLASS (≈20 minutes)

- **4 teams (maximum)** of 5–6 students, one iPad per team.
- **Normal pace:** all **3 boards** (Locker Life → Recess → Track Out Plans),
  then **Brain Blitz** for the winning team (2-player mode supported).

**Running behind?** Play 2 boards, then use **Skip to Final Score** (on the
Round Over screen) to go straight to the final score and Brain Blitz. Points
already earned are kept exactly as they are — nothing is lost or recalculated.

**Running ahead?** After the normal 3 boards + Brain Blitz, use `+ EXTRA
BOARD` (one of 6 shared spare boards) or `+ EXTRA BLITZ` (exhibition — never
changes the official winner). Neither is ever launched automatically.

---

## BUTTON RULE

1. **Think first.** The teacher presses START FACE-OFF.
2. The button shows **THINK…** and counts down. Pressing during the countdown
   does **not** count.
3. After **3 seconds** the button goes **READY** (short ding).
4. **Tap gently once.** A press **commits the team to answer**.
5. The first team to press answers first; later presses are queued in order.
6. If a team presses but gives **NO ANSWER**, that team **cannot steal that
   board**. This penalty is cleared on the next board. No points are lost.

> A press only counts if the finger comes down **after** READY. Holding a
> finger down through the countdown, long-pressing, or double-tapping does not
> produce extra presses.

---

## ANSWER TIMER

A short pacing clock, separate from the THINK countdown above.

- Starts automatically once a team is established as **currently
  answering** — either the winner of a face-off (before the teacher judges
  them) or the first eligible team to press during a steal.
- Defaults to **5 seconds**; switch to **3 seconds** from the Team Buttons
  panel if you want a faster pace.
- Teacher controls: **PAUSE**, **RESUME**, **RESET** (restarts at the
  selected duration for the same team).
- At zero, the presenter briefly shows a red **X** and a short tone plays.

> **The timer running out is NOT an automatic strike, NOT an automatic "no
> answer," and it NEVER resolves a steal by itself.** It is a pacing cue
> only — the teacher still decides CORRECT / INCORRECT / NO ANSWER (or GIVE
> STEAL / Steal Success / Steal Failed) exactly as always, even after the
> timer hits zero. If a student is mid-answer when it expires, let them
> finish and judge the answer normally.

---

## IF WIFI FAILS

1. The teacher switches to **manual face-off control**.
2. Use **SET FIRST TEAM** (or NEXT TEAM via the INCORRECT / NO ANSWER buttons)
   to choose who answers, exactly like the no-iPad flow.
3. Use **RESET BUTTONS** (clears a stuck THINK/READY session so the buttons
   go back to locked) or **IGNORE BUTTON RESULT** (discards the current press
   order without touching any score) to clear any stale state.
4. The game continues normally; scores, strikes, steals, and Brain Blitz are
   unaffected.

If an iPad disconnects mid-round it shows RECONNECTING and re-joins when it
returns. The game never depends on a device staying connected.

If the **teacher's own device** briefly drops Wi-Fi during a live face-off or
steal window, the header will flash RECONNECTING and the button session resets
to not-live once it reconnects (any in-progress press order is lost). Existing
**team joins survive** — iPads stay on their teams and do not need to re-join.
This is a Team Buttons display reset only — scores, strikes, and the official
game state are never affected. Just press START FACE-OFF / START STEAL again.

---

## TROUBLESHOOTING

- **Wrong port / page won't load:** get the IP from `ipconfig getifaddr en0`
  (step 2 above), not from Vite's printed `Network:` lines. The HTTP port is
  **pinned to `5173`** — if it is already in use, Vite fails to start with a
  clear error instead of silently choosing another port. Free up port `5173`
  and restart.
- **Team Buttons stuck on RECONNECTING / CONNECTING / "NOT REACHABLE":** the
  page loaded (HTTP works) but the Team Buttons **WebSocket** server (port
  `5174`) is not reachable — usually because the Mac firewall blocked Node, or
  the school network blocks device-to-device traffic. The server console prints
  a `[Team Buttons] WebSocket server unavailable` line if the port itself is
  taken. Switch to **manual face-off control** (SET FIRST TEAM) and keep
  playing; Team Buttons are optional.
- **iPads can't reach the host at all:** the school Wi-Fi is likely isolating
  peers (client isolation). Use manual face-off mode; do not change the setup
  during class. **App code cannot bypass WLAN client isolation** — a
  non-isolated network (or IT approval) is required.
