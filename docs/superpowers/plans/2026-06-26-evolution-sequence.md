# Evolution Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated, skippable, Pokémon-style full-screen evolution scene with synthesized audio, played for all three stage-ups (egg→baby hatch, baby→young at L16, young→adult at L36).

**Architecture:** Stage is derived from XP, so we detect *crossings* in `applyXp` and stash a transient `lastStageChange`. `hatch()` and `RewardScreen` route to a new `evolution` screen. `EvolutionScreen` drives a pure phase-timeline hook (`useEvolutionSequence`), resolves old/new sprites via a shared `spriteSrc`, and fires phase-aligned cues from a provider-swappable synthesized-audio module gated by a persisted `soundEnabled` toggle and reduced motion.

**Tech Stack:** React 19 + TS, Tailwind v4, framer-motion 12, Zustand (+persist), Web Audio API, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-26-evolution-sequence-design.md`

**Conventions:** typecheck `npx tsc -b`; tests `npx vitest run <path>`; build `npm run build`. framer-motion renders statically in jsdom (some tests mock it via a passthrough proxy — see `src/App.test.tsx`). `useRoundFeedback`/`useSpeech` mock patterns exist. End commits with the `Co-Authored-By: Claude Opus 4.8` trailer. Branch is `evolution-sequence` (stacked on `drill-submit-intro`) — do NOT switch branches.

---

## Task 1: Stage helpers + types

**Files:**
- Modify: `src/domain/xp.ts`
- Modify: `src/data/types.ts:24` (Screen union) and add `StageChange`
- Test: `src/domain/xp.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `src/domain/xp.test.ts`:

```ts
import { STAGE_ORDER, STAGE_NAME, stageUp } from './xp';

describe('stage helpers', () => {
  it('orders stages egg < baby < young < adult', () => {
    expect(STAGE_ORDER).toEqual(['egg', 'baby', 'young', 'adult']);
  });
  it('stageUp is true only for forward transitions', () => {
    expect(stageUp('egg', 'baby')).toBe(true);
    expect(stageUp('baby', 'young')).toBe(true);
    expect(stageUp('young', 'adult')).toBe(true);
    expect(stageUp('baby', 'adult')).toBe(true);
    expect(stageUp('baby', 'baby')).toBe(false);
    expect(stageUp('young', 'baby')).toBe(false);
  });
  it('names every stage', () => {
    expect(STAGE_NAME).toEqual({ egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/xp.test.ts`
Expected: FAIL — `STAGE_ORDER`/`STAGE_NAME`/`stageUp` are not exported.

- [ ] **Step 3: Implement**

In `src/data/types.ts`, change the Screen union (line 24) to include `'evolution'` and add the `StageChange` type just below `PetStage` (line 26):

```ts
export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution';

export type PetStage = 'egg' | 'baby' | 'young' | 'adult';

/** A forward stage transition, for the evolution celebration. */
export interface StageChange { from: PetStage; to: PetStage; }
```

In `src/domain/xp.ts`, add after the `STAGE_LEVEL` block (after line 9):

```ts
export const STAGE_ORDER: PetStage[] = ['egg', 'baby', 'young', 'adult'];

export const STAGE_NAME: Record<PetStage, string> = {
  egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult',
};

/** True when `to` is a later stage than `from`. */
export function stageUp(from: PetStage, to: PetStage): boolean {
  return STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/xp.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/xp.ts src/domain/xp.test.ts src/data/types.ts
git commit -m "feat(evolution): stage order/name/stageUp helpers + StageChange type + evolution screen enum

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Shared `spriteSrc` resolver

**Files:**
- Modify: `src/config/sprites.ts`
- Modify: `src/components/PetSprite.tsx:47`
- Test: `src/config/sprites.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/config/sprites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spriteSrc, SPRITES, EGG_SPRITE } from './sprites';

