# Game Audio — Phase 1 (SFX + Mixer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global synthesized-SFX layer and a four-channel volume mixer (Master/SFX/Music/Voice) with a Settings sheet, replacing the binary `soundEnabled` setting — all assetless and shippable on its own.

**Architecture:** A pure `mixer.ts` computes effective per-channel gain from a store `audio` slice. `sfx.ts` mirrors the existing `evolutionSound` provider-seam pattern (lazy shared `AudioContext`, jsdom-silent fallback, hybrid synth/sample). `useAudio.ts` is a stable facade whose callbacks read `useGameStore.getState()` at call time (no subscription → no re-render churn) and forward computed gains to `sfx`. Existing chokepoints (`useRoundFeedback`, `PressButton`, `useSpeech`, `evolutionSound`, economy actions) call the facade.

**Tech Stack:** React 19 + TS + Zustand (persist middleware) + Vitest/jsdom + Web Audio API.

**Source spec:** `docs/superpowers/specs/2026-06-27-game-audio-design.md` (Phase 1 = §3.1–3.4, §4, §5 SFX rows, §6, §7, §8). Music (§3.3 `music.ts`, zones, stingers) is **Phase 2 — out of scope here**.

---

## File Structure

- Create: `src/audio/mixer.ts` — pure gain math + `AudioSettings`/`Channel`/`ChannelName` types + `defaultAudioSettings()`.
- Create: `src/audio/mixer.test.ts`
- Create: `src/effects/sfx.ts` — synth one-shots behind provider seam.
- Create: `src/effects/sfx.test.ts`
- Create: `src/hooks/useAudio.ts` — store-bound facade.
- Create: `src/hooks/useAudio.test.ts`
- Create: `src/components/SettingsSheet.tsx` — the mixer UI (bottom sheet).
- Create: `src/components/SettingsSheet.test.tsx`
- Modify: `src/state/gameStore.ts` — replace `soundEnabled` with `audio` slice + actions; `PERSIST_VERSION 10→11` + migration.
- Modify: `src/state/gameStore.persisted.test.ts` — expect `audio` instead of `soundEnabled`; version 11.
- Modify: `src/components/useRoundFeedback.ts` — play `correct`/`wrong` SFX.
- Modify: `src/components/PressButton.tsx` — play debounced `tap` SFX on click.
- Modify: `src/config/audio.ts` — `speak` accepts a `volume` arg.
- Modify: `src/hooks/useSpeech.ts` — apply voice-channel gain; skip when 0.
- Modify: `src/effects/evolutionSound.ts` — accept a `gain` multiplier so mute-all silences it.
- Modify: `src/components/EvolutionCinematic.tsx` — route sound gain; repoint 🔊 to `toggleMuteAll`.
- Modify: economy call-sites — `src/components/Gacha.tsx`, `src/components/PetRoom.tsx`, shop card components, reward path — play `pull`/`reveal`/`purchase`/`coin`/`feed`.
- Modify: a header host (where the gear icon mounts) to open `SettingsSheet`.

---

## Task 1: Pure mixer (`mixer.ts`)

**Files:**
- Create: `src/audio/mixer.ts`
- Test: `src/audio/mixer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/audio/mixer.test.ts
import { describe, it, expect } from 'vitest';
import { effectiveGain, defaultAudioSettings, type AudioSettings } from './mixer';

const base = (): AudioSettings => defaultAudioSettings();

describe('effectiveGain', () => {
  it('defaults to full gain (1) for every channel', () => {
    const s = base();
    expect(effectiveGain('sfx', s)).toBe(1);
    expect(effectiveGain('music', s)).toBe(1);
    expect(effectiveGain('voice', s)).toBe(1);
  });

  it('multiplies master level by channel level', () => {
    const s = base();
    s.master.level = 0.5;
    s.sfx.level = 0.4;
    expect(effectiveGain('sfx', s)).toBeCloseTo(0.2);
  });

  it('channel mute zeroes only that channel', () => {
    const s = base();
    s.sfx.muted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
    expect(effectiveGain('music', s)).toBe(1);
  });

  it('master mute zeroes every channel', () => {
    const s = base();
    s.master.muted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
    expect(effectiveGain('voice', s)).toBe(0);
  });

  it('allMuted overrides everything', () => {
    const s = base();
    s.master.level = 1; s.sfx.level = 1; s.sfx.muted = false;
    s.allMuted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
  });

  it('defaultAudioSettings returns an unmuted full-level mixer', () => {
    const s = defaultAudioSettings();
    expect(s).toEqual({
      master: { level: 1, muted: false },
      sfx: { level: 1, muted: false },
      music: { level: 1, muted: false },
      voice: { level: 1, muted: false },
      allMuted: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/audio/mixer.test.ts`
Expected: FAIL — cannot find module `./mixer`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/audio/mixer.ts
/** A single mixer channel. level is 0..1. */
export type Channel = { level: number; muted: boolean };

/** The three adjustable output channels (master is handled separately). */
export type ChannelName = 'sfx' | 'music' | 'voice';

