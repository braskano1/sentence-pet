# Generational Pet Dex — P2a (Model + Validation + Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen `PetDef` into a generation-aware Pokédex model (gens, per-gen dex numbers, an expandable type taxonomy, evolution-chain structure), extend validation, and migrate older stored/cached catalogs forward — all with no UI.

**Architecture:** `PetDef` v2 gains `gen` / `dexNo` / `types` (required) and `evolvesFromId` / `evolvesToId` / `evolutionStage` (optional). A new `PetType` registry decouples the battle-type taxonomy from the 4 art-family `Species`. `validatePetDefs` enforces the new invariants (gen/dexNo, `(gen,dexNo)` uniqueness, type membership, evolution referential integrity + no cycles, starter pinned to gen 1 / dex 1). A pure `backfillPetDefs` runs on raw data **before** validation inside both `cachedPetDefs()` and `hydratePetDefs()`, so pre-v2 catalogs load instead of being rejected to built-ins.

**Tech Stack:** TypeScript, Vitest. Repo `sentence-pet`, branch `journey-redesign` (commit here; do NOT merge to `main`). Type gate: `npx tsc -b` (NOT `--noEmit`). Tests: `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md`

**Scope note:** This is **P2a** of the P2 epic. **P2b** (the `PetsTab` authoring UI) is a separate plan written after P2a ships. P3 (sprites) and P4 (gacha/obtainability/evolution execution) are later.

---

## File Structure

- **Create** `src/domain/petType.ts` — the expandable `PetType` registry (`PET_TYPES`, `isPetType`). Seeded from `SPECIES`. One responsibility: the type taxonomy.
- **Create** `src/domain/petType.test.ts` — registry tests.
- **Create** `src/content/petDefMigrate.ts` — pure `backfillPetDefs(raw)` that fills v2 defaults on pre-v2 defs. One responsibility: forward migration.
- **Create** `src/content/petDefMigrate.test.ts` — backfill tests.
- **Modify** `src/data/types.ts` — add `PetType` alias; extend the `PetDef` interface with v2 fields.
- **Modify** `src/domain/petDef.ts` — update `BUILTIN_PET_DEFS` to v2 (`gen`/`dexNo`/`types`).
- **Modify** `src/domain/petDef.test.ts` — assert the new built-in fields.
- **Modify** `src/content/validate.ts` — extend `validatePetDefs` with the new rules.
- **Modify** `src/content/validate.test.ts` — tests for each new rule.
- **Modify** `src/content/cache.ts` — `cachedPetDefs()` backfills before validate.
- **Modify** `src/content/load.ts` — `hydratePetDefs()` backfills before validate.

---

## Task 1: `PetType` registry

**Files:**
- Modify: `src/data/types.ts` (add `PetType` alias near `Species`)
- Create: `src/domain/petType.ts`
- Create: `src/domain/petType.test.ts`

- [ ] **Step 1: Add the `PetType` alias to `src/data/types.ts`**

Insert immediately after the `Species` definition (currently `src/data/types.ts:102`):

```ts
/** Expandable battle-type taxonomy id. Decoupled from the 4 art-family `Species`;
 *  membership is checked against the PET_TYPES registry in domain/petType.ts. */
export type PetType = string;
```

- [ ] **Step 2: Write the failing test** — create `src/domain/petType.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { PET_TYPES, isPetType } from './petType';
import { SPECIES } from './species';

describe('PetType registry', () => {
  it('is seeded from the 4 element names', () => {
    expect([...PET_TYPES].sort()).toEqual([...SPECIES].sort());
  });

  it('isPetType accepts a registered type and rejects an unknown one', () => {
    expect(isPetType('leaf')).toBe(true);
    expect(isPetType('dragon')).toBe(false);
    expect(isPetType('')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/domain/petType.test.ts`
Expected: FAIL — cannot resolve `./petType`.

- [ ] **Step 4: Implement** — create `src/domain/petType.ts`

```ts
import type { PetType } from '../data/types';
import { SPECIES } from './species';

/** Expandable battle-type taxonomy. Seeded from the 4 element names so existing
 *  data + the built-ins map cleanly; extend this list to add new types later.
 *  Kept separate from `element: Species`, which remains the art-family / sprite source. */
export const PET_TYPES: readonly PetType[] = [...SPECIES];

/** True if `t` is a registered pet type. */
export function isPetType(t: string): t is PetType {
  return PET_TYPES.includes(t);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- src/domain/petType.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/domain/petType.ts src/domain/petType.test.ts
git commit -m "feat(petdef): add expandable PetType registry seeded from elements"
```