describe('spriteSrc', () => {
  it('returns the generic egg sprite for the egg stage', () => {
    expect(spriteSrc('leaf', 'egg', 'happy')).toBe(EGG_SPRITE);
  });
  it('returns the per-species/stage/mood sprite otherwise', () => {
    expect(spriteSrc('fire', 'young', 'sad')).toBe(SPRITES.fire.young.sad);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/sprites.test.ts`
Expected: FAIL — `spriteSrc` not exported.

- [ ] **Step 3: Implement**

In `src/config/sprites.ts`, after the `SPRITES` constant (after line 64), add:

```ts
/** Single source of truth for resolving a pet's artwork. Egg is generic. */
export function spriteSrc(species: Species, stage: PetStage, mood: PetMood): string {
  return stage === 'egg' ? EGG_SPRITE : SPRITES[species][stage][mood];
}
```

In `src/components/PetSprite.tsx`, replace lines 46-47:

```tsx
  const isEgg = stage === 'egg';
  const src = isEgg ? EGG_SPRITE : SPRITES[species][stage][mood];
```

with:

```tsx
  const isEgg = stage === 'egg';
  const src = spriteSrc(species, stage, mood);
```

and update the import on line 5 from `import { SPRITES, EGG_SPRITE } from '../config/sprites';` to `import { spriteSrc } from '../config/sprites';` (the `SPRITES`/`EGG_SPRITE` names are no longer referenced in this file — verify with the typecheck).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/sprites.test.ts src/components/PetSprite.test.tsx`
Expected: PASS (new test + existing PetSprite tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean (no unused-import errors).

- [ ] **Step 6: Commit**

```bash
git add src/config/sprites.ts src/config/sprites.test.ts src/components/PetSprite.tsx
git commit -m "refactor(sprites): extract shared spriteSrc resolver, use it in PetSprite

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Stage-change detection in the store

**Files:**
- Modify: `src/state/gameStore.ts` (`applyXp`, `GameState`, `freshState`, `finishRound`, `hatch`, `addXpForTest`, `clearStageChange`, `partialize`)
- Test: `src/state/gameStore.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameStore.test.ts` (it already imports `useGameStore`; add `totalXpForLevel` import from `../domain/xp` if not present):

```ts
import { totalXpForLevel } from '../domain/xp';

describe('stage-change detection', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  function hatchStarter() {
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true, xp: 0 })) }));
  }

  it('sets lastStageChange when XP crosses into the young stage (L16)', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(16));
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'young' });
  });

  it('reports the spanned stages for a multi-stage jump', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(36));
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'adult' });
  });

  it('leaves lastStageChange null when the level gain stays in the same stage', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(5));
    expect(useGameStore.getState().lastStageChange).toBeNull();
  });

  it('hatch() sets an egg→baby stage change and routes to the evolution screen', () => {
    useGameStore.getState().hatch();
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'egg', to: 'baby' });
    expect(useGameStore.getState().screen).toBe('evolution');
  });

  it('clearStageChange resets it to null', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().clearStageChange();
    expect(useGameStore.getState().lastStageChange).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: FAIL — `lastStageChange`/`clearStageChange` don't exist; `hatch` still routes to `petRoom`.

- [ ] **Step 3: Implement**

In `src/state/gameStore.ts`:

a) Add `stageUp` to the xp import (line 8):

```ts
import { levelForXp, stageForXp, stageUp, xpPerCorrect } from '../domain/xp';
```

and add `StageChange` to the types import (line 5):

```ts
import type { BattleStats, DrillType, FoodGroup, NutritionBars, PetInstance, PetStage, Screen, StageChange } from '../data/types';
```

b) In the `GameState` interface, add the state field next to `lastLevelUp` (line 54) and the action next to `clearLevelUp` (line 69):

```ts
  lastStageChange: StageChange | null;
```
```ts
  clearStageChange: () => void;
```

c) Change `applyXp` (lines 116-129) to also compute and return `stageChange`:

