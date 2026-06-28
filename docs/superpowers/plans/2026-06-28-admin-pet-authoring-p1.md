# Admin Pet Authoring P1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a data-driven `PetDef` (the authorable creature) split from the fixed 4-element taxonomy, give every `PetInstance` a stable `defId`, and add the catalog's persistence + migration — without changing how any existing consumer reads `species`.

**Architecture:** A built-in pet-def registry lives in `src/domain/petDef.ts` (pure resolve helpers + a module-level active registry, defaulting to 4 built-in defs — one per element, leaf flagged starter). `makePet` defaults each new pet's `defId` to its element's default def, so existing call sites need no change. Persistence mirrors the course pattern: single Firestore doc `content/petDefs`, `validatePetDefs`, cache-first `hydratePetDefs`, built-in fallback so the game never blanks. A migrate step (`PERSIST_VERSION` 15→16) and a `fromCloud` backfill stamp `defId` onto legacy local + cloud pets.

**Tech Stack:** TypeScript, Zustand (`persist`), Firebase Firestore, Vitest. Windows / PowerShell. Type gate is `npx tsc -b` (NOT `--noEmit`).

**Spec:** `docs/superpowers/specs/2026-06-28-admin-pet-authoring-p1-design.md`
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/data/types.ts` | `StatRange`, `PetDef`, `PetInstance.defId` | Modify |
| `src/domain/petDef.ts` | Built-in defs, registry holder, resolve helpers | Create |
| `src/domain/petDef.test.ts` | Registry + resolve + builtins-vs-gacha tests | Create |
| `src/domain/pets.ts` | `makePet` defaults `defId` | Modify |
| `src/state/gameStore.ts` | `freshPet` defId, `migrate` v15→16 backfill, `PERSIST_VERSION` 16 | Modify |
| `src/sync/mapping.ts` | `fromCloud` backfills `defId` on legacy cloud pets | Modify |
| `src/content/validate.ts` | `validatePetDefs` | Modify |
| `src/content/validate.test.ts` (or sibling) | `validatePetDefs` cases | Create/Modify |
| `src/content/cache.ts` | `cachedPetDefs` / `writePetDefsCache` | Modify |
| `src/firebase/content.ts` | `fetchPetDefs` / `savePetDefs` + `PET_DEFS` doc | Modify |
| `src/content/load.ts` | `hydratePetDefs` + re-exports | Modify |
| `src/content/load.test.ts` | `hydratePetDefs` swap/keep/error | Modify |
| `src/main.tsx` | seed registry from cache + kick `hydratePetDefs` | Modify |
| `src/sync/{mapping,reconcile,cloudSync}.test.ts` | add `defId` to hand-built pet literals | Modify |

**Out of scope (later phases):** admin Pets tab (P2), `PetDef.sprites` + Storage upload (P3), gacha-pool-from-catalog + course `rewardPetDefId` (P4). `firebase.json` untouched.

---

## Task 1: PetDef types + built-in registry + resolve helpers

Pure domain layer. No consumers yet; the test drives it.

**Files:**
- Modify: `src/data/types.ts` (add `StatRange`, `PetDef`; add `defId` to `PetInstance`)
- Create: `src/domain/petDef.ts`
- Create: `src/domain/petDef.test.ts`

- [ ] **Step 1: Add types to `src/data/types.ts`**

Add near `Species`/`Rarity`/`BattleStats` (after the `PetInstance` interface is fine; order within the file doesn't matter):

```ts
/** Inclusive integer stat range [min, max]. */
export type StatRange = [min: number, max: number];

/**
 * Admin-authored creature definition (global content). The fixed 4 `Species`
 * remain the element/matchup taxonomy; a PetDef *references* one element.
 * Stable `id` is course-referenceable later (P4 rewardPetDefId).
 */
