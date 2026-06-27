# Boss Battle P2 Implementation Plan (charge timer + active dodge)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer a real-time per-item charge timer and an active swipe-to-dodge onto the shipped turn-based boss battle, converting the tempo to timer-paced.

**Architecture:** Pure timer/lurch/swipe math in `src/domain/battle.ts` (clock injected, deterministic, TDD). A charge state machine extends the existing zustand `battleStore` (`charge` 0–1, `battlePhase: 'answering' | 'charged'`, actions `tickCharge`/`resolveSwipe`, plus a lurch in `onWrong`). Two new presentational components (`ChargeRing`, `DodgeSwipe`) are driven by store state; `BattleScreen` runs a `requestAnimationFrame` tick and shows the dodge overlay on the charged attack. All tuning lives in `GAME_CONFIG.battle.timer`.

**Tech Stack:** React + TypeScript, zustand, framer-motion (`useReducedMotion`), Vitest (co-located `*.test.ts`), Playwright (`e2e/`), Tailwind.

**Source of truth:** `docs/superpowers/specs/2026-06-27-boss-battle-p2-design.md`.

**Conventions (from the P1 handoff — do not violate):**
- Single checkout `D:\ai_projects\AI_design_thinking\sentence-pet`, branch `journey-redesign`. Work here; do **not** create worktrees/branches.
- **Stage explicit files only** — never `git add -A`/`.` (shared `.git` with concurrent journey work). The tree has foreign `firebase.json` (modified) + `sentencepet.mp4` (untracked) — never stage them.
- Windows + PowerShell; run dev/e2e on the main thread with `dangerouslyDisableSandbox: true`.
- Commands: `npm test` (vitest run), `npm run build`, `npm run e2e` (Playwright).
- Two-phase simplification vs the spec: the spec listed a 3-state machine (`answering | charged | dodging`) with a separate `fireCharge()`. This plan folds the wind-up into the `charged` phase (the `DodgeSwipe` overlay IS the swipe window), so there are **two** phases and **no** `fireCharge` action. Same behavior, less state.

---

## File map

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/config/gameConfig.ts` | Modify | Add `battle.timer` tuning block |
| `src/config/gameConfig.test.ts` | Modify | Assert the timer invariants |
| `src/domain/battle.ts` | Modify | Pure `chargeFraction`, `lurchedFraction`, `swipeDodges` |
| `src/domain/battle.test.ts` | Modify | Tests for the three pure helpers |
| `src/state/battleStore.ts` | Modify | Charge state machine + `onWrong` lurch + new events |
| `src/state/battleStore.test.ts` | Create | State-machine tests (RNG injected) |
| `src/components/battle/ChargeRing.tsx` | Create | Boss charge-timer ring (reduced-motion aware) |
| `src/components/battle/DodgeSwipe.tsx` | Create | Swipe-to-dodge overlay + gesture + window expiry |
| `src/components/battle/BossZone.tsx` | Modify | Host the `ChargeRing` |
| `src/components/battle/BattleScreen.tsx` | Modify | rAF tick → `tickCharge`; render `DodgeSwipe` on `charged` |
| `e2e/boss.spec.ts` | Modify | Force ring-full; assert charged attack + both dodge outcomes |

---

## Task 1: Timer config block

**Files:**
- Modify: `src/config/gameConfig.ts:53-70` (the `battle:` object)
- Test: `src/config/gameConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/config/gameConfig.test.ts`:

```ts
import { GAME_CONFIG } from './gameConfig';

describe('battle.timer (P2)', () => {
  it('defines a positive charge duration and swipe window', () => {
    expect(GAME_CONFIG.battle.timer.chargeMs).toBeGreaterThan(0);
    expect(GAME_CONFIG.battle.timer.swipeWindowMs).toBeGreaterThan(0);
  });
  it('wrongLurchFrac is a fraction in (0, 1)', () => {
    expect(GAME_CONFIG.battle.timer.wrongLurchFrac).toBeGreaterThan(0);
    expect(GAME_CONFIG.battle.timer.wrongLurchFrac).toBeLessThan(1);
  });
});
```

(If `gameConfig.test.ts` lacks the `import { describe, it, expect } from 'vitest'` line at top, add it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/config/gameConfig.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'chargeMs')`.