```ts
function applyXp(pet: PetInstance, xpGain: number, rng: () => number): { pet: PetInstance; levelUp: { toLevel: number; gained: (keyof BattleStats)[] } | null; stageChange: StageChange | null } {
  const before = levelForXp(pet.xp);
  const beforeStage = stageForXp(pet.xp, pet.hatched);
  const xp = pet.xp + xpGain;
  const after = levelForXp(xp);
  const afterStage = stageForXp(xp, pet.hatched);
  const stageChange = stageUp(beforeStage, afterStage) ? { from: beforeStage, to: afterStage } : null;
  if (after <= before) return { pet: { ...pet, xp }, levelUp: null, stageChange };
  const gained: (keyof BattleStats)[] = [];
  let growth = pet.growth;
  for (let l = before; l < after; l++) {
    const next = allocateStatPoints(growth, 1, rng);
    (Object.keys(next) as (keyof BattleStats)[]).forEach((k) => { if (next[k] !== growth[k]) gained.push(k); });
    growth = next;
  }
  return { pet: { ...pet, xp, growth }, levelUp: { toLevel: after, gained }, stageChange };
}
```

d) Add `lastStageChange: null` to `freshState()` (after the `lastLevelUp` line, line 152):

```ts
    lastStageChange: null as StageChange | null,
```

e) In `finishRound` (lines 178-211), capture the stage change. Add a `let stageChange` next to `let levelUp` (line 187), assign it inside `updateActive`, and add it to the returned object (next to `lastLevelUp: levelUp`, line 206):

```ts
          let levelUp: GameState['lastLevelUp'] = null;
          let stageChange: StageChange | null = null;
          const pets = updateActive(s, (p) => {
            const happiness =
              decayHappiness(p.happiness) +
              GAME_CONFIG.happiness.onClear +
              (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
            const withXp = applyXp(p, xpGain, rng);
            levelUp = withXp.levelUp;
            stageChange = withXp.stageChange;
            return {
              ...withXp.pet,
              happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
              bars: decayBars(p.bars),
            };
          });
```
and in the returned object:
```ts
            lastLevelUp: levelUp,
            lastStageChange: stageChange,
```

f) Change `hatch` (lines 165-166) to set the stage change and route to evolution:

```ts
      hatch: () =>
        set((s) => ({
          pets: updateActive(s, (p) => ({ ...p, hatched: true })),
          lastStageChange: { from: 'egg', to: 'baby' },
          screen: 'evolution',
        })),
```

g) In `addXpForTest` (lines 265-274), surface the stage change too:

```ts
      addXpForTest: (xp) =>
        set((s) => {
          let levelUp: GameState['lastLevelUp'] = null;
          let stageChange: StageChange | null = null;
          const pets = updateActive(s, (p) => {
            const r = applyXp(p, xp, rng);
            levelUp = r.levelUp;
            stageChange = r.stageChange;
            return r.pet;
          });
          return { pets, lastLevelUp: levelUp, lastStageChange: stageChange };
        }),
```

h) Add the `clearStageChange` action implementation next to `clearLevelUp` (search for `clearLevelUp:` in the actions object and add beside it):

```ts
      clearStageChange: () => set({ lastStageChange: null }),
```

i) In `partialize` (lines 281-286), also drop `lastStageChange` (transient):

```ts
      partialize: (s) => {
        const { lastLevelUp, lastStageChange, currentLessonId, ...rest } = s;
        void lastLevelUp; // transient — not persisted
        void lastStageChange; // transient — not persisted
        void currentLessonId; // transient — not persisted
        return rest as Omit<GameState, 'lastLevelUp' | 'lastStageChange' | 'currentLessonId'>;
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: PASS (new detection tests + existing store tests).

- [ ] **Step 5: Update the persisted-keys guard test**

`src/state/gameStore.persisted.test.ts` filters persisted keys by excluding the transient fields. Update line 29 so it also excludes `lastStageChange`:

```ts
      .filter((k) => k !== 'lastLevelUp' && k !== 'lastStageChange' && k !== 'currentLessonId')