export interface PetDef {
  id: string;
  name: string;
  element: Species;
  statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>;
  starter?: boolean; // marks the first-egg creature (exactly one def true)
  enabled: boolean;  // gacha-pool gate; P1 stores only, P4 reads it
}
```

Then add the required field to `PetInstance` (insert right after `id`):

```ts
export interface PetInstance {
  id: string;
  defId: string; // the authored creature (PetDef.id)
  species: Species;
  // …existing fields unchanged…
}
```

- [ ] **Step 2: Write the failing test `src/domain/petDef.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PET_DEFS,
  getActivePetDefs,
  setActivePetDefs,
  resolvePetDef,
  defaultDefForElement,
  starterDef,
} from './petDef';
import { rollStatsForRarity } from './pets';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Rarity, Species } from '../data/types';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const ELEMENTS: Species[] = ['leaf', 'fire', 'air', 'water'];

describe('BUILTIN_PET_DEFS', () => {
  it('has exactly one def per element, all enabled', () => {
    expect(BUILTIN_PET_DEFS).toHaveLength(4);
    expect(BUILTIN_PET_DEFS.map((d) => d.element).sort()).toEqual([...ELEMENTS].sort());
    expect(BUILTIN_PET_DEFS.every((d) => d.enabled)).toBe(true);
  });

  it('flags exactly one starter (leaf)', () => {
    const starters = BUILTIN_PET_DEFS.filter((d) => d.starter);
    expect(starters).toHaveLength(1);
    expect(starters[0].element).toBe('leaf');
  });

  it('stat bands reproduce the existing gacha bands for every rarity/stat', () => {
    for (const def of BUILTIN_PET_DEFS) {
      for (const tier of GAME_CONFIG.gacha.rarities) {
        for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
          expect(def.statBands[tier.rarity][stat]).toEqual(tier.band);
        }
      }
    }
  });
});

describe('resolve helpers', () => {
  it('defaultDefForElement returns the built-in def for that element', () => {
    for (const el of ELEMENTS) {
      expect(defaultDefForElement(el, BUILTIN_PET_DEFS).element).toBe(el);
    }
  });

  it('starterDef returns the starter-flagged def', () => {
    expect(starterDef(BUILTIN_PET_DEFS).starter).toBe(true);
  });

  it('resolvePetDef finds by id, falls back to starter for an unknown id', () => {
    const leaf = defaultDefForElement('leaf', BUILTIN_PET_DEFS);
    expect(resolvePetDef(leaf.id, BUILTIN_PET_DEFS)).toBe(leaf);
    expect(resolvePetDef('does-not-exist', BUILTIN_PET_DEFS).starter).toBe(true);
  });

  it('built-in bands feed rollStatsForRarity within range', () => {
    const def = defaultDefForElement('fire', BUILTIN_PET_DEFS);
    for (const r of RARITIES) {
      const [min, max] = def.statBands[r].hp;
      const s = rollStatsForRarity(r, () => 0.5, GAME_CONFIG.gacha.rarities);
      expect(s.hp).toBeGreaterThanOrEqual(min);
      expect(s.hp).toBeLessThanOrEqual(max);
    }
  });
});

