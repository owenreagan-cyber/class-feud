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
   http://<host-address>/?host=teacher
   ```

   The `?host=teacher` value is an **accidental host-role takeover guard**,
   not authentication — it just stops a student device from accidentally
   claiming the teacher's host role (anyone on the LAN can read it). Choose
   **Track 1 — Track Out Edition**, set up **4 teams** (RED, BLUE, GREEN,
   GOLD), and start the game.

4. **Connect up to four iPads.** On each iPad, first turn the **ringer/silent
   switch OFF and volume up** — iOS mutes Web Audio (the READY ding and press
   sound) whenever the switch is in silent mode, regardless of in-app volume
   or code. Then open:

   ```
   http://<host-address>/team-button
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

- **4 teams** of 5–6 students, one iPad per team.
- **3 boards** (Locker Life → Recess → Track Out Plans).
- **Brain Blitz** for the winning team (2-player mode supported).
- **If time allows**, use `+ EXTRA BOARD` (a spare board) or `+ EXTRA BLITZ`
  (exhibition; does not change the official winner). These are **never**
  launched automatically.

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

## IF WIFI FAILS

1. The teacher switches to **manual face-off control**.
2. Use **SET FIRST TEAM** (or NEXT TEAM via the INCORRECT / NO ANSWER buttons)
   to choose who answers, exactly like the no-iPad flow.
3. Use **RESET BUTTONS** / **IGNORE BUTTON RESULT** to clear any stale state.
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
  (step 2 above), not from Vite's printed `Network:` lines. For the *port*,
  check the terminal: if `5173` is already in use, Vite picks the next free
  port (e.g. `5175`) and prints it. Use whatever port is printed; do not
  assume `5173`.
- **Team Buttons stuck on RECONNECTING / CONNECTING:** the Team Buttons
  WebSocket server (port `5174`) could not start — usually because another
  program is using that port, or the iPad network cannot reach the host. The
  server console prints a `[Team Buttons] WebSocket server unavailable` line.
  Switch to **manual face-off control** (SET FIRST TEAM) and keep playing;
  Team Buttons are optional.
- **iPads can't reach the host at all:** the school Wi-Fi is likely isolating
  peers (client isolation). Use manual face-off mode; do not change the setup
  during class.