---

## Task 2: Extend `PetDef` to v2 + update built-ins

This task changes the `PetDef` interface, which makes `BUILTIN_PET_DEFS` fail to type-check until updated — so both change together. No behavior depends on the new fields yet; the test just locks the built-in values.

**Files:**
- Modify: `src/data/types.ts:114-121` (the `PetDef` interface)
- Modify: `src/domain/petDef.ts:23-30` (`BUILTIN_PET_DEFS`)
- Modify: `src/domain/petDef.test.ts` (assert new built-in fields)

- [ ] **Step 1: Extend the `PetDef` interface in `src/data/types.ts`**

Replace the existing interface (`src/data/types.ts:114-121`) with:

```ts
export interface PetDef {
  id: string;
  name: string;
  gen: number;              // generation; >= 1
  dexNo: number;            // index within its gen; (gen, dexNo) unique across the catalog
  types: PetType[];         // >= 1; each a member of the PET_TYPES registry
  element: Species;         // art-family / fallback sprite source (1 of 4) until P3
  statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>;
  evolvesFromId?: string;   // ref to another PetDef.id
  evolvesToId?: string;     // ref to another PetDef.id
  evolutionStage?: number;  // 1-based stage in its chain
  starter?: boolean;        // exactly one def true; must be the gen 1, dexNo 1 def
  enabled: boolean;         // gacha-pool gate; P2 stores only, P4 reads it
}
```

- [ ] **Step 2: Write the failing test** — add to `src/domain/petDef.test.ts` inside the existing `describe('BUILTIN_PET_DEFS', ...)` block

```ts
  it('assigns gen 1, sequential dexNo, and element-derived types', () => {
    expect(BUILTIN_PET_DEFS.every((d) => d.gen === 1)).toBe(true);
    expect(BUILTIN_PET_DEFS.map((d) => d.dexNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    for (const d of BUILTIN_PET_DEFS) expect(d.types).toEqual([d.element]);
  });

  it('pins the starter to gen 1, dexNo 1', () => {
    const starter = BUILTIN_PET_DEFS.find((d) => d.starter)!;
    expect(starter.gen).toBe(1);
    expect(starter.dexNo).toBe(1);
  });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/domain/petDef.test.ts`
Expected: FAIL — built-ins lack `gen`/`dexNo`/`types` (and `tsc` would also flag the missing required fields).

- [ ] **Step 4: Update `BUILTIN_PET_DEFS` in `src/domain/petDef.ts`**

Replace the `BUILTIN_PET_DEFS` definition (`src/domain/petDef.ts:22-30`) with:

```ts
/** One built-in def per fixed element. Leaf (dexNo 1) is the gen-1 starter. All enabled. */
export const BUILTIN_PET_DEFS: readonly PetDef[] = SPECIES.map((element, i): PetDef => ({
  id: `def-${element}`,
  name: ELEMENT_NAME[element],
  gen: 1,
  dexNo: i + 1,
  types: [element],
  element,
  statBands: bandsFromGacha(),
  ...(i === 0 ? { starter: true } : {}),
  enabled: true,
}));
```

(`SPECIES` is `['leaf','fire','air','water']`, so `i === 0` is `leaf` — the prior starter — now at `dexNo 1`.)

- [ ] **Step 5: Run tests + type gate**

