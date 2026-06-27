/**
 * Synthesized one-shot game SFX behind a provider seam, mirroring evolutionSound.
 * jsdom/unsupported falls back to silence. Each one-shot may be replaced by a
 * registered recorded sample (hybrid upgrade) without changing call sites.
 */
export type SfxName =
  | 'tap' | 'nav'
  | 'drop' | 'correct' | 'wrong'
  | 'coin' | 'purchase' | 'pull' | 'reveal' | 'feed'
  | 'coo'
  | 'hit' | 'crit' | 'dodge' | 'bossCharge' | 'bossHit' | 'enrage' | 'fizzle';

export interface Sfx {
  /** Play a one-shot at the given effective gain (0..1). gain<=0 is a no-op. */
  play(name: SfxName, gain: number): void;
  /** Cancel/cleanup (closes the AudioContext). */
  stop(): void;
}

const silent: Sfx = { play() {}, stop() {} };

function audioContextCtor(): (new () => AudioContext) | null {
  const w = globalThis as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const samples = new Map<SfxName, AudioBuffer>();

function createWebAudioSfx(): Sfx {
  const Ctor = audioContextCtor();
  if (!Ctor) return silent;
  let ctx: AudioContext | null = null;
  const ac = () => {
    ctx = ctx ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  function ping(freq: number, type: OscillatorType, t0: number, dur: number, peak: number, glideTo?: number) {
    const c = ac();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo !== undefined) o.frequency.linearRampToValueAtTime(glideTo, t0 + dur * 0.9);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur: number, peak: number, from: number, to: number) {
    const c = ac();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(from, c.currentTime);
    f.frequency.linearRampToValueAtTime(to, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(peak, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    n.connect(f).connect(g).connect(c.destination); n.start();
  }

  function playSample(name: SfxName, gain: number): boolean {
    const buf = samples.get(name);
    if (!buf) return false;
    const c = ac();
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.setValueAtTime(gain, c.currentTime);
    src.connect(g).connect(c.destination); src.start();
    return true;
  }

  // Each recipe is scaled by `v` (the effective gain).
  const recipes: Record<SfxName, (c: AudioContext, v: number) => void> = {
    tap:      (c, v) => ping(660, 'triangle', c.currentTime, 0.05, 0.06 * v),
    nav:      (_c, v) => noise(0.18, 0.08 * v, 600, 2400),
    drop:     (c, v) => ping(520, 'triangle', c.currentTime, 0.06, 0.08 * v),
    correct:  (c, v) => { ping(523.25, 'triangle', c.currentTime, 0.14, 0.16 * v); ping(659.25, 'triangle', c.currentTime + 0.1, 0.18, 0.16 * v); },
    wrong:    (c, v) => ping(180, 'sawtooth', c.currentTime, 0.28, 0.16 * v, 90),
    coin:     (c, v) => { ping(988, 'square', c.currentTime, 0.08, 0.12 * v); ping(1319, 'square', c.currentTime + 0.06, 0.1, 0.12 * v); },
    purchase: (c, v) => { ping(784, 'square', c.currentTime, 0.1, 0.12 * v); ping(1047, 'square', c.currentTime + 0.08, 0.14, 0.12 * v); },
    pull:     (c, v) => ping(220, 'sawtooth', c.currentTime, 0.5, 0.12 * v, 880),
    reveal:   (c, v) => [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => ping(hz, 'triangle', c.currentTime + i * 0.08, 0.4, 0.16 * v)),
    feed:     (c, v) => ping(300, 'sine', c.currentTime, 0.12, 0.14 * v, 160),
    coo:      (c, v) => ping(440, 'sine', c.currentTime, 0.22, 0.08 * v, 560),
    hit:        (c, v) => { ping(440, 'square', c.currentTime, 0.1, 0.14 * v, 220); noise(0.08, 0.06 * v, 1200, 400); },
    crit:       (c, v) => { ping(660, 'square', c.currentTime, 0.14, 0.18 * v, 990); ping(990, 'square', c.currentTime + 0.06, 0.12, 0.16 * v); },
    dodge:      (_c, v) => noise(0.22, 0.08 * v, 300, 3000),
    bossCharge: (c, v) => ping(160, 'sawtooth', c.currentTime, 0.6, 0.1 * v, 520),
    bossHit:    (c, v) => { ping(140, 'sawtooth', c.currentTime, 0.22, 0.16 * v, 70); noise(0.12, 0.08 * v, 800, 200); },
    enrage:     (c, v) => { ping(110, 'sawtooth', c.currentTime, 0.5, 0.18 * v, 440); ping(220, 'square', c.currentTime + 0.08, 0.4, 0.12 * v, 660); },
    fizzle:     (c, v) => { ping(300, 'sawtooth', c.currentTime, 0.3, 0.1 * v, 120); noise(0.18, 0.05 * v, 2000, 300); },
  };

  return {
    play(name, gain) {
      if (gain <= 0) return;
      if (playSample(name, gain)) return;
      recipes[name](ac(), gain);
    },
    stop() {
      if (ctx && ctx.state !== 'closed') void ctx.close();
      ctx = null;
    },
  };
}

let provider: (() => Sfx) | null = null;

/** Override the SFX factory (recorded clips, or a test spy). Pass null to reset. */
export function setSfxProvider(fn: (() => Sfx) | null): void {
  provider = fn;
}

/** Register a recorded sample to override a synth one-shot (hybrid upgrade). */
export function registerSample(name: SfxName, buffer: AudioBuffer): void {
  samples.set(name, buffer);
}

export function getSfx(): Sfx {
  if (provider) return provider();
  return createWebAudioSfx();
}