- [ ] **Step 3: Add the config**

In `src/config/gameConfig.ts`, inside the `battle:` object, after the `reward: { ... },` block and before the closing `},`, add:

```ts
    timer: {            // P2 timer-paced tempo
      chargeMs: 8000,        // boss charge ring fills over this many ms per item
      swipeWindowMs: 1200,   // active swipe-to-dodge window on a charged attack
      wrongLurchFrac: 0.3,   // a wrong answer pushes the ring forward by this fraction
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/config/gameConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/gameConfig.ts src/config/gameConfig.test.ts
git commit -m "feat(boss): P2 timer config (chargeMs/swipeWindowMs/wrongLurchFrac)"
```

---

## Task 2: Pure timer/lurch/swipe helpers

**Files:**
- Modify: `src/domain/battle.ts` (append, after `firstStrike`)
- Test: `src/domain/battle.test.ts` (append a new `describe`)

- [ ] **Step 1: Write the failing test**

Append to `src/domain/battle.test.ts`:

```ts
import { chargeFraction, lurchedFraction, swipeDodges } from './battle';

describe('P2 charge timer', () => {
  it('chargeFraction is elapsed/chargeMs clamped to [0,1]', () => {
    expect(chargeFraction(0, 8000)).toBe(0);
    expect(chargeFraction(4000, 8000)).toBe(0.5);
    expect(chargeFraction(8000, 8000)).toBe(1);
    expect(chargeFraction(12000, 8000)).toBe(1);   // clamps over
    expect(chargeFraction(-100, 8000)).toBe(0);     // clamps under
  });
  it('lurchedFraction adds the lurch, capped at 1', () => {
    expect(lurchedFraction(0.5, 0.3)).toBeCloseTo(0.8);
    expect(lurchedFraction(0.9, 0.3)).toBe(1);
  });
  it('swipeDodges when the swipe lands inside the window', () => {
    expect(swipeDodges(800, 1200)).toBe(true);   // in time
    expect(swipeDodges(1200, 1200)).toBe(true);  // boundary inclusive
    expect(swipeDodges(1400, 1200)).toBe(false); // too slow
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/battle.test.ts`
Expected: FAIL — `chargeFraction is not a function` (or import error).

- [ ] **Step 3: Implement the helpers**

Append to `src/domain/battle.ts`:

```ts
/** Charge ring fill fraction: elapsed/chargeMs, clamped to [0, 1]. */
export function chargeFraction(elapsedMs: number, chargeMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / chargeMs));
}

/** A wrong answer pushes the ring forward; never past full. */
export function lurchedFraction(frac: number, lurch: number): number {
  return Math.min(1, frac + lurch);
}

/** Active dodge succeeds when the swipe landed within the window. */
export function swipeDodges(swipedAtMs: number, windowMs: number): boolean {
  return swipedAtMs <= windowMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/battle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/battle.ts src/domain/battle.test.ts
git commit -m "feat(boss): P2 pure charge/lurch/swipe helpers"
```

---

## Task 3: Charge state machine in the battle store

**Files:**
- Modify: `src/state/battleStore.ts`
- Test: `src/state/battleStore.test.ts` (create)

The store gains `charge` (0–1) and `battlePhase` (`'answering' | 'charged'`), the `tickCharge`/`resolveSwipe` actions, two new `BattleEvent` kinds, a lurch in `onWrong`, and charge init in `begin`/`reset`.

- [ ] **Step 1: Write the failing test**