describe('active registry', () => {
  it('defaults to the built-ins and is swappable', () => {
    setActivePetDefs(BUILTIN_PET_DEFS); // reset
    expect(getActivePetDefs()).toEqual(BUILTIN_PET_DEFS);
    const custom = [{ ...BUILTIN_PET_DEFS[0], id: 'custom-leaf' }];
    setActivePetDefs(custom);
    expect(getActivePetDefs()).toEqual(custom);
    setActivePetDefs(BUILTIN_PET_DEFS); // restore for other suites
  });

  it('helpers default their defs arg to the active registry', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    expect(defaultDefForElement('water').element).toBe('water');
    expect(starterDef().starter).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/domain/petDef.test.ts`
Expected: FAIL — `Cannot find module './petDef'`.

- [ ] **Step 4: Implement `src/domain/petDef.ts`**

```ts
import { GAME_CONFIG } from '../config/gameConfig';
import { SPECIES } from './species';
import type { BattleStats, PetDef, Rarity, Species, StatRange } from '../data/types';

const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luk'] as const satisfies readonly (keyof BattleStats)[];

/** Build per-rarity × per-stat bands from the gacha rarity table (single source of truth). */
function bandsFromGacha(): Record<Rarity, Record<keyof BattleStats, StatRange>> {
  const out = {} as Record<Rarity, Record<keyof BattleStats, StatRange>>;
  for (const tier of GAME_CONFIG.gacha.rarities) {
    const band: StatRange = [tier.band[0], tier.band[1]];
    out[tier.rarity] = { hp: band, atk: band, def: band, spd: band, luk: band };
  }
  return out;
}

const ELEMENT_NAME: Record<Species, string> = { leaf: 'Leaflet', fire: 'Embers', air: 'Zephyr', water: 'Dewdrop' };

/** One built-in def per fixed element. Leaf is the starter. All enabled. */
export const BUILTIN_PET_DEFS: readonly PetDef[] = SPECIES.map((element) => ({
  id: `def-${element}`,
  name: ELEMENT_NAME[element],
  element,
  statBands: bandsFromGacha(),
  ...(element === 'leaf' ? { starter: true } : {}),
  enabled: true,
}));

/** Module-level active catalog. Hydration swaps this; defaults to the built-ins so the game never blanks. */
let active: readonly PetDef[] = BUILTIN_PET_DEFS;

export function getActivePetDefs(): readonly PetDef[] {
  return active;
}

export function setActivePetDefs(defs: readonly PetDef[]): void {
  active = defs.length > 0 ? defs : BUILTIN_PET_DEFS;
}

/** The default def for an element. P1 has exactly one def per element; falls back to the starter. */
export function defaultDefForElement(element: Species, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.element === element) ?? starterDef(defs);
}

/** The starter-flagged def (built-in: leaf); defensively falls back to the first def. */
export function starterDef(defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.starter) ?? defs[0] ?? BUILTIN_PET_DEFS[0];
}

/** Resolve a pet's defId to a def. Never null: unknown ids fall back to the starter. */
export function resolvePetDef(defId: string, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.id === defId) ?? starterDef(defs);
}

void STAT_KEYS; // exported shape reference; kept for parity with pets.ts
```

> Note: `STAT_KEYS` is only used implicitly via the literal object in `bandsFromGacha`. If `tsc` flags it as unused, delete the `STAT_KEYS` const and its `void` line.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/domain/petDef.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Type-check (PetInstance.defId is now required — this WILL surface broken literals)**

Run: `npx tsc -b`
Expected: errors in files that hand-build `PetInstance` literals without `defId` (e.g. `src/sync/mapping.test.ts`, `src/sync/reconcile.test.ts`, `src/sync/cloudSync.test.ts`, and any others). These are fixed in Task 2. Note the exact list from the output.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/domain/petDef.ts src/domain/petDef.test.ts
git commit -m "feat(pets): PetDef type + built-in registry + resolve helpers"
```

---

## Task 2: `makePet` defaults `defId`; fix hand-built pet literals

Make `PetInstance.defId` always populated. `makePet` defaults it from the element; hand-built test literals get an explicit `defId`.

**Files:**
- Modify: `src/domain/pets.ts:75-95` (`makePet`)
- Modify: `src/domain/pets.test.ts` (assert `defId`)
- Modify: `src/sync/mapping.test.ts:7-15`, `src/sync/reconcile.test.ts:8-16`, `src/sync/cloudSync.test.ts:7-15` (pet helpers)
- Modify: any other file flagged by `tsc -b` in Task 1 Step 6

- [ ] **Step 1: Add a failing assertion to `src/domain/pets.test.ts`**

In the `describe('makePet', …)` block add:

```ts
  it('defaults defId to the element default and honors an explicit defId', () => {
    const def = makePet({ id: 'a', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common' });
    expect(def.defId).toBe('def-fire');
    const explicit = makePet({ id: 'b', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common', defId: 'custom' });
    expect(explicit.defId).toBe('custom');
  });
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/domain/pets.test.ts`
Expected: FAIL — `defId` is `undefined` / arg not accepted.

- [ ] **Step 3: Update `makePet` in `src/domain/pets.ts`**

Add the import at the top:

```ts
import { defaultDefForElement } from './petDef';
```

Change the signature + body:

```ts
export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  rarity: Rarity;
  name?: string;
  hatched?: boolean;
  defId?: string;
}): PetInstance {
  return {
    id: args.id,
    defId: args.defId ?? defaultDefForElement(args.species).id,
    species: args.species,
    hatched: args.hatched ?? false,
    xp: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: freshBars(),
    stats: args.stats,
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: args.rarity,
    name: args.name ?? '',
  };
}
```