```

(The explicit key-list test at lines 8-13 is unaffected — `lastStageChange` is not in `selectPersisted`'s output. `PERSIST_VERSION` is still 9 until Task 4.)

- [ ] **Step 6: Run the persisted test**

Run: `npx vitest run src/state/gameStore.persisted.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts
git commit -m "feat(evolution): detect stage crossings, route hatch + finishRound to evolution screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Persisted sound toggle

**Files:**
- Modify: `src/state/gameStore.ts` (`GameState`, `freshState`, `PERSIST_VERSION`, `PersistedState`, `selectPersisted`, `toggleSound`, migrate)
- Test: `src/state/gameStore.test.ts` and `src/state/gameStore.persisted.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameStore.test.ts`:

```ts
describe('sound toggle', () => {
  beforeEach(() => useGameStore.getState().resetForTest());
  it('defaults soundEnabled to true and toggles it', () => {
    expect(useGameStore.getState().soundEnabled).toBe(true);
    useGameStore.getState().toggleSound();
    expect(useGameStore.getState().soundEnabled).toBe(false);
    useGameStore.getState().toggleSound();
    expect(useGameStore.getState().soundEnabled).toBe(true);
  });
});
```

Update `src/state/gameStore.persisted.test.ts`: add `'soundEnabled'` to the expected key list (lines 9-12) and change the version assertion (line 20) to `10`:

```ts
    expect(keys).toEqual(
      [
        'activeBackground', 'activePetId', 'coins', 'inventory', 'journey',
        'lastPull', 'lastReward', 'owned', 'pets', 'screen', 'selectedDrill', 'selectedLevel', 'soundEnabled',
      ].sort(),
    );
```
```ts
    expect(PERSIST_VERSION).toBe(10);
```

And assert `selectPersisted` carries the new field — extend the existing `selectPersisted` describe block with one test (reuse the file's existing `describe`/`it`/`expect`/`selectPersisted` imports):

```ts
  it('includes soundEnabled, defaulting to true', () => {
    expect(selectPersisted(useGameStore.getState())).toHaveProperty('soundEnabled', true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts`
Expected: FAIL — `soundEnabled`/`toggleSound` missing; version is 9; `selectPersisted` lacks `soundEnabled`.

- [ ] **Step 3: Implement**

In `src/state/gameStore.ts`:

a) Add to `GameState` (next to `lastLevelUp`, line 54) the field, and the action next to `clearLevelUp`:

```ts
  soundEnabled: boolean;
```
```ts
  toggleSound: () => void;
```

b) Bump the version (line 79):

```ts
export const PERSIST_VERSION = 10;
```

c) Add `'soundEnabled'` to the `PersistedState` Pick (lines 82-86):

```ts
export type PersistedState = Pick<
  GameState,
  | 'screen' | 'pets' | 'activePetId' | 'coins' | 'inventory' | 'selectedDrill'
  | 'selectedLevel' | 'lastReward' | 'lastPull' | 'owned' | 'activeBackground' | 'journey' | 'soundEnabled'
>;
```

d) Add `soundEnabled` to `selectPersisted` (after `journey: s.journey,` near line 100-102, before the closing brace) — find the return object and add:

```ts
    soundEnabled: s.soundEnabled,
```

e) Add `soundEnabled: true` to `freshState()` (after `lastStageChange`):

```ts
    soundEnabled: true,
```

f) Add the action implementation next to `clearStageChange` (in the actions object):

```ts
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
```

g) In `migrate` (lines 313-321), backfill `soundEnabled` in the `base` normalization. Change the `base` object to include it:

```ts
        const base = {
          selectedDrill: 'pattern' as DrillType,
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          owned: st.owned ?? [],
          activeBackground: st.activeBackground ?? null,
          journey: { lessonStars: (st as { journey?: { lessonStars?: Record<string, number> } }).journey?.lessonStars ?? {} },
          soundEnabled: (st as { soundEnabled?: boolean }).soundEnabled ?? true,
        };
```

