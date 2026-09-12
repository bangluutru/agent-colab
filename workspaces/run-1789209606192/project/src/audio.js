/**
 * Procedural Web Audio for Fireworks Sound Effects
 * Uses pure Web Audio API oscillators and noise buffers.
 * Zero external audio assets, works offline, safe for autoplay restrictions.
 */

class SoundController {
  constructor() {
    this.audioCtx = null;
    this.enabled = false; // default muted for user comfort
  }

  init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  toggle() {
    this.init();
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playLaunch() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.4);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Ignore audio failure
    }
  }

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const ctx = this.audioCtx;
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      // Pinkish noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.96 * b1 + white * 0.11;
        b2 = 0.86 * b2 + white * 0.25;
        output[i] = (b0 + b1 + b2) * 0.4;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(ctx.currentTime);
      whiteNoise.stop(ctx.currentTime + 0.4);
    } catch {
      // Ignore audio failure
    }
  }
}

export const soundFx = new SoundController();