- [ ] **Step 4: Fix the 3 hand-built pet helpers (and any others tsc flagged)**

In `src/sync/mapping.test.ts`, `src/sync/reconcile.test.ts`, `src/sync/cloudSync.test.ts`, add `defId: 'def-leaf',` to each `pet()` helper's returned literal, e.g. in `mapping.test.ts`:

```ts
function pet(id: string): PetInstance {
  return {
    id, defId: 'def-leaf', species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  };
}
```

Apply the same `defId: 'def-leaf',` insertion to the `pet()` helper in `reconcile.test.ts` and `cloudSync.test.ts`. For any other file `tsc -b` flagged in Task 1 Step 6 (e.g. a literal in `battleStore.test.ts` / `gameStore.test.ts`), add `defId: 'def-leaf'` to that literal too.

- [ ] **Step 5: Run the type gate and tests**

Run: `npx tsc -b`
Expected: clean (no errors).

Run: `npx vitest run src/domain/pets.test.ts src/sync`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/pets.ts src/domain/pets.test.ts src/sync/mapping.test.ts src/sync/reconcile.test.ts src/sync/cloudSync.test.ts
# add any other test files tsc flagged:
# git add src/state/battleStore.test.ts src/state/gameStore.test.ts
git commit -m "feat(pets): makePet defaults defId from element; backfill test fixtures"
```

---

## Task 3: Migration v15→16 backfills `defId` on local saves

Every existing local save's pets gets a `defId` keyed off its `species`.

**Files:**
- Modify: `src/state/gameStore.ts` (`PERSIST_VERSION`, `freshPet`, `migrate`)
- Modify: `src/state/gameStore.test.ts`

- [ ] **Step 1: Write the failing migrate test in `src/state/gameStore.test.ts`**

Add a test that drives the migrate function directly. (Mirror how existing migrate tests call it; the migrate fn is the `migrate` option on the persist config. If the suite already exposes a helper to run migrate, reuse it. Otherwise add this self-contained block that imports the store module and a legacy save.)

```ts
import { PERSIST_VERSION } from './gameStore';
import { defaultDefForElement } from '../domain/petDef';

describe('persist migrate v15->16 (defId backfill)', () => {
  it('PERSIST_VERSION is 16', () => {
    expect(PERSIST_VERSION).toBe(16);
  });

  it('backfills defId on a legacy pet from its species', () => {
    // A v15-shaped pet has no defId.
    const legacyPet = {
      id: 'p1', species: 'fire', hatched: true, xp: 0, happiness: 50,
      bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
      growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
      rarity: 'common', name: '',
    };
    const migrated = runMigrate({ pets: [legacyPet], activePetId: 'p1' }) as { pets: { defId: string }[] };
    expect(migrated.pets[0].defId).toBe(defaultDefForElement('fire').id);
  });
});
```

If the test file has no `runMigrate` helper, add one near the top of the file:

```ts
import { useGameStore } from './gameStore';
// The persist middleware stores the migrate fn on the store's persist API.
const runMigrate = (state: unknown): unknown =>
  (useGameStore.persist.getOptions().migrate as (s: unknown, v: number) => unknown)(state, 15);
```

> If the existing test file already exercises `migrate` a different way, follow that pattern instead of adding `runMigrate`.

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/state/gameStore.test.ts -t "defId backfill"`
Expected: FAIL — `PERSIST_VERSION` is 15 and pets have no `defId`.

- [ ] **Step 3: Bump version, default freshPet's defId, add the backfill**

In `src/state/gameStore.ts`:

Change the version constant:

```ts
export const PERSIST_VERSION = 16;
```

Add the import (extend the existing `../domain/petDef` import if Task added one, else new line near the other domain imports):

```ts
import { defaultDefForElement, starterDef } from '../domain/petDef';
```

Make `freshPet` stamp the starter def explicitly (keeps `species:'leaf'`, adds correct starter `defId`):

```ts
function freshPet(): PetInstance {
  return makePet({ id: STARTER_ID, defId: starterDef().id, species: 'leaf', stats: rollStats(rng), rarity: 'common', hatched: false });
}
```

In `migrate`, add a `defId` backfill map alongside the existing per-pet backfills (place it after the v7→v8 `growth` backfill block, before the final `delete`/`return`). Update the version-history comment too:

