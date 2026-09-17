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

2. **Confirm the local address.** Read the `Network:` line printed by Vite
   (e.g. `http://192.168.1.20:5173/`). All iPads and the teacher browser use
   this address on the same Wi-Fi network.

3. **Open the teacher view** in a browser at the host address, choose
   **Track 1 — Track Out Edition**, set up **4 teams** (RED, BLUE, GREEN,
   GOLD), and start the game.

4. **Connect up to four iPads.** On each iPad open:

   ```
   http://<host-address>/team-button
   ```

   Then tap the team name to join. No login, no names, no roster.

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

---

## TROUBLESHOOTING

- **Wrong port / page won't load:** always read the `Network:` line Vite
  prints at startup (e.g. `http://192.168.4.47:5173/`). If port `5173` is
  already in use, Vite picks the next free port (e.g. `5175`) and prints it.
  Use whatever port is printed; do not assume `5173`.
- **Team Buttons stuck on RECONNECTING / CONNECTING:** the Team Buttons
  WebSocket server (port `5174`) could not start — usually because another
  program is using that port, or the iPad network cannot reach the host. The
  server console prints a `[Team Buttons] WebSocket server unavailable` line.
  Switch to **manual face-off control** (SET FIRST TEAM) and keep playing;
  Team Buttons are optional.
- **iPads can't reach the host at all:** the school Wi-Fi is likely isolating
  peers (client isolation). Use manual face-off mode; do not change the setup
  during class.
