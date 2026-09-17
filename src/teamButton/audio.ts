// Lightweight Web Audio "ding" / confirmation for Team Buttons. No audio
// assets, no loops, no loud tones. Respects browser autoplay restrictions:
// every sound is triggered by a user gesture and fails silently otherwise.
//
// iOS Safari only creates/resumes an AudioContext synchronously inside a real
// user-gesture event handler; a context first created later (e.g. from a
// state-change effect) is created suspended and stays that way for the life
// of the page. `unlockAudio` exists specifically to be called from such a
// gesture (team join tap, button press) so the context is always created (or
// resumed) at a point iOS is willing to honor. `tone` never creates the
// context itself — it only ever plays through whatever `unlockAudio` already
// set up, so a missed/failed unlock degrades to silence, never an error.

let audioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/**
 * Create the shared AudioContext if it doesn't exist yet, and resume it if
 * it's suspended (iOS can re-suspend an existing context, e.g. after the
 * page is backgrounded). Call this synchronously from every real user
 * gesture that could plausibly be the first one (team join) or a later one
 * (button press) — it is a safe no-op if the context already exists and is
 * running, and never throws or rejects into the caller.
 */
export function unlockAudio(): void {
  try {
    if (!audioContext) {
      const Ctor = getAudioContextConstructor();
      if (!Ctor) return;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  } catch {
    // Audio is best-effort; never throw during gameplay.
  }
}

function tone(frequency: number, duration: number, delay = 0): void {
  const context = audioContext;
  if (!context) return;
  try {
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  } catch {
    // Audio is best-effort; never throw during gameplay.
  }
}

/** Short ding when the button goes live (READY). */
export function playReadyDing(): void {
  tone(880, 0.14);
}

/** Short two-note confirmation when a team presses first. */
export function playFirstPress(): void {
  tone(660, 0.1);
  tone(880, 0.12, 0.12);
}
