// Lightweight Web Audio "ding" / confirmation for Team Buttons. No audio
// assets, no loops, no loud tones. Respects browser autoplay restrictions:
// every sound is triggered by a user gesture and fails silently otherwise.

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    return audioContext;
  } catch {
    return null;
  }
}

function tone(frequency: number, duration: number, delay = 0): void {
  const context = getContext();
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
