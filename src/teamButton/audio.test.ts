// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// audio.ts keeps its AudioContext in module-level state, so each test needs a
// fresh module instance (isolated from whatever a previous test created).
async function freshAudioModule() {
  vi.resetModules();
  return import('./audio');
}

class FakeGainParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeGainNode {
  gain = new FakeGainParam();
  connect = vi.fn();
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  createGain = vi.fn(() => new FakeGainNode());
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  destination = {};

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unlockAudio', () => {
  it('creates the AudioContext on first call (a stand-in for a real user gesture)', async () => {
    const { unlockAudio } = await freshAudioModule();
    unlockAudio();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('resumes a suspended context', async () => {
    const { unlockAudio } = await freshAudioModule();
    unlockAudio();
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledTimes(1);
  });

  it('repeated calls reuse the same context instead of creating a new one', async () => {
    const { unlockAudio } = await freshAudioModule();
    unlockAudio();
    unlockAudio();
    unlockAudio();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('does not call resume again once the context is already running', async () => {
    const { unlockAudio } = await freshAudioModule();
    unlockAudio();
    const context = FakeAudioContext.instances[0];
    expect(context.resume).toHaveBeenCalledTimes(1);
    unlockAudio();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('resumes again if the context becomes suspended a second time (iOS re-suspension)', async () => {
    const { unlockAudio } = await freshAudioModule();
    unlockAudio();
    const context = FakeAudioContext.instances[0];
    expect(context.resume).toHaveBeenCalledTimes(1);
    context.state = 'suspended';
    unlockAudio();
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('never throws when AudioContext is unavailable', async () => {
    vi.unstubAllGlobals();
    const { unlockAudio } = await freshAudioModule();
    expect(() => unlockAudio()).not.toThrow();
  });

  it('never throws when the AudioContext constructor itself throws', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked by browser policy');
        }
      },
    );
    const { unlockAudio } = await freshAudioModule();
    expect(() => unlockAudio()).not.toThrow();
  });
});

describe('playReadyDing / playFirstPress', () => {
  it('play through the context unlockAudio already created (no separate context)', async () => {
    const { unlockAudio, playReadyDing, playFirstPress } = await freshAudioModule();
    unlockAudio();
    playReadyDing();
    playFirstPress();
    expect(FakeAudioContext.instances).toHaveLength(1);
    const context = FakeAudioContext.instances[0];
    // playReadyDing = 1 tone, playFirstPress = 2 tones.
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('are silent no-ops if unlockAudio was never called (no context yet)', async () => {
    const { playReadyDing, playFirstPress } = await freshAudioModule();
    expect(() => {
      playReadyDing();
      playFirstPress();
    }).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('never throw even if oscillator creation fails', async () => {
    const { unlockAudio, playReadyDing } = await freshAudioModule();
    unlockAudio();
    const context = FakeAudioContext.instances[0];
    context.createOscillator = vi.fn(() => {
      throw new Error('audio graph failure');
    });
    expect(() => playReadyDing()).not.toThrow();
  });
});
