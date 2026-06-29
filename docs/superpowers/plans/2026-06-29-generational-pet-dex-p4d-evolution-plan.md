# Generational Pet Dex P4d — Def-Chain Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a pet's art stage bumps past baby (L16, L36), advance its `defId` along `evolvesToId` so it becomes a different authored `PetDef` — new identity, sprite, name — with a gentle stat spike and dex-chain recording.

**Architecture:** A pure domain fn `evolvePetDef(pet, defs, toStage, rng)` performs the swap + stat re-base. Two store sites (`finishRound`, `finishBoss`) call it inside their existing `updateActive` block right after `applyXp`, gated on a non-hatch `stageChange`, and union the evolved `defId` into `caughtDefIds`. The gacha/random-reward pool is narrowed to chain roots.

**Tech Stack:** TypeScript, Zustand (`src/state/gameStore.ts`), Vitest (unit), Playwright (e2e). Windows/PowerShell — worker-fork flake ("Worker exited unexpectedly") → re-run.

**Spec:** `docs/superpowers/specs/2026-06-29-generational-pet-dex-p4d-evolution-design.md`

**Branch:** `journey-redesign` (commit here; do NOT merge to `main`).

**Verify gate (run after each task's tests pass):** `npx vitest run`, `npx tsc -b`, `npx vite build`.

**Landmines (carried):**
- Never `git add -A` — stage explicit files only (concurrent-session contamination hazard).
- Do NOT hand-edit generated `src/content/seed.ts` (not expected to change here).
- "Create" test targets: verify they don't already exist; APPEND to existing test files (subagent listings miss subdir tests — has clobbered tests before).
- Pure domain fns stay pure: pass `defs`/`rng` in. Store actions use `getActivePetDefs()` snapshot.

---

## Task 1: `evolvePetDef` pure domain fn + stat re-base

**Files:**
- Create: `src/domain/evolution.ts`
- Create: `src/domain/evolution.test.ts` (verify it does NOT already exist first; if it does, APPEND)

**Reference shapes (already in the codebase — do not redefine):**
- `PetInstance` (`src/data/types.ts:154`): has `defId: string`, `species: Species`, `stats: BattleStats`, `growth: BattleStats`, `rarity`, `xp`, `name`, …
- `PetStage` (`src/data/types.ts:88`) = `'egg' | 'baby' | 'young' | 'adult'`.
- `BattleStats` = `{ hp, atk, def, spd, luk }` (all `number`).
- `resolvePetDef(defId, defs)` (`src/domain/petDef.ts:77`) — never null; starter-fallback on unknown id.
- Effective stat = `stats + growth` per `displayStats` (`src/config/petDisplay.ts:58`).

- [ ] **Step 1: Write the failing test**

Create `src/domain/evolution.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evolvePetDef, HOP_RANGE } from './evolution';
import type { PetDef, PetInstance, BattleStats } from '../data/types';

const ZERO: BattleStats = { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 };

function def(over: Partial<PetDef>): PetDef {
  return {
    id: 'd', name: 'D', gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, ...over,
  };
}

function pet(over: Partial<PetInstance>): PetInstance {
  return {
    id: 'p', defId: 'base', species: 'leaf', hatched: true, xp: 0, happiness: 0,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
    growth: { hp: 10, atk: 10, def: 10, spd: 10, luk: 10 },
    rarity: 'common', name: '', ...over,
  };
}

const DEFS: PetDef[] = [
  def({ id: 'base', element: 'leaf', evolvesToId: 'mid' }),
  def({ id: 'mid', element: 'fire', evolvesToId: 'final', evolvesFromId: 'base' }),
  def({ id: 'final', element: 'water', evolvesFromId: 'mid' }),
];

describe('evolvePetDef', () => {
  it('no-op when the active def has no evolvesToId', () => {
    const p = pet({ defId: 'final' });
    expect(evolvePetDef(p, DEFS, 'adult', () => 0)).toBe(p);
  });

  it('no-op for a non-evolving stage (no HOP_RANGE entry)', () => {
    const p = pet({ defId: 'base' });
    // 'baby' has no range -> egg->baby hatch never evolves even if called
    expect(evolvePetDef(p, DEFS, 'baby', () => 0)).toBe(p);
  });

  it('swaps defId and species to the next def', () => {
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    expect(out.defId).toBe('mid');
    expect(out.species).toBe('fire'); // nextDef.element — needed for sprite element-guard
  });

  it('re-bases stats: effective = round(total*factor), growth preserved', () => {
    // young range [0.03,0.10]; rng=()=>0 -> factor = 1.03
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    // total per stat = 30 + 10 = 40; round(40*1.03)=round(41.2)=41; newBase=41-10=31
    expect(out.stats).toEqual({ hp: 31, atk: 31, def: 31, spd: 31, luk: 31 });
    expect(out.growth).toEqual({ hp: 10, atk: 10, def: 10, spd: 10, luk: 10 }); // untouched
    // displayed = newBase+growth = 41 each -> +1 over the prior 40
  });

  it('adult hop uses the [0.05,0.10] range', () => {
    // rng=()=>0 -> factor = 1.05; total 40 -> round(42)=42 -> newBase=42-10=32
    const out = evolvePetDef(pet({ defId: 'mid', species: 'fire' }), DEFS, 'adult', () => 0);
    expect(out.defId).toBe('final');
    expect(out.species).toBe('water');
    expect(out.stats.hp).toBe(32);
  });

  it('never downgrades a stat (factor >= 1)', () => {
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    const before = pet({ defId: 'base' });
    for (const k of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
      expect(out.stats[k] + out.growth[k]).toBeGreaterThanOrEqual(before.stats[k] + before.growth[k]);
    }
  });

  it('exposes both evolving-stage ranges', () => {
    expect(HOP_RANGE.young).toEqual([0.03, 0.10]);
    expect(HOP_RANGE.adult).toEqual([0.05, 0.10]);
    expect(HOP_RANGE.baby).toBeUndefined();
    expect(HOP_RANGE.egg).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/evolution.test.ts`
Expected: FAIL — `Cannot find module './evolution'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/evolution.ts`:

```typescript
import type { BattleStats, PetDef, PetInstance, PetStage } from '../data/types';
import { resolvePetDef } from './petDef';

/**
 * Per-hop multiplier range [minPct, maxPct] applied to each effective stat
 * (stats + growth) when a pet advances one def-chain hop. Keyed by the art
 * stage just ENTERED: only baby->young and young->adult evolve; egg->baby (hatch)
 * and any non-evolving stage have no entry and are no-ops.
 */
export const HOP_RANGE: Partial<Record<PetStage, [number, number]>> = {
  young: [0.03, 0.10], // hop 1 (baby -> young, ~L16)
  adult: [0.05, 0.10], // hop 2 (young -> adult, ~L36)
};

const STAT_KEYS: (keyof BattleStats)[] = ['hp', 'atk', 'def', 'spd', 'luk'];

/**
 * Advance a pet one def-chain hop when its active def has `evolvesToId` AND the
 * entered stage evolves. Re-bases each stat by multiplying the effective total
 * (stats + growth) by a random per-stat factor in the hop's range, folding the
 * result back into `stats` so earned `growth` is preserved and the pet never
 * downgrades (factor >= 1). Also sets `species = nextDef.element` so the sprite
 * element-guard renders the evolved art. Returns the pet UNCHANGED on a no-op.
 * Pure: pass `defs` + `rng` in; no registry reach-in.
 */
export function evolvePetDef(
  pet: PetInstance,
  defs: readonly PetDef[],
  toStage: PetStage,
  rng: () => number,
): PetInstance {
  const range = HOP_RANGE[toStage];
  if (!range) return pet;
  const def = resolvePetDef(pet.defId, defs);
  if (!def.evolvesToId) return pet;
  const next = resolvePetDef(def.evolvesToId, defs);
  const [lo, hi] = range;
  const stats = { ...pet.stats };
  for (const k of STAT_KEYS) {
    const factor = 1 + lo + rng() * (hi - lo);
    const total = pet.stats[k] + pet.growth[k];
    stats[k] = Math.round(total * factor) - pet.growth[k];
  }
  return { ...pet, defId: next.id, species: next.element, stats };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/evolution.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/domain/evolution.ts src/domain/evolution.test.ts
git commit -m "feat: evolvePetDef def-chain hop with stat re-base (P4d)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Narrow `obtainablePool` to chain roots (gacha = stage 1 only)

**Files:**
- Modify: `src/domain/petDef.ts:71-74` (`obtainablePool`)
- Test: `src/domain/petDef.test.ts` (verify it exists; APPEND. If absent, create with the imports below.)

- [ ] **Step 1: Write the failing test**

APPEND to `src/domain/petDef.test.ts` (match its existing import style; if creating fresh, use `import { obtainablePool } from './petDef';` + `import type { PetDef } from '../data/types';`):

```typescript
describe('obtainablePool — stage-1 roots only (P4d)', () => {
  const mk = (over: Partial<PetDef>): PetDef => ({
    id: over.id ?? 'x', name: 'X', gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, starter: false, ...over,
  });

  it('excludes mid/final evolutions (defs with evolvesFromId)', () => {
    const defs = [
      mk({ id: 'root', starter: true }),
      mk({ id: 'mid', evolvesFromId: 'root', evolvesToId: 'final', dexNo: 2 }),
      mk({ id: 'final', evolvesFromId: 'mid', dexNo: 3 }),
    ];
    const pool = obtainablePool(defs).map((d) => d.id);
    expect(pool).toContain('root');
    expect(pool).not.toContain('mid');
    expect(pool).not.toContain('final');
  });

  it('still excludes disabled and gachaObtainable:false roots', () => {
    const defs = [
      mk({ id: 'root', starter: true }),
      mk({ id: 'off', enabled: false, dexNo: 2 }),
      mk({ id: 'noGacha', gachaObtainable: false, dexNo: 3 }),
    ];
    const pool = obtainablePool(defs).map((d) => d.id);
    expect(pool).toEqual(['root']);
  });

  it('falls back to the starter when no root is obtainable', () => {
    const defs = [mk({ id: 'root', starter: true, evolvesFromId: 'ghost' })];
    expect(obtainablePool(defs).length).toBe(1); // floor: [starterDef]
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/petDef.test.ts`
Expected: FAIL — `mid`/`final` currently appear in the pool.

- [ ] **Step 3: Write minimal implementation**

In `src/domain/petDef.ts`, edit `obtainablePool`:

```typescript
/** The never-empty gacha/reward pool: enabled, obtainable, chain-ROOT defs
 *  (no evolvesFromId — gacha grants stage 1; evos are reached by leveling),
 *  or [starterDef()] as a floor. */
export function obtainablePool(defs: readonly PetDef[] = active): readonly PetDef[] {
  const pool = defs.filter((d) => d.enabled && d.gachaObtainable !== false && !d.evolvesFromId);
  return pool.length ? pool : [starterDef(defs)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/petDef.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run`
Expected: PASS (some existing gacha/reward tests may now assert pool contents — if any fail because they expected a mid/final evo in the random pool, update them to assert roots; authored-`rewardPetDefId` tests must still pass unchanged since they bypass the pool).

```bash
git add src/domain/petDef.ts src/domain/petDef.test.ts
git commit -m "feat: gacha pool is chain-roots only (P4d stage-1 gating)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Hook the hop into `finishRound` + `finishBoss` and record the dex

**Files:**
- Modify: `src/state/gameStore.ts` — import (line ~15), `finishBoss` (lines 287-321), `finishRound` (lines 353-381)
- Test: `src/state/gameStore.test.ts` (APPEND)

**Guard rule:** evolve only when `stageChange && stageChange.from !== 'egg'` (skip hatch). The hop must land inside the existing `updateActive` callback so the swapped pet is in `pets` before the screen routes to `'evolution'`.

- [ ] **Step 1: Write the failing test**

APPEND to `src/state/gameStore.test.ts`. It already imports `useGameStore`, `setActivePetDefs`, `selectActivePet` etc. — reuse them. Use the store's existing test helper to push XP (the suite uses `addXpForTest` — see the "addXpForTest levels the pet" test at line ~442). Author a 2-def chain via `setActivePetDefs`, then drive the active pet across the young threshold (L16):

```typescript
describe('P4d def-chain evolution in the store', () => {
  it('advances defId to evolvesToId on the baby->young stage-change and records the dex', () => {
    const base: PetDef = {
      id: 'p4d-base', name: 'Base', gen: 9, dexNo: 90, types: ['leaf'], element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, starter: true, evolvesToId: 'p4d-mid',
    };
    const mid: PetDef = {
      id: 'p4d-mid', name: 'Mid', gen: 9, dexNo: 91, types: ['fire'], element: 'fire',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, evolvesFromId: 'p4d-base',
    };
    setActivePetDefs([base, mid]);

    // Fresh game with one hatched active pet on the base def at level 1.
    useGameStore.setState({
      pets: [{
        id: 'a', defId: 'p4d-base', species: 'leaf', hatched: true, xp: 0, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
      }],
      activePetId: 'a',
      caughtDefIds: ['p4d-base'],
    } as Partial<GameState>);

    // Push enough XP to cross L16 (young). Helper name per the existing suite.
    useGameStore.getState().addXpForTest(10_000);

    const p = selectActivePet(useGameStore.getState());
    expect(p.defId).toBe('p4d-mid');          // hopped
    expect(p.species).toBe('fire');           // species follows nextDef.element
    expect(useGameStore.getState().caughtDefIds).toContain('p4d-mid'); // dex recorded
    setActivePetDefs(BUILTIN_PET_DEFS.slice()); // restore for other tests
  });

  it('does NOT hop on egg->baby (hatch)', () => {
    const base: PetDef = {
      id: 'p4d-h', name: 'H', gen: 9, dexNo: 92, types: ['leaf'], element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, starter: true, evolvesToId: 'p4d-h2',
    };
    const h2: PetDef = {
      id: 'p4d-h2', name: 'H2', gen: 9, dexNo: 93, types: ['fire'], element: 'fire',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, evolvesFromId: 'p4d-h',
    };
    setActivePetDefs([base, h2]);
    useGameStore.setState({
      pets: [{
        id: 'b', defId: 'p4d-h', species: 'leaf', hatched: false, xp: 0, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
      }],
      activePetId: 'b', caughtDefIds: ['p4d-h'],
    } as Partial<GameState>);

    useGameStore.getState().hatch(); // egg->baby, screen='evolution'
    const p = selectActivePet(useGameStore.getState());
    expect(p.defId).toBe('p4d-h'); // unchanged — hatch is not a hop
    setActivePetDefs(BUILTIN_PET_DEFS.slice());
  });
});
```

> NOTE for the implementer: confirm the actual XP-injection helper name in `gameStore.test.ts` (search `addXpForTest`). If the helper drives `finishRound` instead, route the XP through whatever the existing level-up test uses — the assertion (defId hopped, dex recorded, no hop on hatch) is what matters. `BUILTIN_PET_DEFS` and `GameState` are already imported in the suite; if not, add `import { BUILTIN_PET_DEFS } from '../domain/petDef';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/gameStore.test.ts -t "P4d def-chain"`
Expected: FAIL — `defId` stays `'p4d-base'` (no hop wired yet).

- [ ] **Step 3: Write the implementation**

In `src/state/gameStore.ts`:

**(a) Add imports** — extend the existing petDef import (line ~15) and add the evolution import:

```typescript
import { defaultDefForElement, starterDef, obtainablePool, resolvePetDef, getActivePetDefs } from '../domain/petDef';
import { evolvePetDef } from '../domain/evolution';
```

**(b) `finishRound`** — replace the `updateActive` block + add `caughtDefIds` to the return. Change the block at lines 353-381 so it reads:

```typescript
          let levelUp: GameState['lastLevelUp'] = null;
          let stageChange: StageChange | null = null;
          let evolvedDefId: string | null = null;
          const pets = updateActive(s, (p) => {
            const happiness =
              decayHappiness(p.happiness) +
              GAME_CONFIG.happiness.onClear +
              (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
            const withXp = applyXp(p, xpGain, rng);
            levelUp = withXp.levelUp;
            stageChange = withXp.stageChange;
            let next = withXp.pet;
            if (withXp.stageChange && withXp.stageChange.from !== 'egg') {
              const before = next.defId;
              next = evolvePetDef(next, getActivePetDefs(), withXp.stageChange.to, rng);
              if (next.defId !== before) evolvedDefId = next.defId;
            }
            return {
              ...next,
              happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
              bars: decayBars(p.bars),
            };
          });
          return {
            pets,
            coins: s.coins + coinsGain,
            inventory: { ...s.inventory, [group]: s.inventory[group] + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
            lastLevelUp: levelUp,
            lastStageChange: stageChange,
            caughtDefIds: evolvedDefId ? addCaught(s.caughtDefIds, evolvedDefId) : s.caughtDefIds,
            journey,
            currentLessonId: null,
            pendingStinger,
            screen: 'reward',
          };
```

**(c) `finishBoss`** — inside the `if (firstClear)` block, replace the `updateActive` call (lines 288-293) with one that evolves and unions into the existing `caughtDefIds` local:

```typescript
            pets = updateActive(s, (p) => {
              const withXp = applyXp(p, r.firstClearXp, rng);
              lastLevelUp = withXp.levelUp;
              lastStageChange = withXp.stageChange;
              let next = withXp.pet;
              if (withXp.stageChange && withXp.stageChange.from !== 'egg') {
                const before = next.defId;
                next = evolvePetDef(next, getActivePetDefs(), withXp.stageChange.to, rng);
                if (next.defId !== before) caughtDefIds = addCaught(caughtDefIds, next.defId);
              }
              return next;
            });
```

(The reward-egg grant below it is unchanged; it appends its own `addCaught(caughtDefIds, egg.defId)` after.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: PASS (new P4d tests + existing finishRound/finishBoss tests).

- [ ] **Step 5: Full verify gate + commit**

Run: `npx vitest run && npx tsc -b && npx vite build`
Expected: all green. (Windows worker flake → re-run vitest.)

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: evolve defId on stage-change in finishRound/finishBoss (P4d)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Hermetic e2e — evolve a pet, dex chain lights up

**Files:**
- Create: `e2e/p4d-evolution.spec.ts` (verify it does NOT exist first)

**Template:** `e2e/p4c-reward-pets.spec.ts` — copy its inject-catalog (`window.petDefs.set`) + inject-bundle (`window.contentStore.setBundle`) + `window.store` setState pattern and its auth-gate-skip. Read it before writing; reuse its helpers verbatim where possible.

- [ ] **Step 1: Write the e2e test**

Create `e2e/p4d-evolution.spec.ts`. Mirror the p4c setup exactly; the P4d-specific core:

```typescript
import { test, expect } from '@playwright/test';

// Mirror e2e/p4c-reward-pets.spec.ts for app boot + auth-gate skip + the
// window.petDefs / window.store DEV handles. Only the assertions below are new.

test('a pet evolves its def on the baby->young stage-change', async ({ page }) => {
  await page.goto('/');
  // ... p4c boot + auth-skip ...

  // Inject a 2-def chain: leaf root 'e2e-base' -> fire 'e2e-mid'.
  await page.evaluate(() => {
    const w = window as unknown as { petDefs: { get: () => unknown[]; set: (d: unknown[]) => void; builtins: unknown[] } };
    const bands = (w.petDefs.builtins[0] as { statBands: unknown }).statBands;
    w.petDefs.set([
      { id: 'e2e-base', name: 'Base', gen: 9, dexNo: 90, types: ['leaf'], element: 'leaf', statBands: bands, enabled: true, starter: true, evolvesToId: 'e2e-mid' },
      { id: 'e2e-mid', name: 'Mid', gen: 9, dexNo: 91, types: ['fire'], element: 'fire', statBands: bands, enabled: true, evolvesFromId: 'e2e-base' },
    ]);
  });

  // Put an active hatched pet on the base def, then push it across L16.
  await page.evaluate(() => {
    const w = window as unknown as { store: { setState: (s: unknown) => void; getState: () => { addXpForTest: (n: number) => void } } };
    w.store.setState({
      pets: [{ id: 'a', defId: 'e2e-base', species: 'leaf', hatched: true, xp: 0, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', caughtDefIds: ['e2e-base'],
    });
    w.store.getState().addXpForTest(10000);
  });

  // Assert the swap landed in store state.
  const after = await page.evaluate(() => {
    const w = window as unknown as { store: { getState: () => { pets: { defId: string; species: string }[]; caughtDefIds: string[] } } };
    const s = w.store.getState();
    return { defId: s.pets[0].defId, species: s.pets[0].species, caught: s.caughtDefIds };
  });
  expect(after.defId).toBe('e2e-mid');
  expect(after.species).toBe('fire');
  expect(after.caught).toContain('e2e-mid');
});
```

> If `window.store` exposes XP injection differently than `addXpForTest`, use the same mechanism the p4c spec uses to advance the active pet. Keep the three assertions (defId hopped, species followed, dex recorded).

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test e2e/p4d-evolution.spec.ts`
Expected: PASS. (If the app needs the dev server, use the project's existing e2e command — check `package.json` scripts, e.g. `npm run test:e2e -- p4d-evolution`.)

- [ ] **Step 3: Commit**

```bash
git add e2e/p4d-evolution.spec.ts
git commit -m "test(e2e): pet evolves its def on stage-change (P4d)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Whole-feature review + manual smoke

- [ ] **Step 1: Full verify gate**

Run: `npx vitest run && npx tsc -b && npx vite build`
Expected: all green.

- [ ] **Step 2: Requesting code review**

Use `superpowers:requesting-code-review` for a final whole-feature review (the cadence that caught real misses in P4a/b/c). Focus the reviewer on: (1) the two store hook sites compose cleanly with `lastStageChange`/`lastHatch`/`rewardHatch` routing; (2) `species` mutation doesn't break any species-immutability assumption elsewhere; (3) no existing gacha/reward test silently weakened by the pool change.

- [ ] **Step 3: Manual smoke (emulators)**

Per spec testing section:
1. `npm run emulators` (storage :9199), `npm run dev:admin`, seed.
2. `/#admin` → 🔑 Dev admin → PetsTab → author an evolution pair (`evolvesTo`) on two enabled defs.
3. Put the authored root on the active pet; level/clear to L16.
4. Confirm: pet becomes the evolved def (sprite + name change) AND the dex chain overlay lights the next form (Collection → Dex → chain).

- [ ] **Step 4: Update memory + handoff**

Write a `[[sentence-pet-generational-dex-p4d-evolution]]` memory (mirror the P4c entry shape) noting: def-chain hop on stage-change, stat re-base (effective×factor, growth-preserved, hop1 3-10%/hop2 5-10%), gacha→roots-only, no persist bump, files touched, commit range. Add the MEMORY.md index line.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- D1 trigger (stage-change, skip hatch) → Task 3 guard `stageChange.from !== 'egg'`. ✓
- D2 stat re-base (effective×factor, carry growth, hop1 3-10% / hop2 5-10%) → Task 1 `evolvePetDef` + `HOP_RANGE`. ✓
- D3 gacha roots-only → Task 2 `obtainablePool` filter. ✓
- D4 species follows nextDef.element → Task 1 swap. ✓
- D5 dex record → Task 3 `addCaught` at both hook sites. ✓
- D6 no persist bump → no `PERSIST_VERSION` change anywhere in the plan. ✓
- DexGrid-visibility landmine → verified independent (`d.enabled` only); no task needed, noted in Task 2 Step 5 context. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The two implementer NOTEs (XP-helper name, e2e XP mechanism) are explicit verification instructions with a concrete fallback, not placeholders. ✓

**Type consistency:** `evolvePetDef(pet, defs, toStage, rng)` signature identical in Task 1 definition and Task 3 call sites; `HOP_RANGE` keyed by `PetStage`; `getActivePetDefs`/`addCaught`/`resolvePetDef` names match the codebase. ✓