Create `src/state/battleStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import type { PetInstance } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { BOSS_TIERS } from '../domain/bossTiers';

const PET: PetInstance = {
  id: 'p1', species: 'water', hatched: true, xp: 0, happiness: 60,
  bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
  stats: { hp: 100, atk: 60, def: 50, spd: 90, luk: 0 },
  growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
  rarity: 'common', name: '',
};
// water beats fire → use a fire boss so the player has element advantage.
const BOSS: CheckpointBoss = {
  tierId: BOSS_TIERS[0].id, element: 'fire', name: 'Test Rival',
  rivalSprite: { species: 'fire', stage: 'baby' },
};

beforeEach(() => useBattleStore.getState().reset());

describe('charge state machine', () => {
  it('begin starts answering with an empty ring', () => {
    useBattleStore.getState().begin(PET, BOSS);
    const s = useBattleStore.getState();
    expect(s.charge).toBe(0);
    expect(s.battlePhase).toBe('answering');
  });

  it('tickCharge fills the ring and crosses into charged with a bossCharge event', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(4000); // half of 8000
    expect(useBattleStore.getState().charge).toBeCloseTo(0.5);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
    useBattleStore.getState().tickCharge(4000); // crosses 1
    expect(useBattleStore.getState().charge).toBe(1);
    expect(useBattleStore.getState().battlePhase).toBe('charged');
    expect(useBattleStore.getState().lastEvent).toEqual({ kind: 'bossCharge' });
  });

  it('resolveSwipe(true) dodges the charged attack (no pet damage) and re-arms', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(true);
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBe(petHpBefore);
    expect(s.lastEvent).toEqual({ kind: 'dodge' });
    expect(s.battlePhase).toBe('answering');
    expect(s.charge).toBe(0);
  });

  it('resolveSwipe(false) falls back to the SPD roll — dodge when rng is low', () => {
    useBattleStore.getState().begin(PET, BOSS, () => 0.01); // low draw → SPD dodge succeeds
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(false);
    expect(useBattleStore.getState().snapshot!.petHp).toBe(petHpBefore);
    expect(useBattleStore.getState().lastEvent).toEqual({ kind: 'dodge' });
  });

  it('resolveSwipe(false) takes a chargedHit when the SPD roll also fails', () => {
    useBattleStore.getState().begin(PET, BOSS, () => 0.99); // high draw → SPD dodge fails
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(false);
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(petHpBefore);
    expect(s.lastEvent?.kind).toBe('chargedHit');
    expect(s.battlePhase).toBe('answering');
  });

  it('onWrong lurches the ring forward', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(2000); // 0.25
    useBattleStore.getState().onWrong();         // +0.3 → ~0.55
    expect(useBattleStore.getState().charge).toBeCloseTo(0.55, 5);
  });

  it('onCorrect interrupts the ring back to empty', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(4000);   // 0.5
    useBattleStore.getState().onCorrect();
    expect(useBattleStore.getState().charge).toBe(0);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
  });

  it('reset clears charge and phase', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000);
    useBattleStore.getState().reset();
    expect(useBattleStore.getState().charge).toBe(0);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: FAIL — `charge`/`battlePhase`/`tickCharge`/`resolveSwipe` undefined.

- [ ] **Step 3: Implement the state machine**

Edit `src/state/battleStore.ts`. Make the following changes:

**(a)** Extend the `BattleEvent` union (after the `miss` line):

```ts
export type BattleEvent =
  | { kind: 'playerHit'; dmg: number; crit: boolean }
  | { kind: 'bossHit'; dmg: number }
  | { kind: 'dodge' }
  | { kind: 'miss' }
  | { kind: 'bossCharge' }
  | { kind: 'chargedHit'; dmg: number };