/** The full persisted mixer state. */
export type AudioSettings = {
  master: Channel;
  sfx: Channel;
  music: Channel;
  voice: Channel;
  allMuted: boolean;
};

/** Fresh mixer: every channel full and unmuted. */
export function defaultAudioSettings(): AudioSettings {
  const full = (): Channel => ({ level: 1, muted: false });
  return { master: full(), sfx: full(), music: full(), voice: full(), allMuted: false };
}

/**
 * Effective 0..1 gain for a channel.
 * Mute precedence: allMuted > master.muted > channel.muted > (master.level * channel.level).
 */
export function effectiveGain(channel: ChannelName, s: AudioSettings): number {
  if (s.allMuted) return 0;
  if (s.master.muted) return 0;
  const ch = s[channel];
  if (ch.muted) return 0;
  return s.master.level * ch.level;
}

/** Clamp a slider value into the valid 0..1 range. */
export function clampLevel(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/mixer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/mixer.ts src/audio/mixer.test.ts
git commit -m "feat(audio): pure mixer gain math + AudioSettings types"
```

---

## Task 2: Store `audio` slice + actions + migration

Replaces the binary `soundEnabled` with the mixer slice and bumps the persist version.

**Files:**
- Modify: `src/state/gameStore.ts` (interface ~L56/L73, PersistedState pick ~L89, selectPersisted ~L104, freshState ~L163, actions ~L270, PERSIST_VERSION ~L83, migrate ~L340)
- Modify: `src/state/gameStore.test.ts` (new action tests)
- Modify: `src/state/gameStore.persisted.test.ts` (audio field + version 11)

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameStore.test.ts` (top imports already include `useGameStore`; add `defaultAudioSettings` import):

```ts
import { defaultAudioSettings } from '../audio/mixer';

describe('audio mixer actions', () => {
  beforeEach(() => {
    useGameStore.setState({ audio: defaultAudioSettings() });
  });

  it('setChannelLevel clamps into 0..1', () => {
    useGameStore.getState().setChannelLevel('sfx', 1.5);
    expect(useGameStore.getState().audio.sfx.level).toBe(1);
    useGameStore.getState().setChannelLevel('music', -0.2);
    expect(useGameStore.getState().audio.music.level).toBe(0);
    useGameStore.getState().setChannelLevel('master', 0.3);
    expect(useGameStore.getState().audio.master.level).toBeCloseTo(0.3);
  });

  it('toggleChannelMute flips a single channel', () => {
    useGameStore.getState().toggleChannelMute('voice');
    expect(useGameStore.getState().audio.voice.muted).toBe(true);
    useGameStore.getState().toggleChannelMute('voice');
    expect(useGameStore.getState().audio.voice.muted).toBe(false);
  });

  it('toggleMuteAll flips the global flag', () => {
    useGameStore.getState().toggleMuteAll();
    expect(useGameStore.getState().audio.allMuted).toBe(true);
  });
});
```

Update `src/state/gameStore.persisted.test.ts`:
- In the `keys` array, replace `'soundEnabled'` with `'audio'`.
- Change `expect(PERSIST_VERSION).toBe(10)` → `toBe(11)`.
- Replace the `soundEnabled` test with:

```ts
  it('includes audio, defaulting to a full unmuted mixer', () => {
    expect(selectPersisted(useGameStore.getState())).toHaveProperty('audio.master.level', 1);
    expect(selectPersisted(useGameStore.getState())).toHaveProperty('audio.allMuted', false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts`
Expected: FAIL — `setChannelLevel`/`audio` undefined; version mismatch.

- [ ] **Step 3: Implement the store changes**

In `src/state/gameStore.ts`:

3a. Add import near the top:
```ts
import { defaultAudioSettings, clampLevel, type AudioSettings, type ChannelName } from '../audio/mixer';
```

3b. In the `GameState` interface, replace `soundEnabled: boolean;` (~L56) with:
```ts
  audio: AudioSettings;
```
and replace `toggleSound: () => void;` (~L73) with:
```ts
  setChannelLevel: (ch: 'master' | ChannelName, v: number) => void;
  toggleChannelMute: (ch: 'master' | ChannelName) => void;
  toggleMuteAll: () => void;
```

3c. In `PersistedState` (the `Pick`, ~L89) replace `'soundEnabled'` with `'audio'`.

3d. In `selectPersisted` (~L104) replace `soundEnabled: s.soundEnabled,` with `audio: s.audio,`.

3e. In `freshState` (~L163) replace `soundEnabled: true,` with `audio: defaultAudioSettings(),`.

3f. Replace the `toggleSound` action (~L270) with:
```ts
      setChannelLevel: (ch, v) =>
        set((s) => ({ audio: { ...s.audio, [ch]: { ...s.audio[ch], level: clampLevel(v) } } })),

      toggleChannelMute: (ch) =>
        set((s) => ({ audio: { ...s.audio, [ch]: { ...s.audio[ch], muted: !s.audio[ch].muted } } })),

      toggleMuteAll: () => set((s) => ({ audio: { ...s.audio, allMuted: !s.audio.allMuted } })),
```

3g. Bump `PERSIST_VERSION` (~L83): `export const PERSIST_VERSION = 11;`

3h. In `migrate`, add `audio` to the normalized `base` object (the block ~L340 that sets `inventory`, `owned`, `journey`, `soundEnabled`). Replace the `soundEnabled: ...` line there with:
```ts
          audio:
            (st as { audio?: AudioSettings }).audio ??
            (() => {
              // v10->v11: derive the mixer from the old boolean. soundEnabled:false -> mute all.
              const a = defaultAudioSettings();
              const legacy = (st as { soundEnabled?: boolean }).soundEnabled;
              if (legacy === false) a.allMuted = true;
              return a;
            })(),
```
Then add, just before `return base` at the end of migrate (~L399, next to the existing `delete (base as { pet?: unknown }).pet;`):
```ts
        delete (base as { soundEnabled?: unknown }).soundEnabled;
```
Also update the migrate comment block (~L317) to: `// v10->v11 replaces soundEnabled with the audio mixer slice.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (catches every remaining `soundEnabled` reference)**

Run: `npx tsc -b`
Expected: errors ONLY in `EvolutionCinematic.tsx` (still uses `soundEnabled`/`toggleSound`) — those are fixed in Task 8. If any OTHER file errors, fix that reference to use `audio`/the new actions before moving on.

- [ ] **Step 6: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts
git commit -m "feat(audio): replace soundEnabled with mixer slice (PERSIST_VERSION 10->11)"
```

---

## Task 3: Migration regression test (v10 save → v11)

Locks the `soundEnabled:false → allMuted:true` behavior against a realistic old payload.

**Files:**
- Test: `src/state/gameStore.migrate.test.ts` (create — if a migration test file already exists, add the cases there instead)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/gameStore.migrate.test.ts
import { describe, it, expect } from 'vitest';

// The persist middleware exposes migrate via options; we test it directly by
// reimporting the store module's persisted config is awkward, so we assert the
// observable contract: a v10 blob written to localStorage is upgraded on load.
import { useGameStore, PERSIST_VERSION } from './gameStore';

function writeV10(soundEnabled: boolean) {
  const state = {
    screen: 'room', pets: [], activePetId: 'starter-leaf', coins: 0,
    inventory: {}, selectedDrill: 'pattern', selectedLevel: 1,
    lastReward: null, lastPull: null, owned: [], activeBackground: null,
    journey: { lessonStars: {} }, soundEnabled,
  };
  localStorage.setItem('sentence-pet', JSON.stringify({ state, version: 10 }));
}

describe('v10 -> v11 audio migration', () => {
  it('upgrades a sound-on save to a full unmuted mixer', () => {
    writeV10(true);
    useGameStore.persist.rehydrate();
    const a = useGameStore.getState().audio;
    expect(a.allMuted).toBe(false);
    expect(a.master.level).toBe(1);
    expect(PERSIST_VERSION).toBe(11);
  });

  it('upgrades a muted (soundEnabled:false) save to allMuted', () => {
    writeV10(false);
    useGameStore.persist.rehydrate();
    expect(useGameStore.getState().audio.allMuted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (then passes)**

Run: `npx vitest run src/state/gameStore.migrate.test.ts`
Expected: PASS if Task 2 migrate is correct. If `rehydrate` is not exposed or jsdom lacks `localStorage`, fall back to importing and calling the migrate function directly — export it from `gameStore.ts` as `export function migratePersisted(p: unknown): GameState` and test that pure function with the v10 blob. Adjust the test to call `migratePersisted(...)` and assert `.audio`.

- [ ] **Step 3: Commit**

```bash
git add src/state/gameStore.migrate.test.ts src/state/gameStore.ts
git commit -m "test(audio): v10->v11 migration backfills the mixer"
```

---

## Task 4: Synth SFX module (`sfx.ts`)

Mirrors `src/effects/evolutionSound.ts` exactly: provider seam, jsdom-silent fallback, lazy shared `AudioContext`, hybrid sample hook.

**Files:**
- Create: `src/effects/sfx.ts`
- Test: `src/effects/sfx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/effects/sfx.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSfx, setSfxProvider, type Sfx, type SfxName } from './sfx';

afterEach(() => setSfxProvider(null));

describe('sfx provider seam', () => {
  it('returns a silent no-op when no AudioContext exists (jsdom)', () => {
    // jsdom has no AudioContext, so the real factory must not throw.
    const s = getSfx();
    expect(() => s.play('tap', 1)).not.toThrow();
    expect(() => s.stop()).not.toThrow();
  });

  it('uses an injected provider (test spy)', () => {
    const play = vi.fn();
    const spy: Sfx = { play, stop: vi.fn() };
    setSfxProvider(() => spy);
    getSfx().play('correct', 0.8);
    expect(play).toHaveBeenCalledWith('correct', 0.8);
  });

  it('exposes the expected SfxName union via a sample registration call', () => {
    const names: SfxName[] = ['tap', 'nav', 'drop', 'correct', 'wrong', 'coin', 'purchase', 'pull', 'reveal', 'feed', 'coo'];
    expect(names.length).toBe(11);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/effects/sfx.test.ts`
Expected: FAIL — cannot find module `./sfx`.

- [ ] **Step 3: Write the implementation**

```ts
// src/effects/sfx.ts
/**
 * Synthesized one-shot game SFX behind a provider seam, mirroring evolutionSound.
 * jsdom/unsupported falls back to silence. Each one-shot may be replaced by a
 * registered recorded sample (hybrid upgrade) without changing call sites.
 */
export type SfxName =
  | 'tap' | 'nav'
  | 'drop' | 'correct' | 'wrong'
  | 'coin' | 'purchase' | 'pull' | 'reveal' | 'feed'
  | 'coo';

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
    if (glideTo) o.frequency.linearRampToValueAtTime(glideTo, t0 + dur * 0.9);
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
    nav:      (c, v) => noise(0.18, 0.08 * v, 600, 2400),
    drop:     (c, v) => ping(520, 'triangle', c.currentTime, 0.06, 0.08 * v),
    correct:  (c, v) => { ping(523.25, 'triangle', c.currentTime, 0.14, 0.16 * v); ping(659.25, 'triangle', c.currentTime + 0.1, 0.18, 0.16 * v); },
    wrong:    (c, v) => ping(180, 'sawtooth', c.currentTime, 0.28, 0.16 * v, 90),
    coin:     (c, v) => { ping(988, 'square', c.currentTime, 0.08, 0.12 * v); ping(1319, 'square', c.currentTime + 0.06, 0.1, 0.12 * v); },
    purchase: (c, v) => { ping(784, 'square', c.currentTime, 0.1, 0.12 * v); ping(1047, 'square', c.currentTime + 0.08, 0.14, 0.12 * v); },
    pull:     (c, v) => ping(220, 'sawtooth', c.currentTime, 0.5, 0.12 * v, 880),
    reveal:   (c, v) => [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => ping(hz, 'triangle', c.currentTime + i * 0.08, 0.4, 0.16 * v)),
    feed:     (c, v) => ping(300, 'sine', c.currentTime, 0.12, 0.14 * v, 160),
    coo:      (c, v) => ping(440, 'sine', c.currentTime, 0.22, 0.08 * v, 560),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/effects/sfx.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/effects/sfx.ts src/effects/sfx.test.ts
git commit -m "feat(audio): synthesized SFX module with provider seam + sample hook"
```

---

## Task 5: `useAudio` facade

Stable callbacks that read `getState()` at call time (no store subscription → callers don't re-render on volume changes). A shared singleton `Sfx` instance is reused across calls.

**Files:**
- Create: `src/hooks/useAudio.ts`
- Test: `src/hooks/useAudio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useAudio.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setSfxProvider, type Sfx } from '../effects/sfx';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import { useAudio } from './useAudio';

afterEach(() => setSfxProvider(null));

describe('useAudio', () => {
  it('plays at the effective SFX gain (master * sfx)', () => {
    const play = vi.fn();
    setSfxProvider((): Sfx => ({ play, stop: vi.fn() }));
    const a = defaultAudioSettings();
    a.master.level = 0.5; a.sfx.level = 0.6;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('tap');
    expect(play).toHaveBeenCalledWith('tap', 0.3);
  });

  it('does not play when SFX channel is muted', () => {
    const play = vi.fn();
    setSfxProvider((): Sfx => ({ play, stop: vi.fn() }));
    const a = defaultAudioSettings(); a.sfx.muted = true;
    useGameStore.setState({ audio: a });

    const { result } = renderHook(() => useAudio());
    result.current.play('correct');
    // gain is 0 -> facade still forwards, but sfx.play no-ops on <=0.
    // We assert it forwarded 0 so the contract is explicit.
    expect(play).toHaveBeenCalledWith('correct', 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useAudio.test.ts`
Expected: FAIL — cannot find module `./useAudio`.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useAudio.ts
import { useMemo } from 'react';
import { getSfx, type Sfx, type SfxName } from '../effects/sfx';
import { effectiveGain } from '../audio/mixer';
import { useGameStore } from '../state/gameStore';

let shared: Sfx | null = null;
function sfx(): Sfx {
  shared = shared ?? getSfx();
  return shared;
}

/** Reset the shared SFX instance (tests that swap the provider mid-run). */
export function resetSharedSfx(): void {
  shared = null;
}

/**
 * Stable audio facade. Callbacks read the mixer from getState() at call time,
 * so consumers (e.g. every PressButton) do NOT re-render when volume changes.
 */
export function useAudio() {
  return useMemo(
    () => ({
      play(name: SfxName) {
        const { audio } = useGameStore.getState();
        sfx().play(name, effectiveGain('sfx', audio));
      },
    }),
    [],
  );
}
```

Note: the test swaps the provider, so add `resetSharedSfx()` to the test's `afterEach` and call it in a `beforeEach` after `setSfxProvider`. Update the test file:
```ts
import { resetSharedSfx } from './useAudio';
afterEach(() => { setSfxProvider(null); resetSharedSfx(); });
```
and call `resetSharedSfx()` right after each `setSfxProvider(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useAudio.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAudio.ts src/hooks/useAudio.test.ts
git commit -m "feat(audio): useAudio facade (getState-based, no subscription)"
```

---

## Task 6: Wire drill SFX (`useRoundFeedback`)

Add `correct`/`wrong` SFX alongside the existing confetti/haptic.

**Files:**
- Modify: `src/components/useRoundFeedback.ts`
- Modify: `src/components/useRoundFeedback.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/components/useRoundFeedback.test.ts` (mock the facade):

```ts
import { vi } from 'vitest';
const play = vi.fn();
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

// ...inside the existing describe:
it('plays the correct SFX on a correct round', () => {
  play.mockClear();
  const { result } = renderHook(() => useRoundFeedback());
  act(() => result.current.play('correct', () => {}));
  expect(play).toHaveBeenCalledWith('correct');
});

it('plays the wrong SFX on a wrong round', () => {
  play.mockClear();
  const { result } = renderHook(() => useRoundFeedback());
  act(() => result.current.play('wrong', () => {}));
  expect(play).toHaveBeenCalledWith('wrong');
});
```
(If the existing test file lacks `renderHook`/`act`, import them from `@testing-library/react`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: FAIL — `play` not called.

- [ ] **Step 3: Implement**

In `src/components/useRoundFeedback.ts`:
```ts
import { useAudio } from '../hooks/useAudio';
```
Inside `useRoundFeedback()`, add `const { play: playSfx } = useAudio();` near the top, then in `play()` after `setFeedback(kind);`:
```ts
    if (kind === 'wrong') { buzz(); playSfx('wrong'); }
    else { fireConfetti(); playSfx('correct'); }
```
(replace the existing `if (kind === 'wrong') buzz(); else fireConfetti();`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/useRoundFeedback.ts src/components/useRoundFeedback.test.ts
git commit -m "feat(audio): drill correct/wrong SFX via useRoundFeedback"
```

---

## Task 7: Wire UI tap SFX (`PressButton`, debounced)

Every shared button plays a low `tap`; debounced so rapid presses don't stack.

**Files:**
- Modify: `src/components/PressButton.tsx`
- Modify: `src/components/PressButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/PressButton.test.tsx`:
```ts
import { vi } from 'vitest';
const play = vi.fn();
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

it('plays a tap SFX and still calls the provided onClick', async () => {
  play.mockClear();
  const onClick = vi.fn();
  const { getByRole } = render(<PressButton onClick={onClick}>Go</PressButton>);
  await userEvent.click(getByRole('button'));
  expect(play).toHaveBeenCalledWith('tap');
  expect(onClick).toHaveBeenCalledTimes(1);
});
```
(Use whatever render/click helpers the existing test already imports.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/PressButton.test.tsx`
Expected: FAIL — `play` not called.

- [ ] **Step 3: Implement**

Replace `src/components/PressButton.tsx` body:
```tsx
import { useRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useAudio } from '../hooks/useAudio';

type PressButtonProps = HTMLMotionProps<'button'>;

/**
 * A button with a consistent press-squish that plays a debounced tap SFX.
 * Forwards all native button props; whileTap is suppressed when disabled.
 */
export function PressButton({ disabled, type = 'button', onClick, ...props }: PressButtonProps) {
  const { play } = useAudio();
  const last = useRef(0);

  const handleClick: PressButtonProps['onClick'] = (e) => {
    const now = e.timeStamp || 0;
    if (now - last.current > 60) { last.current = now; play('tap'); }
    onClick?.(e);
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={handleClick}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/PressButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PressButton.tsx src/components/PressButton.test.tsx
git commit -m "feat(audio): debounced tap SFX on PressButton"
```

---

## Task 8: Route evolution audio + repoint cinematic 🔊 to mute-all

Make `evolutionSound` respect the mixer (so mute-all silences it) and replace the now-deleted `soundEnabled`/`toggleSound` usage.

**Files:**
- Modify: `src/effects/evolutionSound.ts` (add a gain multiplier)
- Modify: `src/components/EvolutionCinematic.tsx`
- Modify: `src/components/EvolutionCinematic.test.tsx`

- [ ] **Step 1: Write/adjust the failing test**

In `src/components/EvolutionCinematic.test.tsx`, replace any `soundEnabled`/`toggleSound` store setup with the mixer. Add:
```ts
it('🔊 button toggles mute-all', async () => {
  useGameStore.setState({ audio: defaultAudioSettings() });
  // render the cinematic (existing helper)...
  await userEvent.click(getByLabelText(/mute|unmute/i));
  expect(useGameStore.getState().audio.allMuted).toBe(true);
});
```
Import `defaultAudioSettings` from `../audio/mixer`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/EvolutionCinematic.test.tsx`
Expected: FAIL (also compile error on old `soundEnabled`).

- [ ] **Step 3: Implement**

3a. `src/effects/evolutionSound.ts` — give the synth a master gain. Change `createWebAudioSound()` to read a module-level `gain` and scale each `peak`:
```ts
let gainMul = 1;
export function setEvolutionGain(g: number): void { gainMul = Math.max(0, Math.min(1, g)); }
```
In `ping`, multiply `peak` by `gainMul`; in `flash`, multiply the `0.22` initial gain by `gainMul`. (The `silent` provider and jsdom path are unaffected.)

3b. `src/components/EvolutionCinematic.tsx`:
- Replace imports/usage of `soundEnabled`/`toggleSound`:
```ts
import { useGameStore } from '../state/gameStore';
import { effectiveGain } from '../audio/mixer';
import { getEvolutionSound, setEvolutionGain } from '../effects/evolutionSound';
```
- Replace the two selectors:
```ts
  const audio = useGameStore((s) => s.audio);
  const toggleMuteAll = useGameStore((s) => s.toggleMuteAll);
  const reduced = !!useReducedMotion();
  const sfxGain = effectiveGain('sfx', audio);
  const allow = sfxGain > 0 && !reduced; // keep the reduced-motion gate for the cinematic itself
```
- Before cueing audio in the phase effect, push the gain: add `setEvolutionGain(sfxGain);` at the top of the phase `useEffect` (before the `if (!allow)` check). Keep `soundAllowed` import removed.
- Replace the 🔊 button: `aria-label={audio.allMuted ? 'Unmute sound' : 'Mute sound'}`, `onClick={(e) => { e.stopPropagation(); toggleMuteAll(); }}`, glyph `{audio.allMuted ? '🔇' : '🔊'}`.

- [ ] **Step 4: Run to verify it passes + full typecheck**

Run: `npx vitest run src/components/EvolutionCinematic.test.tsx && npx tsc -b`
Expected: PASS and a clean typecheck (no more `soundEnabled` references anywhere).

- [ ] **Step 5: Commit**

```bash
git add src/effects/evolutionSound.ts src/components/EvolutionCinematic.tsx src/components/EvolutionCinematic.test.tsx
git commit -m "feat(audio): route evolution audio through mixer; 🔊 toggles mute-all"
```

---

## Task 9: Voice channel — gate TTS

Apply the voice-channel gain to Web Speech; skip when 0.

**Files:**
- Modify: `src/config/audio.ts` (`speak` takes an optional volume)
- Modify: `src/hooks/useSpeech.ts` (compute voice gain at call time)
- Modify: `src/config/audio.ts` test if one exists; else add `src/hooks/useSpeech.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useSpeech.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';

const speak = vi.fn();
vi.mock('../config/audio', () => ({ getSpeechProvider: () => ({ speak }) }));

import { useSpeech } from './useSpeech';

afterEach(() => speak.mockClear());

describe('useSpeech voice gating', () => {
  it('passes the effective voice volume', () => {
    const a = defaultAudioSettings(); a.master.level = 0.5; a.voice.level = 0.8;
    useGameStore.setState({ audio: a });
    renderHook(() => useSpeech()).result.current.speakWord('cat');
    expect(speak).toHaveBeenCalledWith('cat', 'en-US', 0.4);
  });

  it('does not speak when voice is muted', () => {
    const a = defaultAudioSettings(); a.voice.muted = true;
    useGameStore.setState({ audio: a });
    renderHook(() => useSpeech()).result.current.speakThai('แมว');
    expect(speak).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useSpeech.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. `src/config/audio.ts` — extend the interface + impl:
```ts
export interface SpeechProvider {
  speak(text: string, lang: string, volume?: number): void;
}
export const noopSpeech: SpeechProvider = { speak: () => {} };
function webSpeech(): SpeechProvider {
  return {
    speak(text, lang, volume = 1) {
      const synth = globalThis.speechSynthesis!;
      const Utter = globalThis.SpeechSynthesisUtterance!;
      const utter = new Utter(text);
      utter.lang = lang;
      utter.volume = volume;
      synth.cancel();
      synth.speak(utter);
    },
  };
}
```
(getSpeechProvider unchanged.)

3b. `src/hooks/useSpeech.ts` — compute voice gain at call time and skip on 0:
```ts
import { getSpeechProvider } from '../config/audio';
import { effectiveGain } from '../audio/mixer';
import { useGameStore } from '../state/gameStore';

export const EN = 'en-US';
export const TH = 'th-TH';

export function useSpeech() {
  return useMemo(() => {
    const p = getSpeechProvider();
    const say = (text: string, lang: string) => {
      const g = effectiveGain('voice', useGameStore.getState().audio);
      if (g <= 0) return;
      p.speak(text, lang, g);
    };
    return {
      speakWord: (w: string) => say(w, EN),
      speakThai: (t: string) => say(t, TH),
      speakSentence: (s: string) => say(s, EN),
    };
  }, []);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/hooks/useSpeech.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/audio.ts src/hooks/useSpeech.ts src/hooks/useSpeech.test.ts
git commit -m "feat(audio): gate TTS through the voice channel"
```

---

## Task 10: Wire economy SFX (gacha / shop / feed / reward / drop / coo)

Add `useAudio().play(name)` at each economy view-layer chokepoint. **Read each file first**, then add the import `import { useAudio } from '../hooks/useAudio';`, destructure `const { play } = useAudio();` in the component, and call `play(name)` inside the relevant handler.

**Files & exact insertion points:**
- `src/components/Gacha.tsx` — in the Pull `onClick` after the pull action: `play('pull')`; when the reveal renders/triggers: `play('reveal')`. (The cinematic already cues its own reveal audio; if Gacha shows the cinematic, only add `play('pull')` here to avoid double sound.)
- `src/components/TreatCard.tsx` and `src/components/DecorCard.tsx` — in the buy `onClick` after a successful purchase: `play('purchase')`.
- `src/components/PetRoom.tsx` — in the feed handler after `feedBar`/feed action: `play('feed')`; the word-tile drop handler in the drill (find via the `@dnd-kit` drop in `DrillScreen.tsx`): `play('drop')`.
- Reward path — in `src/components/RewardScreen.tsx` where stars/coins animate in: `play('coin')`.
- Egg idle coo — in the egg screen (`EggHatch.tsx`) on an interval while idle: `play('coo')` every ~6–10s; clear the interval on unmount.

- [ ] **Step 1: Write the failing tests**

For each component above that has a test, mock the facade once at the top:
```ts
const play = vi.fn();
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));
```
and assert the right name fires on the action, e.g. in `DecorCard.test.tsx`:
```ts
it('plays purchase SFX on buy', async () => {
  play.mockClear();
  // render an affordable DecorCard and click buy (existing helper)...
  await userEvent.click(getByRole('button', { name: /buy/i }));
  expect(play).toHaveBeenCalledWith('purchase');
});
```
Write one such test per wired component that already has a test file. For components without a test file, skip the test and rely on the typecheck + manual verification (note this in the commit).

- [ ] **Step 2: Run to verify failing**

Run: `npx vitest run src/components/DecorCard.test.tsx src/components/Gacha.test.tsx src/components/DrillScreen.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement the wiring** in each file per the insertion points above.

- [ ] **Step 4: Run the suite for the touched files**

Run: `npx vitest run src/components`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Gacha.tsx src/components/TreatCard.tsx src/components/DecorCard.tsx src/components/PetRoom.tsx src/components/RewardScreen.tsx src/components/EggHatch.tsx src/components/DrillScreen.tsx src/components/*.test.tsx
git commit -m "feat(audio): economy + feed + drop + coo SFX wiring"
```

---

## Task 11: Settings sheet (the mixer UI)

A mobile-first bottom sheet: Mute-all button + four channel rows (Master/SFX/Music/Voice), each a range slider + mute toggle. (Music slider exists now but only affects Phase 2 audio — that's fine.)

**Files:**
- Create: `src/components/SettingsSheet.tsx`
- Test: `src/components/SettingsSheet.test.tsx`
- Modify: a header host component to add a gear button that opens it (find the screen header; if none is shared, mount the gear in `PetRoom.tsx`'s top bar and pass open state locally).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SettingsSheet.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameStore } from '../state/gameStore';
import { defaultAudioSettings } from '../audio/mixer';
import { SettingsSheet } from './SettingsSheet';

beforeEach(() => useGameStore.setState({ audio: defaultAudioSettings() }));

describe('SettingsSheet', () => {
  it('renders the four channel sliders', () => {
    render(<SettingsSheet onClose={() => {}} />);
    expect(screen.getByLabelText(/master volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sfx volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/music volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice volume/i)).toBeInTheDocument();
  });

  it('moving the SFX slider updates the store', () => {
    render(<SettingsSheet onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/sfx volume/i), { target: { value: '0.5' } });
    expect(useGameStore.getState().audio.sfx.level).toBeCloseTo(0.5);
  });

  it('mute-all toggles the store flag', async () => {
    render(<SettingsSheet onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /mute all/i }));
    expect(useGameStore.getState().audio.allMuted).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/SettingsSheet.test.tsx`
Expected: FAIL — cannot find `./SettingsSheet`.

- [ ] **Step 3: Implement**

```tsx
// src/components/SettingsSheet.tsx
import { useGameStore } from '../state/gameStore';
import type { ChannelName } from '../audio/mixer';
import { PressButton } from './PressButton';

const CHANNELS: { key: 'master' | ChannelName; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'SFX' },
  { key: 'music', label: 'Music' },
  { key: 'voice', label: 'Voice' },
];

/** Bottom-sheet audio mixer: mute-all + per-channel slider & mute. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const audio = useGameStore((s) => s.audio);
  const setChannelLevel = useGameStore((s) => s.setChannelLevel);
  const toggleChannelMute = useGameStore((s) => s.toggleChannelMute);
  const toggleMuteAll = useGameStore((s) => s.toggleMuteAll);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Audio settings"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sound</h2>
          <PressButton
            onClick={toggleMuteAll}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${audio.allMuted ? 'bg-red-500 text-white' : 'bg-slate-200'}`}
          >
            {audio.allMuted ? 'Muted — Unmute all' : 'Mute all'}
          </PressButton>
        </div>

        <ul className="space-y-4">
          {CHANNELS.map(({ key, label }) => {
            const ch = audio[key];
            const id = `vol-${key}`;
            return (
              <li key={key} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`${label} ${ch.muted ? 'unmute' : 'mute'}`}
                  onClick={() => toggleChannelMute(key)}
                  className="w-8 text-xl"
                >
                  {ch.muted ? '🔇' : '🔊'}
                </button>
                <label htmlFor={id} className="w-16 text-sm font-medium">{label}</label>
                <input
                  id={id}
                  aria-label={`${label} volume`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ch.level}
                  disabled={audio.allMuted || (key !== 'master' && audio.master.muted)}
                  onChange={(e) => setChannelLevel(key, Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
              </li>
            );
          })}
        </ul>

        <PressButton onClick={onClose} className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white">
          Done
        </PressButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/SettingsSheet.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount a gear entry point**

Find the shared screen header. Add a gear button (`PressButton` with `aria-label="Sound settings"`) that sets local `const [open, setOpen] = useState(false)` and renders `{open && <SettingsSheet onClose={() => setOpen(false)} />}`. If there is no shared header, mount it in `PetRoom.tsx`'s top bar. Verify with `npx tsc -b`.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsSheet.tsx src/components/SettingsSheet.test.tsx src/components/PetRoom.tsx
git commit -m "feat(audio): settings sheet mixer + gear entry point"
```

---

## Task 12: Full verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: green; total ≥ the ~470 baseline plus the new tests; 13 skipped unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean. No remaining `soundEnabled`/`toggleSound` references.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: green.

- [ ] **Step 4: Manual smoke (dev server on http://localhost:5175/)**

Verify: button taps click; correct/wrong drill SFX; gacha pull; a purchase; feed; open Settings → sliders move audibly, mute-all silences everything incl. the evolution cinematic; reload page → mixer settings persisted.

- [ ] **Step 5: Commit any fixups, then open the PR**

```bash
git push -u origin feat-game-audio
gh pr create --title "feat(audio): Phase 1 — global SFX + volume mixer" --body "$(cat <<'EOF'
## Summary
Phase 1 of game-wide audio: a synthesized SFX layer behind an evolutionSound-style seam, a four-channel mixer (Master/SFX/Music/Voice) with mute + mute-all, and a Settings sheet. Replaces the binary `soundEnabled` with a persisted `audio` slice (PERSIST_VERSION 10→11). Music (zones/stingers) is Phase 2.

Spec: `docs/superpowers/specs/2026-06-27-game-audio-design.md`
Plan: `docs/superpowers/plans/2026-06-27-game-audio-phase1.md`

## Test plan
- `npx vitest run` green; `npx tsc -b` clean; `npm run build` green.
- Manual: taps, drill correct/wrong, gacha, purchase, feed, Settings sliders/mute-all, persistence across reload.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- §3.1 mixer → Task 1. §3.2 sfx → Task 4. §3.4 useAudio → Task 5. §4 store/persistence/migration → Tasks 2–3. §5 SFX event rows → Tasks 6 (drill), 7 (tap), 10 (economy/drop/coo), 8 (evolution), 9 (voice/TTS). §6 settings surface → Task 11. §7 reduced-motion decoupling → new audio gates on gain only (Tasks 5/9); cinematic keeps its motion gate (Task 8, per spec). §8 testing → tests in every task + Task 12. §3.3 music/zones/stingers → **deliberately excluded (Phase 2)**.
- `registerSample` hybrid hook (§2) → built in Task 4, used in Phase 2.

**Placeholder scan:** No "TBD"/"add error handling" placeholders. Task 10's per-component insertion points name exact files/handlers; the only soft instruction ("read the file first") is inherent to wiring view-layer call-sites and each shows the exact code to add. Task 3 and Task 11 Step 5 name explicit fallbacks rather than leaving gaps.

**Type consistency:** `AudioSettings`/`Channel`/`ChannelName`/`effectiveGain`/`defaultAudioSettings`/`clampLevel` (Task 1) used identically in Tasks 2, 5, 8, 9, 11. `Sfx`/`SfxName`/`getSfx`/`setSfxProvider`/`registerSample` (Task 4) used identically in Task 5. Store actions `setChannelLevel`/`toggleChannelMute`/`toggleMuteAll` (Task 2) used identically in Task 11. `play(name)` facade signature (Task 5) used identically in Tasks 6, 7, 10. `setEvolutionGain` (Task 8) defined and used in the same task.
