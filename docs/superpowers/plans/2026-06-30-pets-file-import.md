# Pets File-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an xlsx `Pets` sheet importer to the admin PetsTab — mirroring the shipped Items/Bosses/Units ImportDrawer pattern — so a content author can additively import pet definitions, then document it in `docs/authoring/pets.md`.

**Architecture:** A new pure module `src/content/petImport.ts` parses a `Pets` sheet into `PetDef[]` (Decision 2 = base-band → derived rarities: one base stat range per row, four rarity bands derived via the gacha table's own offsets, reproducing `bandsFromGacha()` when the base is omitted). A `surface()`-style `importPets` adapter filters errors to the `Pets` sheet. PetsTab gains an `Import…` button + `ImportDrawer<PetDef>` whose apply merges into the existing `draft` state, so the already-present `validatePetDefs` SaveBar gate enforces catalog-wide invariants (single starter at gen1/dexNo1, `(gen,dexNo)` uniqueness, evolution refs) on the merged set before any Firestore write.

**Tech Stack:** TypeScript, React 19, vitest, @testing-library/react, xlsx (SheetJS), Zustand. Build gate: `npx tsc -b`. Test: `npx vitest run <file>`.

**Locked decisions (from the 2026-06-30 session, confirmed via live visual comparison):**
- **D1 output format = TSV** (already shipped in Stream A guides).
- **D2 statBands encoding = (b) base band → derived rarities.** One optional base range per pet; the four rarities are derived by adding each rarity's offset-from-common (taken from `GAME_CONFIG.gacha.rarities`) to the base. Omit the base → every rarity equals the gacha table band (identical to `bandsFromGacha()`, i.e. exactly what every builtin pet is). All five stats share one band per rarity. Per-stat asymmetry is a documented v1 limit (tune in the admin editor).

**Ground truth (verified 2026-06-30):**
- `src/content/excelImport.ts` — `str`/`num`/`bool`/`csv` helper *style* (not exported; petImport defines its own).
- `src/domain/petDef.ts:6-18` — `bandsFromGacha()` builds `Record<Rarity, Record<stat, StatRange>>` from `GAME_CONFIG.gacha.rarities`; all five stats share `tier.band`.
- `src/config/gameConfig.ts:46-50` — `gacha.rarities`: `common [40,60]`, `rare [55,75]`, `epic [72,88]`, `legendary [85,90]`.
- `src/content/validate.ts:153` — `validatePetDefs(defs)`: dup ids; empty id/name; `element` ∈ 4; `gen`/`dexNo` ≥1 + `(gen,dexNo)` unique; `types` non-empty + each `isPetType`; statBands present ALL 4 rarities × 5 stats, numeric `min ≤ max`, `min ≥ 0`; evolves refs resolve; stages strictly increase, no cycles; exactly one starter at gen1/dexNo1; ≥1 enabled; sprite urls valid http(s).
- `src/data/types.ts:110-145` — `StatRange = readonly [min,max]`; `PetDef` shape.
- `src/domain/petType.ts` — `isPetType`, `PET_TYPES` (= the 4 element names today).
- `src/domain/species.ts` — `SPECIES` = `['leaf','fire','air','water']` (the valid `element` set; confirm order at Task 2).
- `src/content/surfaceImport.ts` — `SurfaceImport<T>` + private `surface()` helper (own-sheet error-prefix discipline to copy).
- `src/components/admin/PoolTab.tsx:12-15,67-75,114-124` — canonical `defaultParse*File` + `Import…` button + `ImportDrawer` wiring + `applyImport`.
- `src/components/admin/PetsTab.tsx` — target. `draft`/`setDraft`, `reconciled = reconcileEvolution(draft)`, `validation = validatePetDefs(reconciled)`, SaveBar gates on `validation.ok`. Apply target = `setDraft(merged)`.

**Hazards (carry into every task):**
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (the PowerShell tool's cwd resolves wrong and resets each call). In Bash, `@'...'@` is NOT a heredoc — use `git commit -F- <<'EOF'` for multi-line messages.
- `npx tsc -b`, never `--noEmit`.
- Stage explicit files; never `git add -A` (concurrent-session contamination).
- **Append** to existing `*.test.*` files; never overwrite (a prior session clobbered test files twice — caught only in review).
- Admin styling tokens stay scoped to `.admin-root`; never touch global `@theme`.
- Branch: do this work on `import-authoring-guides` (Stream A already committed there) OR a fresh `pets-import` off `main` — confirm with the reviewer before Task 1. This plan assumes the current `import-authoring-guides` branch continues.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/content/petImport.ts` | Create | Pure: `deriveStatBands`, `parsePetsSheet`, `importPets`. No IO, no React. |
| `src/content/petImport.test.ts` | Create | Unit tests for all three exports. |
| `src/components/admin/PetsTab.tsx` | Modify | Add `Import…` button + `ImportDrawer<PetDef>` + `applyImport`. |
| `src/components/admin/PetsTab.test.tsx` | Create or Append | Wiring test (apply merges into draft; injected `parsePetsFile`). |
| `docs/authoring/pets.md` | Create | The Pets authoring guide (TSV; base-band encoding). |
| `docs/authoring/README.md` | Modify | Flip the Pets row from "coming" to live; add `Pets` to sheet list. |
| `src/content/authoring-guides.contract.test.ts` | Append | Add a Pets dry-run: cold-AI TSV → `importPets` → `validatePetDefs` clean. |

---

## Task 1: `deriveStatBands` — base range → 4 rarity bands

**Files:**
- Create: `src/content/petImport.ts`
- Test: `src/content/petImport.test.ts`

**Why this rule:** the gacha table bands are absolute, not multiples. We derive by *additive offset from the table's own common band*: `offset[r] = gachaBand[r] − gachaBand.common` per endpoint. Then `derived[r] = [base.min + offset[r].min, base.max + offset[r].max]` (clamped ≥0). With `base = gacha common ([40,60])` this reproduces the gacha table exactly, so an omitted base yields identical statBands to every builtin pet. All five stats share the band.

- [ ] **Step 1: Write the failing test**

Create `src/content/petImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveStatBands } from './petImport';
import { GAME_CONFIG } from '../config/gameConfig';

const common = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'common')!.band;

