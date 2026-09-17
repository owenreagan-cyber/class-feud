# Class Feud — Friday Track Out Runbook

Runbook for live classroom use of **Class Feud — Track 1 Track Out Edition**
with Team Buttons and Brain Blitz. Four rotations, ~20 minutes each, 20–24
students in 4 teams.

> Team Buttons are an **optional enhancement**. The game is fully playable
> without any iPads using manual face-off control. If networking fails at any
> point, switch to manual control and keep playing.

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