```

**(b)** Add the imports for the new helpers — change the `../domain/battle` import to:

```ts
import {
  computeHit, rollCrit, rollDodge, chargeFraction, lurchedFraction,
} from '../domain/battle';
import { GAME_CONFIG } from '../config/gameConfig';
```

**(c)** Extend the `BattleState` interface — add these fields/actions:

```ts
  charge: number;                     // 0..1 ring fill for the current item
  battlePhase: 'answering' | 'charged';
  tickCharge: (dtMs: number) => void;
  resolveSwipe: (success: boolean) => void;
```

**(d)** Add a module constant near `COUNTER_EVERY`:

```ts
const TIMER = GAME_CONFIG.battle.timer;
```

**(e)** Add the initial values to the `create(...)` object (alongside `itemsAnswered: 0`):

```ts
  charge: 0,
  battlePhase: 'answering',
```

**(f)** In `begin`, add `charge: 0, battlePhase: 'answering',` to the `set({ ... })` call.

**(g)** In `onCorrect`, add `charge: 0, battlePhase: 'answering',` to the returned object (the ring interrupts on a correct hit).

**(h)** In `onWrong`, add a lurch. Change the `set((s) => { ... })` body so every returned object also carries the lurched charge. The simplest form: compute `const charge = lurchedFraction(s.charge, TIMER.wrongLurchFrac);` at the top of the updater (after the `if (!s.snapshot ...) return s;` guard) and spread `charge` into each of the three returned objects:

```ts
  onWrong: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      const charge = lurchedFraction(s.charge, TIMER.wrongLurchFrac);
      const items = s.itemsAnswered + 1;
      if (items % COUNTER_EVERY !== 0) {
        return { itemsAnswered: items, charge, lastEvent: { kind: 'miss' } };
      }
      const ds = displayStats(s.pet);
      if (rollDodge(ds.spd, s.bossStats!.spd, s.rng)) {
        return { itemsAnswered: items, charge, lastEvent: { kind: 'dodge' } };
      }
      const dmg = computeHit({
        atkStat: s.bossStats!.atk,
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
      return {
        snapshot: applyBossHit(s.snapshot, dmg),
        itemsAnswered: items,
        charge,
        lastEvent: { kind: 'bossHit', dmg },
      };
    }),
```

**(i)** Add `tickCharge` and `resolveSwipe` actions (place after `onWrong`):

```ts
  tickCharge: (dtMs) =>
    set((s) => {
      if (!s.snapshot || s.snapshot.outcome || s.battlePhase !== 'answering') return s;
      const elapsed = s.charge * TIMER.chargeMs + dtMs;
      const charge = chargeFraction(elapsed, TIMER.chargeMs);
      if (charge >= 1) {
        return { charge: 1, battlePhase: 'charged', lastEvent: { kind: 'bossCharge' } };
      }
      return { charge };
    }),

  resolveSwipe: (success) =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss || s.battlePhase !== 'charged') return s;
      const ds = displayStats(s.pet);
      const dodged = success || rollDodge(ds.spd, s.bossStats!.spd, s.rng);
      if (dodged) {
        return { charge: 0, battlePhase: 'answering', lastEvent: { kind: 'dodge' } };
      }
      const dmg = computeHit({
        atkStat: s.bossStats!.atk,
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
      return {
        snapshot: applyBossHit(s.snapshot, dmg),
        charge: 0,
        battlePhase: 'answering',
        lastEvent: { kind: 'chargedHit', dmg },
      };
    }),