describe('deriveStatBands', () => {
  it('base = gacha common reproduces the gacha table for every rarity & stat', () => {
    const bands = deriveStatBands([common[0], common[1]]);
    for (const tier of GAME_CONFIG.gacha.rarities) {
      for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
        expect(bands[tier.rarity][stat]).toEqual([tier.band[0], tier.band[1]]);
      }
    }
  });

  it('shifts every rarity by the same delta when the base shifts', () => {
    const bands = deriveStatBands([common[0] + 10, common[1] + 10]);
    const rare = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'rare')!.band;
    expect(bands.rare.hp).toEqual([rare[0] + 10, rare[1] + 10]);
  });

  it('clamps a derived min below zero up to zero', () => {
    const bands = deriveStatBands([0, 5]);
    expect(bands.common.hp[0]).toBe(0);
    expect(bands.common.hp[0]).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: FAIL — "deriveStatBands is not a function" / module has no such export.

- [ ] **Step 3: Write minimal implementation**

Create `src/content/petImport.ts`:

```ts
import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, Rarity, StatRange } from '../data/types';

const STAT_KEYS: ReadonlyArray<keyof BattleStats> = ['hp', 'atk', 'def', 'spd', 'luk'];

/** Per-rarity offset of the gacha band from the gacha *common* band. */
function rarityOffsets(): Record<Rarity, [number, number]> {
  const rarities = GAME_CONFIG.gacha.rarities;
  const common = rarities.find((r) => r.rarity === 'common')!.band;
  const out = {} as Record<Rarity, [number, number]>;
  for (const tier of rarities) {
    out[tier.rarity] = [tier.band[0] - common[0], tier.band[1] - common[1]];
  }
  return out;
}

/**
 * Build the full 4-rarity × 5-stat band table from a single base range.
 * Each rarity = base + that rarity's offset-from-common (from the gacha table),
 * clamped so min >= 0. All five stats share the rarity band (matches builtins).
 * base = gacha common reproduces bandsFromGacha() exactly.
 */
export function deriveStatBands(base: StatRange): Record<Rarity, Record<keyof BattleStats, StatRange>> {
  const offsets = rarityOffsets();
  const out = {} as Record<Rarity, Record<keyof BattleStats, StatRange>>;
  for (const rarity of Object.keys(offsets) as Rarity[]) {
    const [offMin, offMax] = offsets[rarity];
    const min = Math.max(0, base[0] + offMin);
    const max = Math.max(min, base[1] + offMax);
    const band: StatRange = [min, max];
    out[rarity] = { hp: band, atk: band, def: band, spd: band, luk: band };
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/content/petImport.ts src/content/petImport.test.ts && git commit -F- <<'EOF'
feat(petImport): deriveStatBands — base range to 4 rarity bands

Decision 2 encoding: one base stat range derives the full
4-rarity × 5-stat band table via the gacha table's own offsets.
base = gacha common reproduces bandsFromGacha() exactly, so an
omitted base yields builtin-identical stats.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 2: `parsePetsSheet` — `Pets` sheet → `PetDef[]`

**Files:**
- Modify: `src/content/petImport.ts`
- Test: `src/content/petImport.test.ts` (append)

**Columns (v1):** `id`✅, `name`✅, `gen`✅(≥1), `dexNo`✅(≥1), `types`✅(CSV, ≥1), `element`✅(1 of 4), `base_min`/`base_max`(opt → gacha common), `enabled`(bool, default true), `starter`(bool, opt), `rarity`(opt: common|rare|epic|legendary), `gachaObtainable`(bool, opt), `evolvesFromId`/`evolvesToId`(opt), `evolutionStage`(opt num), `spriteDefault`(opt url). Variants out of scope (v1). Tolerant: absent sheet → empty. Structural cross-catalog rules (uniqueness, single starter, evolution) are left to `validatePetDefs`; this parser only reports per-row shape errors, prefixed `Pets row N:`.

- [ ] **Step 1: Write the failing test (append to `src/content/petImport.test.ts`)**

```ts
import * as XLSX from 'xlsx';
import { parsePetsSheet } from './petImport';
import { validatePetDefs } from './validate';

function wbWithPets(tsv: string): XLSX.WorkBook {
  const aoa = tsv.split('\n').map((l) => l.split('\t'));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Pets');
  return wb;
}

describe('parsePetsSheet', () => {
  it('absent Pets sheet → empty, no errors', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    expect(parsePetsSheet(wb)).toEqual({ defs: [], errors: [] });
  });

  it('parses a full row and derives statBands from the base range', () => {
    const { defs, errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tbase_min\tbase_max\tenabled\tstarter\n' +
      'def-sprig\tSprig\t1\t1\tleaf\tleaf\t40\t60\ttrue\ttrue',
    ));
    expect(errors).toEqual([]);
    expect(defs).toHaveLength(1);
    const d = defs[0];
    expect(d.id).toBe('def-sprig');
    expect(d.types).toEqual(['leaf']);
    expect(d.statBands.common.hp).toEqual([40, 60]);
    expect(d.statBands.legendary.hp).toEqual([85, 90]); // derived
    expect(d.starter).toBe(true);
    expect(d.enabled).toBe(true);
  });

  it('omitted base columns → gacha-table statBands (builtin-identical)', () => {
    const { defs } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-x\tEx\t1\t1\tfire\tfire',
    ));
    expect(defs[0].statBands.common.hp).toEqual([40, 60]);
    expect(defs[0].statBands.epic.hp).toEqual([72, 88]);
  });

  it('reports per-row shape errors prefixed "Pets row N:"', () => {
    const { errors } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      '\tNoId\t1\t1\tleaf\tleaf\n' +          // row 2: missing id
      'def-b\tB\t1\t1\t\tleaf\n' +            // row 3: empty types
      'def-c\tC\t0\t1\tleaf\twind',           // row 4: gen<1 + bad element
    ));
    expect(errors.some((e) => e.startsWith('Pets row 2:') && /id/.test(e))).toBe(true);
    expect(errors.some((e) => e.startsWith('Pets row 3:') && /type/.test(e))).toBe(true);
    expect(errors.some((e) => e.startsWith('Pets row 4:'))).toBe(true);
  });

  it('parsed defs merged with builtins pass validatePetDefs', () => {
    // A new non-starter, enabled pet at a free (gen,dexNo) added to builtins.
    const { defs } = parsePetsSheet(wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\tenabled\n' +
      'def-new\tNewbie\t2\t1\twater\twater\ttrue',
    ));
    // Builtins occupy gen1/dex1..4 incl. the one starter; def-new at gen2 is safe.
    // (Import-side merge tested in PetsTab; here just assert the def is well-formed.)
    const res = validatePetDefs(defs);
    // defs alone has no starter -> expect that specific error and nothing about shape.
    expect(res.errors).toContain('expected exactly one starter pet-def, found 0');
    expect(res.errors.some((e) => e.includes('def-new') && /band|type|element|gen|dexNo/.test(e))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: FAIL — `parsePetsSheet` is not exported.

- [ ] **Step 3: Implement (append to `src/content/petImport.ts`)**

First confirm the valid element set: open `src/domain/species.ts` and use `SPECIES`. Add imports at the top of the file:

```ts
import * as XLSX from 'xlsx';
import type { PetDef, PetType, Rarity, Species } from '../data/types';
import { SPECIES } from '../domain/species';
import { isPetType } from '../domain/petType';
```

(Adjust the existing `import type` line so `PetDef`, `PetType`, `Species` are included alongside `BattleStats`, `Rarity`, `StatRange`.)

Then append:

```ts
type Row = Record<string, unknown>;

const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const n = (v: unknown): number => Number(v);
const b = (v: unknown): boolean => v === true || s(v).toLowerCase() === 'true';
const list = (v: unknown): string[] => s(v).split(',').map((x) => x.trim()).filter(Boolean);

const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Parse a `Pets` sheet into PetDefs. Tolerant: absent sheet → empty. Pure: no IO.
 *  Reports per-row SHAPE errors (prefixed `Pets row N:`); cross-catalog invariants
 *  (uniqueness, single starter, evolution chains) are validatePetDefs's job. */
export function parsePetsSheet(wb: XLSX.WorkBook): { defs: PetDef[]; errors: string[] } {
  const errors: string[] = [];
  const ws = wb.Sheets['Pets'];
  if (!ws) return { defs: [], errors: [] };
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Row[];

  const common = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'common')!.band;
  const defs: PetDef[] = [];

  rows.forEach((r, i) => {
    const line = i + 2; // header is row 1
    const id = s(r.id);
    const name = s(r.name);
    if (!id) { errors.push(`Pets row ${line}: id is required`); return; }
    if (!name) errors.push(`Pets row ${line}: name is required`);

    const gen = n(r.gen);
    const dexNo = n(r.dexNo);
    if (!Number.isFinite(gen) || gen < 1) errors.push(`Pets row ${line}: gen must be a number >= 1`);
    if (!Number.isFinite(dexNo) || dexNo < 1) errors.push(`Pets row ${line}: dexNo must be a number >= 1`);

    const types = list(r.types) as PetType[];
    if (types.length === 0) errors.push(`Pets row ${line}: types is required (>= 1, comma-separated)`);
    else for (const t of types) if (!isPetType(t)) errors.push(`Pets row ${line}: unknown type "${t}"`);

    const element = s(r.element) as Species;
    if (!SPECIES.includes(element)) errors.push(`Pets row ${line}: element "${s(r.element)}" must be one of ${SPECIES.join('/')}`);

    // Base range: both present → use; both absent → gacha common; partial → error.
    const hasMin = s(r.base_min) !== '';
    const hasMax = s(r.base_max) !== '';
    let base: StatRange = [common[0], common[1]];
    if (hasMin !== hasMax) errors.push(`Pets row ${line}: base_min and base_max must both be set or both empty`);
    else if (hasMin && hasMax) {
      const lo = n(r.base_min); const hi = n(r.base_max);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) errors.push(`Pets row ${line}: base_min/base_max must be numbers`);
      else if (lo < 0) errors.push(`Pets row ${line}: base_min must be >= 0`);
      else if (lo > hi) errors.push(`Pets row ${line}: base_min must be <= base_max`);
      else base = [lo, hi];
    }

    const rarityRaw = s(r.rarity);
    if (rarityRaw && !RARITIES.includes(rarityRaw as Rarity)) errors.push(`Pets row ${line}: rarity "${rarityRaw}" must be one of ${RARITIES.join('/')}`);

    const def: PetDef = {
      id,
      name,
      gen,
      dexNo,
      types,
      element,
      statBands: deriveStatBands(base),
      enabled: s(r.enabled) === '' ? true : b(r.enabled),
      ...(b(r.starter) ? { starter: true } : {}),
      ...(rarityRaw && RARITIES.includes(rarityRaw as Rarity) ? { rarity: rarityRaw as Rarity } : {}),
      ...(s(r.gachaObtainable) !== '' ? { gachaObtainable: b(r.gachaObtainable) } : {}),
      ...(s(r.evolvesFromId) ? { evolvesFromId: s(r.evolvesFromId) } : {}),
      ...(s(r.evolvesToId) ? { evolvesToId: s(r.evolvesToId) } : {}),
      ...(s(r.evolutionStage) !== '' ? { evolutionStage: n(r.evolutionStage) } : {}),
      ...(s(r.spriteDefault) ? { sprite: { default: s(r.spriteDefault) } } : {}),
    };
    defs.push(def);
  });

  return { defs, errors };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: PASS (all tasks-1+2 tests).

- [ ] **Step 5: Type-check**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/content/petImport.ts src/content/petImport.test.ts && git commit -F- <<'EOF'
feat(petImport): parsePetsSheet — Pets sheet to PetDef[]

Tolerant per-row parser (absent sheet -> empty). Derives statBands
from an optional base range; reports per-row shape errors prefixed
"Pets row N:". Cross-catalog invariants stay validatePetDefs's job.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 3: `importPets` adapter

**Files:**
- Modify: `src/content/petImport.ts`
- Test: `src/content/petImport.test.ts` (append)

Mirrors `surfaceImport.ts`'s `surface()` discipline: surface only `Pets`-prefixed errors, and a "no rows" fallback message when the sheet yields nothing and no errors.

- [ ] **Step 1: Write the failing test (append)**

```ts
import { importPets } from './petImport';

describe('importPets', () => {
  it('returns entities + Pets-prefixed errors only', () => {
    const wb = wbWithPets(
      'id\tname\tgen\tdexNo\ttypes\telement\n' +
      'def-ok\tOk\t2\t1\tleaf\tleaf\n' +
      '\tBad\t1\t1\tleaf\tleaf',
    );
    const { entities, errors } = importPets(wb);
    expect(entities).toHaveLength(1);
    expect(entities[0].id).toBe('def-ok');
    expect(errors.every((e) => e.startsWith('Pets'))).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('absent/empty Pets sheet → empty entities + a "no rows" message', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const { entities, errors } = importPets(wb);
    expect(entities).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Pets/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: FAIL — `importPets` not exported.

- [ ] **Step 3: Implement (append to `src/content/petImport.ts`)**

Add the `SurfaceImport` import to the top type-import block: `import type { SurfaceImport } from './surfaceImport';` then append:

```ts
/** Pet defs from a `Pets` sheet (other sheets ignored). Surfaces only Pets-sheet
 *  errors; empty + clean → a "no rows" hint (matches the other surface adapters). */
export function importPets(wb: XLSX.WorkBook): SurfaceImport<PetDef> {
  const { defs, errors } = parsePetsSheet(wb);
  const own = errors.filter((e) => e.startsWith('Pets'));
  if (defs.length === 0 && own.length === 0) {
    return { entities: [], errors: ['No pet rows found. The file needs a "Pets" sheet.'] };
  }
  return { entities: defs, errors: own };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/petImport.test.ts`
Expected: PASS (all petImport tests).

- [ ] **Step 5: Type-check**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/content/petImport.ts src/content/petImport.test.ts && git commit -F- <<'EOF'
feat(petImport): importPets surface adapter

Pets-prefixed error filter + "no rows" fallback, mirroring the
Items/Bosses/Units surface adapters.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 4: Wire `ImportDrawer` into PetsTab

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx` — **this file EXISTS (verified 2026-06-30). APPEND the new `describe` block; do NOT overwrite. Re-run the whole file in Step 4 so the pre-existing PetsTab tests still pass.**

Apply path: `onApply(merged) → setDraft(merged)`. The existing `validation = validatePetDefs(reconcileEvolution(draft))` + SaveBar already block Save on any catalog-wide problem the import introduces (second starter, `(gen,dexNo)` collision, dangling evolution ref), so the importer needs no extra validation gate — the drawer shows parse errors, the SaveBar shows catalog errors.

- [ ] **Step 1: Write the failing test**

`PetsTab.test.tsx` already exists — APPEND this `describe` block at the end (some imports like `render`/`screen`/`PetsTab` may already be imported at the top; reuse them, don't redeclare). Add only the missing imports (`deriveStatBands`, `waitFor`, `fireEvent`, `vi` if absent).

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PetsTab } from './PetsTab';
import type { PetDef } from '../../data/types';
import { deriveStatBands } from '../../content/petImport';

function makeDef(over: Partial<PetDef>): PetDef {
  return { id: 'def-imp', name: 'Imported', gen: 3, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: deriveStatBands([40, 60]), enabled: true, ...over };
}

describe('PetsTab import wiring', () => {
  it('applies an imported pet additively into the draft', async () => {
    const parsePetsFile = vi.fn(async () => ({ entities: [makeDef({})], errors: [] }));
    render(<PetsTab parsePetsFile={parsePetsFile} />);

    // wait out the mount hydrate (loading… → list)
    await screen.findByText('Pets');
    fireEvent.click(await screen.findByRole('button', { name: /import/i }));

    const file = new File(['x'], 'pets.xlsx');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // Preview shows the new pet; applying merges it into the list.
    const apply = await screen.findByRole('button', { name: /apply/i });
    fireEvent.click(apply);
    await waitFor(() => expect(screen.getByText('Imported')).toBeInTheDocument());
    expect(parsePetsFile).toHaveBeenCalled();
  });
});
```

> Note: `PetsTab` currently takes no props. Step 3 adds an optional injectable `parsePetsFile` prop (default reads xlsx + `importPets`), exactly like PoolTab's `parseItemsFile`. The mount hydrate (`hydratePetDefs`) resolves offline without changing the registry, so the test sees the builtin catalog as `existing`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — `PetsTab` ignores `parsePetsFile` / no Import button.

- [ ] **Step 3: Implement the wiring**

In `src/components/admin/PetsTab.tsx`:

(a) Add imports near the top:

```ts
import * as XLSX from 'xlsx';
import { importPets } from '../../content/petImport';
import { Card, Button, SaveBar, ValidationSummary, SearchableList, FilterChips, ImportDrawer } from './ui';
```
(merge `ImportDrawer` into the existing `./ui` import line rather than duplicating it).

(b) Above the component, add the default parser:

```ts
async function defaultParsePetsFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importPets(wb);
}
```

(c) Change the signature to accept the injectable prop:

```ts
export function PetsTab({ parsePetsFile = defaultParsePetsFile }: {
  parsePetsFile?: (file: File) => Promise<{ entities: PetDef[]; errors: string[] }>;
} = {}) {
```

(d) Add import state next to the other `useState`s:

```ts
const [importing, setImporting] = useState(false);
```

(e) Add an `Import…` button into the header row (beside the `<SaveBar>`); put it before the `flex-1` spacer or right after the `<h2>`:

```tsx
<Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
```

(f) Add the apply handler near `save()`:

```ts
function applyImport(merged: PetDef[]) {
  setDraft(merged);
  setEditingId(null);
}
```

(g) Render the drawer at the end of the returned tree (just before the closing `</div>` of the root):

```tsx
<ImportDrawer<PetDef>
  open={importing}
  title="Import pets"
  noun="pet"
  existing={draft}
  getId={(d) => d.id}
  parseFile={parsePetsFile}
  onApply={applyImport}
  onClose={() => setImporting(false)}
  renderChange={(c) => <>{c.incoming.name} <span className="text-slate-400">· {c.incoming.id} · gen {c.incoming.gen} #{c.incoming.dexNo}</span></>}
/>
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS. If other PetsTab tests already existed in the file, they must still pass — run the whole file.

- [ ] **Step 5: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/components/admin/PetsTab.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx && git commit -F- <<'EOF'
feat(admin): Pets import drawer

Import… button + ImportDrawer<PetDef> on PetsTab. Apply merges into
the draft (additive by id) so the existing validatePetDefs SaveBar
gate enforces catalog-wide invariants (single starter, gen/dexNo
uniqueness, evolution refs) on the merged set before any save.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 5: Pets authoring guide + contract dry-run

**Files:**
- Create: `docs/authoring/pets.md`
- Modify: `docs/authoring/README.md`
- Append: `src/content/authoring-guides.contract.test.ts`

- [ ] **Step 1: Write the Pets dry-run (append to `src/content/authoring-guides.contract.test.ts`)**

This is the acceptance gate for the guide: a cold-AI TSV per the guide must import clean and, merged with the builtin catalog, pass `validatePetDefs`.

```ts
import { importPets } from './petImport';
import { validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import { mergeById } from './mergeById';

// One new pet at a free (gen,dexNo); base omitted → builtin-identical stats.
const PETS = `id\tname\tgen\tdexNo\ttypes\telement\tenabled
def-sprig\tSprig\t2\t1\tleaf\tleaf\ttrue`;

function petsWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromTsv(PETS), 'Pets');
  return wb;
}

describe('pets authoring guide dry-run', () => {
  it('cold-AI Pets table imports + merges into a valid catalog', () => {
    const { entities, errors } = importPets(petsWorkbook());
    expect(errors).toEqual([]);
    const merged = mergeById([...BUILTIN_PET_DEFS], entities, (d) => d.id).merged;
    const res = validatePetDefs(merged);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });
});
```

(`sheetFromTsv` already exists in this file from Stream A. If your branch lacks it, copy the 3-line helper from the top of the file.)

- [ ] **Step 2: Run to verify it fails or passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/authoring-guides.contract.test.ts`
Expected: PASS once `importPets` exists (Tasks 1-3 done). If it fails, the encoding/guide and the test disagree — fix before writing prose.

- [ ] **Step 3: Write `docs/authoring/pets.md`**

Follow the structure of the other guides exactly (one-paragraph "what this produces"; the column table with type/required/meaning; the rules-to-self-check; a worked example; the "emit EXACTLY this" TSV block). Content the guide MUST state:

- Sheet named exactly `Pets`. One row per pet.
- Columns table (from Task 2): `id`✅, `name`✅, `gen`✅, `dexNo`✅, `types`✅(CSV, each one of `leaf`/`fire`/`air`/`water` today), `element`✅(one of the four), `base_min`/`base_max`(optional pair → omit for default stats), `enabled`(default true), `starter`(optional), `rarity`(optional: common/rare/epic/legendary), `gachaObtainable`(optional), `evolvesFromId`/`evolvesToId`/`evolutionStage`(optional), `spriteDefault`(optional http(s) url).
- **Stats encoding (the key section):** explain that a pet's stats are one **base range** (`base_min`,`base_max`); the importer derives the four rarity bands automatically (common/rare/epic/legendary) by the same spread the game's gacha uses. **Omit both base columns to get the standard stats** (recommended default). All five stats (hp/atk/def/spd/luk) share the band. Per-stat asymmetry isn't authorable here — set it in the admin editor (v1 limit).
- **Catalog-wide rules the author must respect (from `validatePetDefs`):** ids unique; `(gen,dexNo)` unique across the WHOLE catalog (including pets already in the game — an additive import that collides fails); **exactly one starter, at gen 1 / dexNo 1** — don't add a second `starter`; at least one pet enabled; evolution `evolvesFromId`/`evolvesToId` must reference real pet ids (may be other rows in the same import); `evolutionStage` strictly increases along a chain, no cycles; `rarity` (if set) is one of the four; `spriteDefault` is a valid http(s) URL.
- **v1 not supported (don't emit):** per-stat asymmetric bands, sprite variants (per stage×mood), any column not listed.
- Worked example: 2-3 new pets (a base evolution pair + one with an explicit `base_min`/`base_max`), at a free gen so they don't collide with the four builtins (gens 1, dex 1-4).
- Output block: emit `=== Sheet: Pets ===` then the TSV (real tabs), header first.

- [ ] **Step 4: Update `docs/authoring/README.md`**

- In the "Which guide do I paste?" table, change the Pets row from `pets.md *(coming…)*` to a live link `[pets.md](pets.md)`.
- In the sheet-names section, note the optional fifth sheet `Pets`.
- Remove the trailing "Pets import is not built yet; `pets.md` lands with it." line (or replace with a one-liner pointing at the guide).

- [ ] **Step 5: Run the contract test again**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/authoring-guides.contract.test.ts`
Expected: PASS (Stream A tests + the new Pets dry-run).

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add docs/authoring/pets.md docs/authoring/README.md src/content/authoring-guides.contract.test.ts && git commit -F- <<'EOF'
docs(authoring): Pets guide + contract dry-run

pets.md: TSV Pets sheet, base-range stats (derived rarities),
catalog-wide invariants the author must respect. README flips the
Pets row to live. Contract test asserts a cold-AI Pets table imports
and merges into a validatePetDefs-clean catalog.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 6: Whole-feature verification + review

**Files:** none (gates only).

- [ ] **Step 1: Full unit suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: all green (prior ~1168 + the new petImport/PetsTab/contract tests). Investigate any red; do not proceed on failure.

- [ ] **Step 2: Type-check + build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx vite build`
Expected: clean tsc; successful production build.

- [ ] **Step 3: Manual smoke (admin)**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npm run dev`, open `#admin` → Pets → `Import…`. Paste the guide into an AI (or hand-make a `.xlsx` with a `Pets` sheet from the guide's worked example), import, confirm: preview shows New/Updated counts, applying adds the pet to the list, and a deliberately-bad file (second starter, or duplicate gen/dexNo) leaves Save disabled with a clear `validatePetDefs` error in the SaveBar. Note: a real human smoke may be deferred — flag it explicitly if skipped.

- [ ] **Step 4: Requesting code review**

Use `superpowers:requesting-code-review` for a final whole-feature review (the equivalent pass caught 2 real data bugs in the P5 import work — keep it). Focus the reviewer on: the derive rule (offset math + clamping), the parser's partial-base handling, that the apply path can't bypass `validatePetDefs`, and that no existing PetsTab test was clobbered.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch`. When green, promote the whole line (Stream A + Stream B) to `main` with a `--no-ff` merge, matching the prior release lines. Update memory + the handoff.

---

## Self-Review (done at plan-writing time)

**Spec coverage** (handoff Stream B pieces 1-6): parser → Task 2; statBands encoding (Decision b) → Task 1; `importPets` adapter → Task 3; PetsTab drawer wiring + Firestore-via-draft apply → Task 4; validation gate (existing SaveBar on merged draft, no bypass) → Task 4 + smoke in Task 6; pets.md guide → Task 5. Catalog-wide invariant watch-outs (single starter, gen/dexNo collision on merged set, post-merge evolution refs) → enforced by the existing `validatePetDefs` gate on the merged draft, asserted in Task 5 dry-run + Task 6 smoke.

**Placeholder scan:** every code step carries complete code; no TBD/"add validation here". The `pets.md` prose step (Task 5 Step 3) lists exact required content rather than the full markdown — acceptable because the format is fully fixed by the four shipped guides it must mirror, and the contract test (Step 1) is the objective gate.

**Type consistency:** `deriveStatBands(base: StatRange)` returns `Record<Rarity, Record<keyof BattleStats, StatRange>>` (matches `PetDef.statBands`); `parsePetsSheet → { defs: PetDef[]; errors: string[] }`; `importPets → SurfaceImport<PetDef>` = `{ entities: PetDef[]; errors: string[] }` (matches `ImportDrawer.parseFile` and PetsTab's `parsePetsFile` prop). `setDraft(merged: PetDef[])` matches the existing `useState<PetDef[]>`.

**Known risk to flag in review:** the apply path performs no *explicit* re-validation in the drawer; it relies on the SaveBar gate. If a future change lets PetsTab save without that gate, imports could write an invalid catalog. The Task 4 test + Task 6 smoke cover the current behavior; the reviewer should confirm the invariant.
