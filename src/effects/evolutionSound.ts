/**
 * Synthesized, Pokémon-style evolution audio behind a provider seam.
 * Real browser path uses Web Audio oscillators; jsdom/unsupported falls back to silence.
 * Swap the provider (recorded clips, or a test spy) via setEvolutionSoundProvider.
 */
export interface EvolutionSound {
  strobe(): void; // rising glissando loop while the silhouette strobes
  flash(): void;  // noise swell on the burst
  reveal(): void; // arpeggio + sparkle on the reveal
  stop(): void;   // cancel any active nodes/loops
}

/** Sound plays only when the user has it enabled and reduced motion is off. */
export function soundAllowed(soundEnabled: boolean, reduced: boolean): boolean {
  return soundEnabled && !reduced;
}

/** Module-level gain multiplier driven by the mixer (0 = muted, 1 = full). */
let gainMul = 1;

/** Set the gain multiplier for evolution audio (clamped to 0..1). */
export function setEvolutionGain(g: number): void { gainMul = Math.max(0, Math.min(1, g)); }

const silent: EvolutionSound = { strobe() {}, flash() {}, reveal() {}, stop() {} };

function audioContextCtor(): (new () => AudioContext) | null {
  const w = globalThis as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function createWebAudioSound(): EvolutionSound {
  const Ctor = audioContextCtor();
  if (!Ctor) return silent;
  let ctx: AudioContext | null = null;
  let strobeTimer: ReturnType<typeof setTimeout> | null = null;
  const ac = () => {
    ctx = ctx ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };
  function ping(freq: number, type: OscillatorType, t0: number, dur: number, peak: number, ramp = false) {
    const c = ac();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (ramp) o.frequency.linearRampToValueAtTime(freq * 1.6, t0 + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak * gainMul, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  return {
    strobe() {
      if (strobeTimer) { clearTimeout(strobeTimer); strobeTimer = null; }
      const c = ac();
      let pitch = 220, delay = 230;
      const start = Date.now();
      const loop = () => {
        ping(pitch, 'sawtooth', c.currentTime, 0.2, 0.1, true);
        pitch = Math.min(pitch * 1.06, 1400);
        delay = Math.max(80, delay - 18);
        if (Date.now() - start < 1900) strobeTimer = setTimeout(loop, delay);
      };
      loop();
    },
    flash() {
      const c = ac();
      const len = Math.floor(c.sampleRate * 0.5);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const n = c.createBufferSource(); n.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(400, c.currentTime);
      f.frequency.linearRampToValueAtTime(6000, c.currentTime + 0.25);
      const g = c.createGain();
      g.gain.setValueAtTime(0.22 * gainMul, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      n.connect(f).connect(g).connect(c.destination); n.start();
    },
    reveal() {
      const c = ac();
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => ping(hz, 'triangle', c.currentTime + i * 0.09, 0.5, 0.18));
      [1568, 2093].forEach((hz, i) => ping(hz, 'sine', c.currentTime + 0.36 + i * 0.12, 0.3, 0.14));
    },
    stop() {
      if (strobeTimer) { clearTimeout(strobeTimer); strobeTimer = null; }
      if (ctx && ctx.state !== 'closed') void ctx.close();
      ctx = null;
    },
  };
}

let provider: (() => EvolutionSound) | null = null;

/** Override the sound factory (recorded clips, or a test spy). Pass null to reset. */
export function setEvolutionSoundProvider(fn: (() => EvolutionSound) | null): void {
  provider = fn;
}

export function getEvolutionSound(): EvolutionSound {
  if (provider) return provider();
  return createWebAudioSound();
}