```ts
        // v15->v16: backfill defId on any pet that predates the field (key off species/element).
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).defId
              ? p
              : { ...(p as PetInstance), defId: defaultDefForElement((p as PetInstance).species).id },
          );
        }
```

Add to the version-history comment block (near line 460):

```ts
        // v15->v16: backfill defId (the authored creature) keyed off species/element; default 'def-<element>'.
```

> The v<5 restructure path (`makePet({...})` at ~L519) needs no change — `makePet` now defaults `defId` from the legacy species automatically.

- [ ] **Step 4: Run the migrate test + the full store suite**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: PASS (new test + all existing invariants, incl. `pets[0].id === 'starter-leaf'`, now also `pets[0].defId === 'def-leaf'`).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(pets): migrate v15->16 backfills defId; freshPet stamps starter def"
```

---

## Task 4: `fromCloud` backfills `defId` on legacy cloud pets

`migrate` never runs on cloud-restored pets (`reconcileFromCloud` → `fromCloud`). Backfill at the `fromCloud` boundary so cloud pets are never missing `defId`.

**Files:**
- Modify: `src/sync/mapping.ts` (`fromCloud`)
- Modify: `src/sync/mapping.test.ts`

- [ ] **Step 1: Write the failing test in `src/sync/mapping.test.ts`**

```ts
import { defaultDefForElement } from '../domain/petDef';