Run: `npm test -- src/domain/petDef.test.ts` → Expected: PASS (existing + 2 new).
Run: `npx tsc -b` → Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/domain/petDef.ts src/domain/petDef.test.ts
git commit -m "feat(petdef): PetDef v2 fields (gen/dexNo/types/evolution); built-ins to gen 1 dex"
```

---

## Task 3: Extend `validatePetDefs`

**Files:**
- Modify: `src/content/validate.ts:1-3` (imports), `:128-158` (the function)
- Modify: `src/content/validate.test.ts` (new-rule tests + helper)

- [ ] **Step 1: Write the failing tests** — in `src/content/validate.test.ts`, add inside the existing `describe('validatePetDefs', ...)` block (the `clone()` helper at line 216 returns v2 built-ins, so it already carries `gen`/`dexNo`/`types`)

```ts
  it('rejects gen < 1 or dexNo < 1', () => {
    const a = clone(); a[0].gen = 0; expect(validatePetDefs(a).ok).toBe(false);
    const b = clone(); b[0].dexNo = 0; expect(validatePetDefs(b).ok).toBe(false);
  });

  it('rejects a duplicate (gen, dexNo)', () => {
    const defs = clone();
    defs[1].gen = defs[0].gen; defs[1].dexNo = defs[0].dexNo;
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects empty or unknown types', () => {
    const empty = clone(); empty[0].types = []; expect(validatePetDefs(empty).ok).toBe(false);
    const bad = clone(); bad[0].types = ['dragon']; expect(validatePetDefs(bad).ok).toBe(false);
  });

  it('rejects a dangling evolution ref', () => {
    const defs = clone();
    defs[0].evolvesToId = 'does-not-exist';
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects an evolution cycle', () => {
    const defs = clone();
    defs[0].evolvesToId = defs[1].id;
    defs[1].evolvesToId = defs[0].id;
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects a non-increasing evolutionStage along a chain', () => {
    const defs = clone();
    defs[0].evolvesToId = defs[1].id;
    defs[0].evolutionStage = 2; defs[1].evolutionStage = 1;
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('accepts a valid two-stage evolution chain', () => {
    const defs = clone();
    defs[0].evolvesToId = defs[1].id; defs[1].evolvesFromId = defs[0].id;
    defs[0].evolutionStage = 1; defs[1].evolutionStage = 2;
    expect(validatePetDefs(defs)).toEqual({ ok: true, errors: [] });
  });

  it('rejects a starter that is not gen 1 / dexNo 1', () => {
    const defs = clone();
    const starter = defs.find((d) => d.starter)!;
    starter.dexNo = 5;
    expect(validatePetDefs(defs).ok).toBe(false);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/content/validate.test.ts`
Expected: FAIL — the new rules are not implemented yet (most assertions return `ok: true`).

- [ ] **Step 3: Add the `isPetType` import to `src/content/validate.ts`**

Below the existing `import { SPECIES } from '../domain/species';` (line 4), add:

```ts
import { isPetType } from '../domain/petType';
```

- [ ] **Step 4: Replace `validatePetDefs`** (`src/content/validate.ts:127-158`) with:

```ts
/** Structural validation for the pet-def catalog. Mirrors validateCourse's gate-before-save discipline. */
export function validatePetDefs(defs: PetDef[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  const ids = defs.map((d) => d.id);
  if (new Set(ids).size !== ids.length) push('duplicate pet-def ids');

  const idSet = new Set(ids);
  const seenGenDex = new Set<string>();

  for (const d of defs) {
    if (!d.id || d.id.trim() === '') push('pet-def has empty id');
    if (!d.name || d.name.trim() === '') push(`pet-def ${d.id} name is empty`);
    if (!SPECIES.includes(d.element)) push(`pet-def ${d.id} element ${String(d.element)} is not one of the fixed four`);

    if (typeof d.gen !== 'number' || d.gen < 1) push(`pet-def ${d.id} gen must be >= 1`);
    if (typeof d.dexNo !== 'number' || d.dexNo < 1) push(`pet-def ${d.id} dexNo must be >= 1`);
    const gd = `${d.gen}:${d.dexNo}`;
    if (seenGenDex.has(gd)) push(`pet-def ${d.id} duplicate (gen ${d.gen}, dexNo ${d.dexNo})`);
    seenGenDex.add(gd);

    if (!Array.isArray(d.types) || d.types.length === 0) push(`pet-def ${d.id} must have at least one type`);
    else for (const t of d.types) if (!isPetType(t)) push(`pet-def ${d.id} unknown type ${String(t)}`);

    for (const r of RARITY_KEYS) {
      const band = d.statBands?.[r];
      if (!band) { push(`pet-def ${d.id} missing stat bands for rarity ${r}`); continue; }
      for (const stat of PETDEF_STAT_KEYS) {
        const range = band[stat];
        if (!range) { push(`pet-def ${d.id} ${r}.${stat} band missing`); continue; }
        const [min, max] = range;
        if (typeof min !== 'number' || typeof max !== 'number') push(`pet-def ${d.id} ${r}.${stat} band not numeric`);
        else if (min > max) push(`pet-def ${d.id} ${r}.${stat} band min > max`);
        else if (min < 0) push(`pet-def ${d.id} ${r}.${stat} band min < 0`);
      }
    }

    if (d.evolvesFromId !== undefined && !idSet.has(d.evolvesFromId)) push(`pet-def ${d.id} evolvesFromId ${d.evolvesFromId} is unknown`);
    if (d.evolvesToId !== undefined && !idSet.has(d.evolvesToId)) push(`pet-def ${d.id} evolvesToId ${d.evolvesToId} is unknown`);
    if (d.evolutionStage !== undefined && (typeof d.evolutionStage !== 'number' || d.evolutionStage < 1)) push(`pet-def ${d.id} evolutionStage must be >= 1`);
  }

  // Walk evolvesToId chains: detect cycles and non-increasing stages.
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const start of defs) {
    let cur: PetDef | undefined = start;
    const walked = new Set<string>();
    while (cur && cur.evolvesToId !== undefined) {
      if (walked.has(cur.id)) break; // already traversed (cycle not through start)
      walked.add(cur.id);
      const next = byId.get(cur.evolvesToId);
      if (!next) break; // dangling ref already reported above
      if (next.id === start.id) { push(`pet-def evolution cycle through ${start.id}`); break; }
      if (cur.evolutionStage !== undefined && next.evolutionStage !== undefined && next.evolutionStage <= cur.evolutionStage) {
        push(`pet-def ${next.id} evolutionStage must exceed ${cur.id}`);
      }
      cur = next;
    }
  }

  const starterDefs = defs.filter((d) => d.starter);
  if (starterDefs.length !== 1) push(`expected exactly one starter pet-def, found ${starterDefs.length}`);
  else if (starterDefs[0].gen !== 1 || starterDefs[0].dexNo !== 1) push(`starter pet-def ${starterDefs[0].id} must be gen 1, dexNo 1`);

  if (!defs.some((d) => d.enabled)) push('no pet-def is enabled');

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 5: Run tests + type gate**

Run: `npm test -- src/content/validate.test.ts` → Expected: PASS (existing + 8 new).
Run: `npx tsc -b` → Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(petdef): validate gen/dexNo, types, evolution refs+cycles, starter placement"
```

---

## Task 4: Forward migration (`backfillPetDefs`) + wire into load paths

`validatePetDefs` gates both `cachedPetDefs()` and `hydratePetDefs()`. With the new required fields, a pre-v2 stored/cached catalog would now fail validation and be discarded to built-ins. Backfilling the v2 defaults on raw data **before** validation preserves it.

**Files:**
- Create: `src/content/petDefMigrate.ts`
- Create: `src/content/petDefMigrate.test.ts`
- Modify: `src/content/cache.ts:53-62` (`cachedPetDefs`)
- Modify: `src/content/load.ts:52-60` (`hydratePetDefs`)

- [ ] **Step 1: Write the failing test** — create `src/content/petDefMigrate.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { backfillPetDefs } from './petDefMigrate';
import { validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';

// A pre-v2 catalog: built-ins stripped of gen/dexNo/types.
function preV2() {
  return BUILTIN_PET_DEFS.map((d) => {
    const { gen: _g, dexNo: _x, types: _t, ...rest } = d;
    return { ...rest };
  });
}

describe('backfillPetDefs', () => {
  it('fills gen 1, sequential dexNo, and element-derived types on pre-v2 defs', () => {
    const out = backfillPetDefs(preV2() as never);
    expect(out.every((d) => d.gen === 1)).toBe(true);
    expect(out.map((d) => d.dexNo)).toEqual([1, 2, 3, 4]);
    for (const d of out) expect(d.types).toEqual([d.element]);
  });

  it('produces a catalog that passes validatePetDefs', () => {
    expect(validatePetDefs(backfillPetDefs(preV2() as never)).ok).toBe(true);
  });

  it('preserves already-present v2 fields', () => {
    const out = backfillPetDefs(BUILTIN_PET_DEFS as never);
    expect(out).toEqual(BUILTIN_PET_DEFS);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/content/petDefMigrate.test.ts`
Expected: FAIL — cannot resolve `./petDefMigrate`.

- [ ] **Step 3: Implement** — create `src/content/petDefMigrate.ts`

```ts
import type { PetDef, Species } from '../data/types';

/** A stored/cached pet-def that may predate v2 (missing gen/dexNo/types). */
export type RawPetDef = Partial<PetDef> & { id: string; element: Species };

/** Backfill v2 fields on pre-v2 pet-defs so an older stored/cached catalog
 *  validates and loads instead of being rejected to the built-ins. Deterministic:
 *  gen 1, dexNo by array order, types from the def's element. Already-set fields win. */
export function backfillPetDefs(raw: readonly RawPetDef[]): PetDef[] {
  return raw.map((d, i) => ({
    ...d,
    gen: typeof d.gen === 'number' ? d.gen : 1,
    dexNo: typeof d.dexNo === 'number' ? d.dexNo : i + 1,
    types: Array.isArray(d.types) && d.types.length > 0 ? d.types : [d.element],
  })) as PetDef[];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- src/content/petDefMigrate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire backfill into `cachedPetDefs`** — replace `src/content/cache.ts:53-62` with:

```ts
/** Last-good cached pet-def catalog (backfilled to v2), or null if absent/corrupt/invalid. */
export function cachedPetDefs(): PetDef[] | null {
  try {
    const raw = localStorage.getItem(PET_DEFS_CACHE_KEY);
    if (!raw) return null;
    const parsed = backfillPetDefs(JSON.parse(raw) as RawPetDef[]);
    return validatePetDefs(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}
```

Add the import near the top of `src/content/cache.ts` (below the existing `import { validateContent, validateCourse, validatePetDefs } from './validate';`):

```ts
import { backfillPetDefs, type RawPetDef } from './petDefMigrate';
```

- [ ] **Step 6: Wire backfill into `hydratePetDefs`** — replace `src/content/load.ts:52-60` with:

```ts
/** Fetch the live pet-def catalog; backfill to v2, then swap into the active registry
 *  + cache only if valid. Errors / invalid / absent → keep the current registry. */
export async function hydratePetDefs(): Promise<void> {
  try {
    const live = await fetchPetDefs();
    if (live) {
      const migrated = backfillPetDefs(live);
      if (validatePetDefs(migrated).ok) {
        setActivePetDefs(migrated);
        cache.writePetDefsCache(migrated);
      }
    }
  } catch { /* offline / permission / absent — keep current fallback */ }
}
```

Add the import near the top of `src/content/load.ts` (below `import * as cache from './cache';`):

```ts
import { backfillPetDefs } from './petDefMigrate';
```

- [ ] **Step 7: Run the full suite + type gate**

Run: `npm test` → Expected: all green (incl. `load.test.ts`, which exercises `hydratePetDefs`).
Run: `npx tsc -b` → Expected: no errors.
Run: `npm run build` → Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/content/petDefMigrate.ts src/content/petDefMigrate.test.ts src/content/cache.ts src/content/load.ts
git commit -m "feat(petdef): backfill pre-v2 catalogs to v2 before validation in cache + hydrate"
```

---

## Final verification

- [ ] `npm test` — full suite green.
- [ ] `npx tsc -b` — clean.
- [ ] `npm run build` — succeeds.
- [ ] Confirm no `PERSIST_VERSION` bump was needed (no `PetInstance` field changed). If a task touched persistence, run BOTH `gameStore.test.ts` and `gameStore.persisted.test.ts`.
- [ ] Confirm `firebase.json` is NOT staged in any commit.

---

## Self-Review (completed by author)

**Spec coverage:** model v2 fields → T2; PetType registry → T1; validate additions (gen/dexNo, `(gen,dexNo)` unique, types membership, evolution refs+cycles+stage, starter at gen1/dex1) → T3; migration (builtins + runtime backfill, no PERSIST bump) → T2 (builtins) + T4 (backfill). Authoring UI is explicitly P2b (out of this plan). ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `PetType` defined in `types.ts` (T1) and consumed by `petType.ts` (T1) + `validate.ts` (T3); `RawPetDef`/`backfillPetDefs` defined in `petDefMigrate.ts` (T4) and consumed by `cache.ts` + `load.ts` (T4); `BUILTIN_PET_DEFS` v2 shape (T2) matches the interface (T2) and feeds validate/migrate tests (T3/T4). ✓