And update the migration-history comment block above `migrate` (after line 291) with one line:

```ts
        // v9->v10 backfills soundEnabled (default true).
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts src/state/gameStore.persisted.test.ts
git commit -m "feat(evolution): persisted soundEnabled toggle (PERSIST_VERSION 10 + migration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Synthesized evolution audio module

**Files:**
- Create: `src/effects/evolutionSound.ts`
- Test: `src/effects/evolutionSound.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/effects/evolutionSound.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  soundAllowed, getEvolutionSound, setEvolutionSoundProvider, type EvolutionSound,
} from './evolutionSound';

describe('soundAllowed', () => {
  it('is true only when enabled and not reduced', () => {
    expect(soundAllowed(true, false)).toBe(true);
    expect(soundAllowed(false, false)).toBe(false);
    expect(soundAllowed(true, true)).toBe(false);
    expect(soundAllowed(false, true)).toBe(false);
  });
});

describe('getEvolutionSound', () => {
  afterEach(() => setEvolutionSoundProvider(null));

  it('returns a sound with all cues that never throw (silent in jsdom — no AudioContext)', () => {
    const s = getEvolutionSound();
    expect(() => { s.strobe(); s.flash(); s.reveal(); s.stop(); }).not.toThrow();
  });

  it('honors a swapped provider', () => {
    const calls: string[] = [];
    const fake: EvolutionSound = {
      strobe: () => calls.push('strobe'),
      flash: () => calls.push('flash'),
      reveal: () => calls.push('reveal'),
      stop: () => calls.push('stop'),
    };
    setEvolutionSoundProvider(() => fake);
    const s = getEvolutionSound();
    s.reveal();
    expect(calls).toEqual(['reveal']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/effects/evolutionSound.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/effects/evolutionSound.ts`:

```ts
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

const silent: EvolutionSound = { strobe() {}, flash() {}, reveal() {}, stop() {} };

function audioContextCtor(): (new () => AudioContext) | null {
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
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
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  return {
    strobe() {
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
      g.gain.setValueAtTime(0.22, c.currentTime);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/effects/evolutionSound.test.ts`
Expected: PASS (jsdom has no `AudioContext`, so `createWebAudioSound` returns `silent` and cues are no-ops).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/effects/evolutionSound.ts src/effects/evolutionSound.test.ts
git commit -m "feat(evolution): synthesized Web Audio sound module + provider seam

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `useEvolutionSequence` timeline hook

**Files:**
- Create: `src/hooks/useEvolutionSequence.ts`
- Test: `src/hooks/useEvolutionSequence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useEvolutionSequence.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEvolutionSequence, TIMINGS } from './useEvolutionSequence';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useEvolutionSequence', () => {
  it('advances announce -> silhouette -> strobe -> flash -> reveal -> done', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: false }));
    expect(result.current.phase).toBe('announce');
    act(() => { vi.advanceTimersByTime(TIMINGS.announce); });
    expect(result.current.phase).toBe('silhouette');
    act(() => { vi.advanceTimersByTime(TIMINGS.silhouette); });
    expect(result.current.phase).toBe('strobe');
    act(() => { vi.advanceTimersByTime(TIMINGS.strobe + TIMINGS.strobeStart); });
    expect(result.current.phase).toBe('flash');
    act(() => { vi.advanceTimersByTime(TIMINGS.flash); });
    expect(result.current.phase).toBe('reveal');
    act(() => { vi.advanceTimersByTime(TIMINGS.reveal); });
    expect(result.current.phase).toBe('done');
  });

  it('reduced motion goes announce -> reveal -> done with no strobe/flash', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: true }));
    expect(result.current.phase).toBe('announce');
    act(() => { vi.advanceTimersByTime(TIMINGS.announce); });
    expect(result.current.phase).toBe('reveal');
    act(() => { vi.advanceTimersByTime(TIMINGS.reveal); });
    expect(result.current.phase).toBe('done');
  });

  it('skip() jumps straight to reveal', () => {
    const { result } = renderHook(() => useEvolutionSequence({ reduced: false }));
    act(() => { result.current.skip(); });
    expect(result.current.phase).toBe('reveal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useEvolutionSequence.test.ts`
Expected: FAIL — hook does not exist.

- [ ] **Step 3: Implement**

Create `src/hooks/useEvolutionSequence.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export type EvoPhase = 'announce' | 'silhouette' | 'strobe' | 'flash' | 'reveal' | 'done';

export const TIMINGS = {
  announce: 900,
  silhouette: 350,
  strobe: 1900,
  strobeStart: 260,
  strobeMin: 70,
  strobeStep: 22,
  flash: 650,
  reveal: 760,
} as const;

/** Drives the evolution phase timeline. Pure of store/DOM beyond timers. */
export function useEvolutionSequence({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState<EvoPhase>('announce');
  const [swap, setSwap] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipped = useRef(false);

  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const toReveal = () => {
    setPhase('reveal');
    at(TIMINGS.reveal, () => setPhase('done'));
  };

  const skip = () => {
    if (skipped.current) return;
    skipped.current = true;
    clearTimers();
    toReveal();
  };

  useEffect(() => {
    if (reduced) {
      at(TIMINGS.announce, toReveal);
      return clearTimers;
    }
    at(TIMINGS.announce, () => {
      setPhase('silhouette');
      at(TIMINGS.silhouette, () => {
        setPhase('strobe');
        let delay = TIMINGS.strobeStart;
        let elapsed = 0;
        const tick = () => {
          if (skipped.current) return;
          setSwap((v) => !v);
          elapsed += delay;
          delay = Math.max(TIMINGS.strobeMin, delay - TIMINGS.strobeStep);
          if (elapsed < TIMINGS.strobe) {
            timers.current.push(setTimeout(tick, delay));
          } else {
            setPhase('flash');
            at(TIMINGS.flash, toReveal);
          }
        };
        tick();
      });
    });
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return { phase, swap, skip };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useEvolutionSequence.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEvolutionSequence.ts src/hooks/useEvolutionSequence.test.ts
git commit -m "feat(evolution): useEvolutionSequence phase-timeline hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: EvolutionScreen + routing + CSS

**Files:**
- Create: `src/components/EvolutionScreen.tsx`
- Test: `src/components/EvolutionScreen.test.tsx`
- Modify: `src/index.css` (silhouette/flash styles)
- Modify: `src/App.tsx` (`screenKeyAndNode` route + import)
- Modify: `src/components/RewardScreen.tsx` (Continue routing)

- [ ] **Step 1: Write the failing tests**

Create `src/components/EvolutionScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// Real framer-motion renders fine in jsdom; matchMedia is polyfilled in src/test/setup.ts
// so useReducedMotion() returns false (reduced motion off). Only the sound module is mocked.
const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import { EvolutionScreen } from './EvolutionScreen';
import { useGameStore } from '../state/gameStore';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionScreen', () => {
  it('redirects to petRoom when there is no stage change', () => {
    useGameStore.setState({ lastStageChange: null, screen: 'evolution' });
    render(<EvolutionScreen />);
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('on skip shows the new stage banner and Continue routes to petRoom + clears the change', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, screen: 'evolution' });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // tap to skip
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().lastStageChange).toBeNull();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('plays the reveal cue when sound is on, not when off', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: true });
    const { unmount } = render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // skip -> reveal
    expect(sound.reveal).toHaveBeenCalled();
    unmount();

    Object.values(sound).forEach((f) => f.mockClear());
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: false });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).not.toHaveBeenCalled();
  });

  it('renders a sound toggle that flips soundEnabled', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: true });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(useGameStore.getState().soundEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/EvolutionScreen.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { spriteSrc } from '../config/sprites';
import { STAGE_NAME } from '../domain/xp';
import { useEvolutionSequence } from '../hooks/useEvolutionSequence';
import { getEvolutionSound, soundAllowed } from '../effects/evolutionSound';
import { fireConfetti, buzz } from '../effects/celebrate';
import { PressButton } from './PressButton';

export function EvolutionScreen() {
  const change = useGameStore((s) => s.lastStageChange);
  const pet = useGameStore(selectActivePet);
  const clearStageChange = useGameStore((s) => s.clearStageChange);
  const setScreen = useGameStore((s) => s.setScreen);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const reduced = !!useReducedMotion();
  const { phase, swap, skip } = useEvolutionSequence({ reduced });
  const sound = useRef(getEvolutionSound());
  const celebrated = useRef(false);

  // No stage change to show (e.g. reload while on this screen) -> leave.
  useEffect(() => {
    if (!change) setScreen('petRoom');
  }, [change, setScreen]);

  const allow = soundAllowed(soundEnabled, reduced);

  // Phase-aligned audio cues.
  useEffect(() => {
    if (!change || !allow) return;
    const s = sound.current;
    if (phase === 'strobe') s.strobe();
    else if (phase === 'flash') s.flash();
    else if (phase === 'reveal') s.reveal();
  }, [phase, allow, change]);

  // Confetti + haptic once on reveal.
  useEffect(() => {
    if (phase === 'reveal' && !celebrated.current) {
      celebrated.current = true;
      fireConfetti();
      buzz();
    }
  }, [phase]);

  // Stop audio on unmount.
  useEffect(() => {
    const s = sound.current;
    return () => s.stop();
  }, []);

  if (!change) return null;

  const revealed = phase === 'reveal' || phase === 'done';
  const showNew = revealed || (phase === 'strobe' && swap);
  const isSil = phase === 'silhouette' || phase === 'strobe';
  const src = spriteSrc(pet.species, showNew ? change.to : change.from, 'happy');

  const finish = () => {
    sound.current.stop();
    clearStageChange();
    setScreen('petRoom');
  };

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#1d2746_0%,#0a0f1f_70%)] p-6"
      onClick={revealed ? undefined : skip}
    >
      <button
        type="button"
        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        onClick={(e) => { e.stopPropagation(); toggleSound(); }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      {phase === 'announce' && (
        <p className="absolute top-20 text-lg font-semibold text-white/90">What? Your pet is evolving!</p>
      )}

      <motion.img
        data-testid="evolution-stage"
        src={src}
        alt={`pet-${pet.species}-${showNew ? change.to : change.from}`}
        draggable={false}
        className={`h-[clamp(7rem,30vh,13rem)] w-auto object-contain ${isSil ? 'evo-silhouette' : ''}`}
        animate={revealed ? { scale: [0.2, 1.35, 0.9, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: revealed ? 0.76 : 0.2 }}
      />

      {phase === 'flash' && <div className="evo-flash pointer-events-none absolute inset-0 bg-white" />}

      {revealed && (
        <>
          <p className="absolute bottom-28 text-xl font-extrabold text-white">
            Evolved to <span className="text-emerald-300">{STAGE_NAME[change.to]}</span>! ✨
          </p>
          <PressButton
            onClick={finish}
            className="absolute bottom-10 min-h-12 rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-white shadow"
          >
            Continue
          </PressButton>
        </>
      )}
    </div>
  );
}
```

(`PressButton` forwards `HTMLMotionProps<'button'>`, so `onClick={finish}` type-checks. The container's `onClick` is `undefined` once `revealed`, so no propagation conflict.)

- [ ] **Step 4: Add the CSS**

In `src/index.css`, next to the existing `flash-correct`/`pop-check` keyframes (around lines 16-53), add:

```css
.evo-silhouette {
  filter: brightness(0) invert(1) drop-shadow(0 0 18px rgba(255, 255, 255, 0.9));
}
.evo-flash {
  animation: evo-flash 0.65s ease-out;
}
@keyframes evo-flash {
  0% { opacity: 0; }
  25% { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 5: Wire the route in `App.tsx`**

In `src/App.tsx`, import the screen (next to the other screen imports, after line 8):

```tsx
import { EvolutionScreen } from './components/EvolutionScreen';
```

and add a case in `screenKeyAndNode` (after the `reward` case, line 27):

```tsx
    case 'evolution': return { key: 'evolution', node: <EvolutionScreen /> };
```

- [ ] **Step 6: Route the RewardScreen Continue button**

In `src/components/RewardScreen.tsx`: read `lastStageChange` (add near the other selectors, after line 16) and use it in the Continue handler (line 106).

Add selector:
```tsx
  const lastStageChange = useGameStore((s) => s.lastStageChange);
```
Change the button (line 105-110) `onClick`:
```tsx
      <PressButton
        onClick={() => setScreen(lastStageChange ? 'evolution' : 'petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </PressButton>
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx src/App.test.tsx src/components/RewardScreen.test.tsx`
Expected: PASS. If `RewardScreen.test.tsx` asserts the old petRoom-only routing, update that assertion to reflect: routes to `petRoom` when `lastStageChange` is null (the default in those tests), which is unchanged behavior.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/EvolutionScreen.tsx src/components/EvolutionScreen.test.tsx src/index.css src/App.tsx src/components/RewardScreen.tsx
git commit -m "feat(evolution): EvolutionScreen + route from hatch/reward, silhouette/flash CSS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification + remove demo artifact

**Files:**
- Delete: `evolution-demo.html`

- [ ] **Step 1: Remove the throwaway demo**

```bash
rm -f evolution-demo.html
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all green (prior baseline + the new evolution tests; previously-skipped tests still skipped).

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke check (headed Chrome, optional but recommended)**

Per the build handoff's emulator/Playwright recipe: reach the egg drill and submit → confirm the evolution scene plays (silhouette → strobe → flash → reveal), audio fires (after a tap unlocked it), the 🔊 toggle silences it, tapping skips to the reveal, and Continue lands in the pet room. Then in DEV console drive `store.getState().addXpForTest(<xp to cross L16>)` and finish a drill to confirm reward → evolution → pet room.

- [ ] **Step 5: Commit cleanup (if the demo was tracked)**

```bash
git add -A
git commit -m "chore: remove evolution-demo brainstorming artifact

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If `git status` shows nothing to commit because the demo was untracked, skip this commit.)

---

## Self-review notes

- **Spec coverage:** stage helpers/types (T1) → spec "Stage-change detection"; `spriteSrc` (T2) → "Shared sprite resolver"; detection + hatch/finishRound/addXpForTest routing (T3) → "applyXp / triggers"; persisted sound toggle + migration (T4) → "Sound toggle state"; synth audio + provider + `soundAllowed` (T5) → "Synthesized audio"; timeline hook (T6) → "useEvolutionSequence"; EvolutionScreen + route + RewardScreen + CSS + audio wiring (T7) → "EvolutionScreen"; demo cleanup + verification (T8) → "Files touched".
- **Type/name consistency:** `StageChange {from,to}`, `lastStageChange`, `clearStageChange`, `soundEnabled`, `toggleSound`, `EvolutionSound {strobe,flash,reveal,stop}`, `soundAllowed(soundEnabled, reduced)`, `getEvolutionSound`, `setEvolutionSoundProvider`, `EvoPhase`, `TIMINGS`, `spriteSrc(species, stage, mood)` are used identically across tasks.
- **Reduced-motion + skip** handled in T6; **audio gating** in T5/T7; **persistence/migration guard test** updated in T4.
- **Watch-outs flagged inline:** the `Ctx` alias in T5 (delete if it errors), `PressButton` onClick signature in T7, and a possible RewardScreen test assertion update in T7.