```

**(j)** In `reset`, add `charge: 0, battlePhase: 'answering',` to the `set({ ... })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `npm test`
Expected: all green (P1's 661 + the new tests).

- [ ] **Step 6: Commit**

```bash
git add src/state/battleStore.ts src/state/battleStore.test.ts
git commit -m "feat(boss): P2 charge state machine + active-dodge resolution"
```

---

## Task 4: ChargeRing component

**Files:**
- Create: `src/components/battle/ChargeRing.tsx`

A presentational SVG ring driven by a `fraction` prop. Stroke shifts amber→red as it nears full. Under `prefers-reduced-motion` the decorative pulse near-full is suppressed (timing unchanged — the fraction still advances at the same rate; only the pulse animation is dropped).

- [ ] **Step 1: Create the component**

```tsx
import { useReducedMotion } from 'framer-motion';

/** Boss charge-timer ring. `fraction` is 0..1; the ring sweeps and reddens as it fills. */
export function ChargeRing({ fraction }: { fraction: number }) {
  const reduced = useReducedMotion();
  const r = 16;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  const danger = f > 0.8;
  const stroke = danger ? '#ef4444' : f > 0.5 ? '#f59e0b' : '#fbbf24';
  return (
    <svg
      viewBox="0 0 40 40"
      className={`h-10 w-10 -rotate-90 ${danger && !reduced ? 'animate-pulse' : ''}`}
      aria-hidden
    >
      <circle cx="20" cy="20" r={r} fill="none" stroke="#0f172a" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it typechecks / builds**

Run: `npm run build`
Expected: build succeeds (component compiles; not yet referenced — that's fine).

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/ChargeRing.tsx
git commit -m "feat(boss): P2 ChargeRing component (reduced-motion aware)"
```

---

## Task 5: DodgeSwipe overlay

**Files:**
- Create: `src/components/battle/DodgeSwipe.tsx`

A modal overlay shown during the `charged` phase. Shows a "SWIPE!" prompt, detects a horizontal swipe (any direction — reflex, no direction-matching), and reports success. If the window (`swipeWindowMs`) expires with no valid swipe, it auto-reports failure. The component does NOT roll SPD itself — it only reports whether the swipe landed; the store's `resolveSwipe` does the SPD fallback.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';

const SWIPE_PX = 48; // horizontal distance that counts as a dodge swipe

/** Active swipe-to-dodge overlay. Calls onResolve(true) on a valid swipe,
 *  onResolve(false) once the window expires. Reflex only — no reading. */
export function DodgeSwipe({ onResolve }: { onResolve: (success: boolean) => void }) {
  const windowMs = GAME_CONFIG.battle.timer.swipeWindowMs;
  const startX = useRef<number | null>(null);
  const done = useRef(false);

  const resolve = (success: boolean) => {
    if (done.current) return;
    done.current = true;
    onResolve(success);
  };

  useEffect(() => {
    const t = setTimeout(() => resolve(false), windowMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMs]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-rose-950/60 backdrop-blur-sm"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current !== null && Math.abs(e.clientX - startX.current) >= SWIPE_PX) {
          resolve(true);
        }
        startX.current = null;
      }}
    >
      <p className="text-4xl font-black text-white drop-shadow">⚡ SWIPE! ⚡</p>
      <p className="mt-1 text-white/80">Swipe to dodge!</p>
      <div className="mt-3 text-3xl text-white/90">⟵ 💨 ⟶</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/DodgeSwipe.tsx
git commit -m "feat(boss): P2 DodgeSwipe overlay (swipe gesture + window expiry)"
```

---

## Task 6: Wire the ring + tick + dodge into BattleScreen / BossZone

**Files:**
- Modify: `src/components/battle/BossZone.tsx`
- Modify: `src/components/battle/BattleScreen.tsx`

The ring lives in `BossZone` (subscribes to `charge` directly so only it re-renders each frame). `BattleScreen` runs a `requestAnimationFrame` loop calling `tickCharge` while answering, and renders `DodgeSwipe` while `battlePhase === 'charged'`.

- [ ] **Step 1: Host the ChargeRing in BossZone**

Edit `src/components/battle/BossZone.tsx`. Add the imports and read `charge` from the store, then render the ring in the header row.

Change the imports block to:

```tsx
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';
import { HpBar } from './HpBar';
import { ChargeRing } from './ChargeRing';
import { useBattleStore } from '../../state/battleStore';
```

Inside the component body, before the `return`, add:

```tsx
  const charge = useBattleStore((s) => s.charge);
```

Then change the header `<div className="flex items-center justify-between ...">` to include the ring on the right. Replace the existing name `<span>` line so the right side holds both the name and the ring:

```tsx
      <div className="flex items-center justify-between text-xs text-fuchsia-100">
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold">
          {bossElementEmoji(boss)} {boss.element}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{boss.name}</span>
          <ChargeRing fraction={charge} />
        </div>
      </div>
```

- [ ] **Step 2: Add the tick loop + dodge overlay in BattleScreen**

Edit `src/components/battle/BattleScreen.tsx`.

**(a)** Add the import:

```tsx
import { DodgeSwipe } from './DodgeSwipe';
```

**(b)** Subscribe to the new store fields — add alongside the other `useBattleStore` selectors (near lines 29–35):

```tsx
  const battlePhase = useBattleStore((s) => s.battlePhase);
  const tickCharge = useBattleStore((s) => s.tickCharge);
  const resolveSwipe = useBattleStore((s) => s.resolveSwipe);
```

**(c)** Add the rAF tick effect. Place it after the existing `useEffect`s (after the win-effect at lines 55–60). It must NOT run during the intro or after a loss:

```tsx
  useEffect(() => {
    if (intro || snapshot?.outcome) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      if (useBattleStore.getState().battlePhase === 'answering') {
        useBattleStore.getState().tickCharge(dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [intro, snapshot?.outcome]);
```

(`tickCharge` is read via `getState()` inside the loop, so it is intentionally not a dependency.)

**(d)** Render the dodge overlay. Just before the closing `</DndContext>` (after the `<DragOverlay>...</DragOverlay>` block), add:

```tsx
      {battlePhase === 'charged' && (
        <DodgeSwipe onResolve={(success) => resolveSwipe(success)} />
      )}
```

- [ ] **Step 3: Manual sanity via build**

Run: `npm run build`
Expected: build succeeds (types line up: `tickCharge`/`resolveSwipe`/`battlePhase` exist on the store from Task 3).

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/battle/BossZone.tsx src/components/battle/BattleScreen.tsx
git commit -m "feat(boss): P2 wire charge ring tick + dodge overlay into battle screen"
```

---

## Task 7: e2e — charged attack + dodge resolution

**Files:**
- Modify: `e2e/boss.spec.ts`

Add a hermetic store-level test (no auth) that forces the ring to full and asserts both dodge outcomes. Extend the `StoreState` type with the new actions, then add a `test`.

- [ ] **Step 1: Write the failing test**

In `e2e/boss.spec.ts`, extend the `StoreState` type (add these to the existing type members):

```ts
  charge: number;
  battlePhase: 'answering' | 'charged';
  begin: (pet: unknown, boss: unknown, rng?: () => number) => void;
  tickCharge: (dtMs: number) => void;
  resolveSwipe: (success: boolean) => void;
  snapshot: { petHp: number; petHpMax: number; bossHp: number } | null;
```

Then add this test inside the `test.describe('boss battle', () => { ... })` block:

```ts
  test('C: charged attack fires at ring-full and a swipe dodges it (store-level)', async ({ page }) => {
    await waitForStore(page);

    // Enter the boss and seed a real battle via the prep → begin path the UI uses.
    await page.evaluate((id) => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().startBoss(id);
    }, BOSS_LESSON);

    // Drive the battle store directly: pick the seeded pet/boss the prep screen would,
    // fill the ring, and assert the charged phase opens.
    const phase = await page.evaluate(() => {
      const bs = (window as unknown as {
        battleStore: { getState: () => StoreState };
      }).battleStore.getState();
      // Tick well past chargeMs to guarantee crossing into 'charged'.
      bs.tickCharge(99_999);
      return bs.battlePhase;
    }).catch(() => 'no-battlestore');

    test.skip(phase === 'no-battlestore', 'battleStore not exposed on window in this build');
    expect(phase).toBe('charged');

    // A successful swipe dodges: pet HP unchanged, phase re-arms to answering.
    const after = await page.evaluate(() => {
      const bs = (window as unknown as {
        battleStore: { getState: () => StoreState };
      }).battleStore.getState();
      const before = bs.snapshot!.petHp;
      bs.resolveSwipe(true);
      const s = bs;
      return { before, petHp: bs.snapshot!.petHp, phase: s.battlePhase };
    });
    expect(after.petHp).toBe(after.before); // dodged → no damage
    expect(after.phase).toBe('answering');
  });
```

- [ ] **Step 2: Expose the battle store on window (dev only)**

The e2e drives the battle store directly, so it must be reachable like `window.store` is. The exposure lives in `src/main.tsx` under an `import.meta.env.DEV` guard (verified: lines 5–14). Make two edits there.

Add the import after the existing `useGameStore` import (line 5):

```ts
import { useBattleStore } from './state/battleStore'
```

Add the exposure line inside the existing `if (import.meta.env.DEV) { ... }` block (after the `window.store` line, line 13):

```ts
  (window as unknown as { battleStore: typeof useBattleStore }).battleStore = useBattleStore
```

The resulting block reads:

```ts
if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
  (window as unknown as { battleStore: typeof useBattleStore }).battleStore = useBattleStore
}
```

- [ ] **Step 3: Run the e2e**

Run (main thread, sandbox disabled): `npm run e2e -- boss.spec.ts`
Expected: Test A passes (P1, unchanged), Test C passes; Test B skips if Firebase test-account sign-in is unavailable (pre-existing behavior).

If Test C reports `battleStore not exposed`, the Step 2 assignment did not land in a code path that runs — re-check the guard/import.

- [ ] **Step 4: Commit**

```bash
git add e2e/boss.spec.ts src/main.tsx
git commit -m "test(boss): P2 e2e — charged attack fires + swipe dodge resolves"
```

---

## Final verification

- [ ] **Full unit suite:** `npm test` → all green.
- [ ] **Build:** `npm run build` → succeeds.
- [ ] **e2e:** `npm run e2e -- boss.spec.ts` → A + C pass (B may skip).
- [ ] **Manual play-test (recommended before merge):** `npm run dev` → DevPanel (`dev`, bottom-right) → 🧪 test acct → Unit 1 "Ember Rival 🔥" → Fight. Confirm: ring fills per item; answering correctly before full interrupts the ring and damages the boss; letting the ring fill opens the SWIPE overlay; a swipe dodges (no pet damage); ignoring it falls back to the SPD roll; a wrong answer lurches the ring.
- [ ] **Finish the branch:** invoke `superpowers:finishing-a-development-branch` → PR → merge, mirroring P1's PR #28.

---

## Self-review notes (coverage vs spec)

- Spec §2 per-item charge race → Tasks 2, 3, 6. Wrong-answer lurch → Task 3 (`onWrong`). Two attack sources (counter unchanged + charged) → Task 3 keeps the `COUNTER_EVERY` path, adds `resolveSwipe`. Only-charged-gets-swipe → Task 3 (`onWrong` never opens the overlay; only `tickCharge` → `charged` does). Strict timer (never pauses, fixed duration) → Task 6 tick loop has no pause; reduced-motion only suppresses the pulse → Task 4. Active dodge swipe → Tasks 5, 6. Config knobs → Task 1. Win/lose unchanged → uses existing `applyBossHit`/`snapshot.outcome`. Testing §6 → Tasks 2, 3, 7.
- Type consistency: `battlePhase` values `'answering' | 'charged'` used identically in store, BattleScreen, BossZone, e2e. Event kinds `bossCharge`/`chargedHit` defined in Task 3, asserted in Tasks 3 & 7. Helper names `chargeFraction`/`lurchedFraction`/`swipeDodges` consistent across Tasks 2–3.