it('fromCloud backfills defId on a legacy cloud pet missing it', () => {
  const legacy = { ...pet('a') } as Record<string, unknown>;
  delete legacy.defId; // simulate a pre-v16 cloud pet doc
  const cloud = toCloud({ ...sample, pets: [legacy as unknown as PetInstance] });
  const restored = fromCloud(cloud);
  expect(restored.pets[0].defId).toBe(defaultDefForElement('leaf').id);
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/sync/mapping.test.ts -t "backfills defId"`
Expected: FAIL — `defId` is `undefined`.

- [ ] **Step 3: Implement the backfill in `src/sync/mapping.ts`**

Add the import and map the pets in `fromCloud`:

```ts
import { defaultDefForElement } from '../domain/petDef';
```

```ts
/** Recombine cloud docs back into the persisted shape. Pure. Drops persistVersion.
 *  Backfills defId on legacy pet docs (pre-v16) so cloud-restored pets are never blank. */
export function fromCloud(c: CloudSave): PersistedState {
  const { persistVersion: _persistVersion, ...profile } = c.profile;
  void _persistVersion;
  const pets = c.pets.map((p) =>
    p.defId ? p : { ...p, defId: defaultDefForElement(p.species).id },
  );
  return { ...profile, pets };
}
```

- [ ] **Step 4: Run the mapping suite**

Run: `npx vitest run src/sync/mapping.test.ts`
Expected: PASS — new backfill test + the existing `fromCloud(toCloud(sample))` round-trip (sample pets already carry `defId: 'def-leaf'` from Task 2, so equality holds).

- [ ] **Step 5: Commit**

```bash
git add src/sync/mapping.ts src/sync/mapping.test.ts
git commit -m "feat(sync): fromCloud backfills defId on legacy cloud pets"
```

---

## Task 5: `validatePetDefs`

Validation gate (mirrors `validateCourse` discipline). Used by cache + future admin save (P2).

**Files:**
- Modify: `src/content/validate.ts` (add `validatePetDefs`)
- Modify/Create: `src/content/validate.test.ts` (add a `validatePetDefs` describe block; if no such test file exists, create `src/content/petDefValidate.test.ts` with the block below)

- [ ] **Step 1: Write the failing test**

Add this describe block to the validate test file:

```ts
import { validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import type { PetDef } from '../data/types';

const clone = (): PetDef[] => JSON.parse(JSON.stringify(BUILTIN_PET_DEFS));

describe('validatePetDefs', () => {
  it('accepts the built-in defs', () => {
    expect(validatePetDefs(clone())).toEqual({ ok: true, errors: [] });
  });

  it('rejects duplicate ids', () => {
    const defs = clone();
    defs[1].id = defs[0].id;
    const r = validatePetDefs(defs);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('rejects an empty name', () => {
    const defs = clone();
    defs[0].name = '   ';
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects an element outside the fixed four', () => {
    const defs = clone();
    (defs[0] as { element: string }).element = 'rock';
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects an inverted stat band (min > max)', () => {
    const defs = clone();
    defs[0].statBands.common.hp = [60, 40];
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects a missing rarity band', () => {
    const defs = clone();
    delete (defs[0].statBands as Record<string, unknown>).epic;
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects zero starters', () => {
    const defs = clone();
    defs.forEach((d) => { delete d.starter; });
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects multiple starters', () => {
    const defs = clone();
    defs.forEach((d) => { d.starter = true; });
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects when no def is enabled', () => {
    const defs = clone();
    defs.forEach((d) => { d.enabled = false; });
    expect(validatePetDefs(defs).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run src/content/validate.test.ts -t validatePetDefs` (or the new file path)
Expected: FAIL — `validatePetDefs` not exported.

- [ ] **Step 3: Implement `validatePetDefs` in `src/content/validate.ts`**

Add at the end of the file:

```ts
import { SPECIES } from '../domain/species';
import type { PetDef, Rarity } from '../data/types';

const RARITY_KEYS: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luk'] as const;

/** Structural validation for the pet-def catalog. Mirrors validateCourse's gate-before-save discipline. */
export function validatePetDefs(defs: PetDef[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  const ids = defs.map((d) => d.id);
  if (new Set(ids).size !== ids.length) push('duplicate pet-def ids');

  for (const d of defs) {
    if (!d.id || d.id.trim() === '') push('pet-def has empty id');
    if (!d.name || d.name.trim() === '') push(`pet-def ${d.id} name is empty`);
    if (!SPECIES.includes(d.element)) push(`pet-def ${d.id} element ${String(d.element)} is not one of the fixed four`);
    for (const r of RARITY_KEYS) {
      const band = d.statBands?.[r];
      if (!band) { push(`pet-def ${d.id} missing stat bands for rarity ${r}`); continue; }
      for (const stat of STAT_KEYS) {
        const range = band[stat];
        if (!range) { push(`pet-def ${d.id} ${r}.${stat} band missing`); continue; }
        const [min, max] = range;
        if (typeof min !== 'number' || typeof max !== 'number') push(`pet-def ${d.id} ${r}.${stat} band not numeric`);
        else if (min > max) push(`pet-def ${d.id} ${r}.${stat} band min > max`);
        else if (min < 0) push(`pet-def ${d.id} ${r}.${stat} band min < 0`);
      }
    }
  }

  const starters = defs.filter((d) => d.starter).length;
  if (starters !== 1) push(`expected exactly one starter pet-def, found ${starters}`);
  if (!defs.some((d) => d.enabled)) push('no pet-def is enabled');

  return { ok: errors.length === 0, errors };
}
```

> If `validate.ts` already imports `Rarity` or `SPECIES`, merge rather than duplicate the imports.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/content/validate.test.ts -t validatePetDefs`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(content): validatePetDefs catalog validation"
```

---

## Task 6: Persistence — cache + Firestore + hydrate

Cache-first hydration mirroring `hydrateCourse`. No admin UI writes the catalog yet (P2); P1 reads with built-in fallback.

**Files:**
- Modify: `src/content/cache.ts` (`cachedPetDefs`, `writePetDefsCache`)
- Modify: `src/firebase/content.ts` (`PET_DEFS` doc, `fetchPetDefs`, `savePetDefs`)
- Modify: `src/content/load.ts` (`hydratePetDefs` + re-exports)
- Modify: `src/content/load.test.ts`

- [ ] **Step 1: Add cache helpers to `src/content/cache.ts`**

Append:

```ts
import { validatePetDefs } from './validate';
import type { PetDef } from '../data/types';

export const PET_DEFS_CACHE_KEY = 'sentence-pet-petdefs';

/** Last-good cached pet-def catalog, or null if absent/corrupt/invalid. */
export function cachedPetDefs(): PetDef[] | null {
  try {
    const raw = localStorage.getItem(PET_DEFS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PetDef[];
    return validatePetDefs(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

export function writePetDefsCache(defs: PetDef[]): void {
  try {
    localStorage.setItem(PET_DEFS_CACHE_KEY, JSON.stringify(defs));
  } catch { /* quota / disabled — non-fatal */ }
}
```

- [ ] **Step 2: Add Firestore read/write to `src/firebase/content.ts`**

Add the doc handle near the other doc consts (after line 12):

```ts
const PET_DEFS = doc(db, 'content', 'petDefs');
```

Add the fetch/save fns (mirror `saveCourse` style) at the end of the file. Import `PetDef`:

```ts
import type { PetDef } from '../data/types';
```

```ts
/** Read the pet-def catalog (single doc). Returns null if the doc is absent (caller falls back to built-ins). */
export async function fetchPetDefs(): Promise<PetDef[] | null> {
  const snap = await getDoc(PET_DEFS);
  if (!snap.exists()) return null;
  return (snap.data()?.defs ?? []) as PetDef[];
}

/** Overwrite the whole pet-def catalog doc. (P2 admin save uses this.) */
export async function savePetDefs(defs: PetDef[]): Promise<void> {
  const batch = writeBatch(db);
  batch.set(PET_DEFS, { defs });
  await batch.commit();
}
```

- [ ] **Step 3: Write the failing hydrate test in `src/content/load.test.ts`**

Mirror the existing `hydrateContent` tests (they mock `../firebase/content` and assert the store/cache). Add:

```ts
import { hydratePetDefs } from './load';
import { cachedPetDefs, PET_DEFS_CACHE_KEY } from './cache';
import { getActivePetDefs, setActivePetDefs, BUILTIN_PET_DEFS } from '../domain/petDef';
import type { PetDef } from '../data/types';

// Extend the existing vi.mock('../firebase/content', …) factory to include fetchPetDefs,
// or add it if the mock is per-test. Example using a settable mock:
// (Follow whatever mocking style this file already uses for fetchContent.)

describe('hydratePetDefs', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePetDefs(BUILTIN_PET_DEFS);
  });

  it('swaps to a valid live catalog and caches it', async () => {
    const live: PetDef[] = JSON.parse(JSON.stringify(BUILTIN_PET_DEFS));
    live[0].name = 'Sprout';
    mockFetchPetDefs.mockResolvedValueOnce(live); // wire to your mock of ../firebase/content
    await hydratePetDefs();
    expect(getActivePetDefs()[0].name).toBe('Sprout');
    expect(cachedPetDefs()?.[0].name).toBe('Sprout');
  });

  it('keeps built-ins when the live catalog is invalid', async () => {
    const bad: PetDef[] = JSON.parse(JSON.stringify(BUILTIN_PET_DEFS));
    bad.forEach((d) => { delete d.starter; }); // zero starters → invalid
    mockFetchPetDefs.mockResolvedValueOnce(bad);
    await hydratePetDefs();
    expect(getActivePetDefs()).toEqual(BUILTIN_PET_DEFS);
  });

  it('swallows fetch errors and keeps the current registry', async () => {
    mockFetchPetDefs.mockRejectedValueOnce(new Error('offline'));
    await hydratePetDefs();
    expect(getActivePetDefs()).toEqual(BUILTIN_PET_DEFS);
  });

  it('does nothing destructive when the doc is absent (null)', async () => {
    mockFetchPetDefs.mockResolvedValueOnce(null);
    await hydratePetDefs();
    expect(getActivePetDefs()).toEqual(BUILTIN_PET_DEFS);
  });
});
```

> Wire `mockFetchPetDefs` to this file's existing mock of `../firebase/content`. If that mock is declared once at module top (`vi.mock('../firebase/content', () => ({ … }))`), add `fetchPetDefs: (...args) => mockFetchPetDefs(...args)` to the factory and declare `const mockFetchPetDefs = vi.fn()` via `vi.hoisted`. Match the file's established style.

- [ ] **Step 4: Run it to verify failure**

Run: `npx vitest run src/content/load.test.ts -t hydratePetDefs`
Expected: FAIL — `hydratePetDefs` not exported.

- [ ] **Step 5: Implement `hydratePetDefs` in `src/content/load.ts`**

Add imports:

```ts
import { fetchPetDefs } from '../firebase/content';
import { validatePetDefs } from './validate';
import { setActivePetDefs } from '../domain/petDef';
```

Add the re-exports to the existing `export { … } from './cache';` block:

```ts
  PET_DEFS_CACHE_KEY,
  cachedPetDefs,
  writePetDefsCache,
```

Add the function:

```ts
/** Fetch the live pet-def catalog; swap into the active registry + cache only if valid.
 *  Errors / invalid / absent → keep the current registry (built-ins or last-good cache). */
export async function hydratePetDefs(): Promise<void> {
  try {
    const live = await fetchPetDefs();
    if (live && validatePetDefs(live).ok) {
      setActivePetDefs(live);
      cache.writePetDefsCache(live);
    }
  } catch { /* offline / permission / absent — keep current fallback */ }
}
```

- [ ] **Step 6: Run the test + type gate**

Run: `npx vitest run src/content/load.test.ts`
Expected: PASS.

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/content/cache.ts src/firebase/content.ts src/content/load.ts src/content/load.test.ts
git commit -m "feat(content): petDefs cache + Firestore fetch/save + hydratePetDefs"
```

---

## Task 7: Wire startup hydration

Seed the registry from cache for instant first paint, then kick the live fetch — mirroring `main.tsx`'s `hydrateCourse('default')`.

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Update `src/main.tsx`**

Add imports near the existing `import { hydrateCourse } from './content/load'` (line 9):

```ts
import { hydratePetDefs } from './content/load'
import { cachedPetDefs, BUILTIN_PET_DEFS, setActivePetDefs } from './content/load' // see note
```

> `BUILTIN_PET_DEFS` / `setActivePetDefs` live in `../domain/petDef`, and `cachedPetDefs` is re-exported from `./content/load`. Import each from its real source — `setActivePetDefs`/`BUILTIN_PET_DEFS` from `./domain/petDef`, `cachedPetDefs` + `hydratePetDefs` from `./content/load`. Adjust the two import lines accordingly.

Near the existing `void hydrateCourse('default')` (line 22), add:

```ts
// Seed the pet-def registry from last-good cache (instant), then live-fetch → swap + cache.
setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])
void hydratePetDefs()
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(content): seed pet-def registry from cache + hydrate at startup"
```

---

## Task 8: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all green (819+ existing + the new petDef / migrate / validate / hydrate / backfill tests).

- [ ] **Step 2: Type gate**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Confirm `firebase.json` is NOT staged**

Run: `git status --short`
Expected: `firebase.json` may show as ` M` (modified, unstaged) — leave it. Confirm no `A`/`M` staged entries remain after the task commits. Nothing else unexpected staged.

- [ ] **Step 5: Manual smoke (offline-safe)**

Run: `npm run dev` and load the app. Confirm: a new game shows the starter egg (leaf), the pet renders (never blank), and no console errors about pet defs. Existing saves still load (migrate runs). The catalog falls back to built-ins when Firestore has no `content/petDefs` doc.

---

## Self-Review (completed during authoring)

- **Spec coverage:** PetDef type + defId (Task 1–2) ✓; built-in registry + data-driven resolution (Task 1) ✓; Firestore single-doc + validate + hydrate/cache, built-in fallback (Tasks 5–7) ✓; migration v15→16 + cloud backfill (Tasks 3–4) ✓; starter data-driven (Task 1 `starter` flag, Task 3 `freshPet`) ✓; per-rarity statBands from gacha (Task 1) ✓; consumers unchanged / thin P1 (no gacha/sprite rewire) ✓; out-of-scope items (sprites, admin UI, gacha pool, `firebase.json`) untouched ✓.
- **Placeholder scan:** none — every step has concrete code/commands. The only conditional instructions ("if tsc flags other files", "match the file's mocking style") point at real, enumerated follow-through, not deferred design.
- **Type consistency:** `defId` (string), `PetDef.statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>`, helper names (`defaultDefForElement`, `starterDef`, `resolvePetDef`, `getActivePetDefs`/`setActivePetDefs`, `BUILTIN_PET_DEFS`, `cachedPetDefs`/`writePetDefsCache`/`PET_DEFS_CACHE_KEY`, `fetchPetDefs`/`savePetDefs`, `hydratePetDefs`, `validatePetDefs`) are used identically across tasks. Built-in ids `def-<element>`; starter `def-leaf`.
