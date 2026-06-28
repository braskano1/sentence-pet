# Generational Pet Dex P4b — Gacha Over The Dex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gacha pulls draw a real obtainable `PetDef` from the live catalog — assigning its `defId`, deriving `species` from `def.element`, and rolling stats from `def.statBands` — and show the def's custom sprite in the reveal.

**Architecture:** Add a `gachaObtainable` gate to `PetDef` (schema + validate + backfill + admin checkbox). Keep `pullEgg` pure: the call site (`gameStore`) computes the obtainable pool and passes it in; `pullEgg` picks a def by a pool-index roll (preserving RNG slot order rarity→pick→stats) and rolls stats from the picked def's bands via a new `rollStatsFromBands` helper. Thread the resolved def into the reveal/cinematic so uploaded sprites render.

**Tech Stack:** TypeScript, React, Zustand, Vitest. Repo `D:/ai_projects/AI_design_thinking/sentence-pet`, branch `journey-redesign`.

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-p4b-gacha-design.md`

**Conventions (every task):**
- Verify gate before each commit: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows "Worker exited unexpectedly" → re-run.
- **Never `git add -A`** — stage explicit files only.
- **APPEND** to existing test files; never recreate a test file (verify the file before writing — clobbering tests has happened before).
- Commit messages do not need the Co-Authored-By trailer unless the executor adds it per global convention.

---

### Task 1: `gachaObtainable` schema + validate + backfill

**Files:**
- Modify: `src/data/types.ts` (PetDef interface, after `enabled`)
- Modify: `src/content/validate.ts` (inside the per-def loop, ~after line 179)
- Modify: `src/content/petDefMigrate.ts` (`backfillPetDefs`)
- Test (APPEND): `src/content/validate.test.ts`, `src/content/petDefMigrate.test.ts`

- [ ] **Step 1: Write the failing validate test** — APPEND inside the existing `describe('validatePetDefs', …)` block in `src/content/validate.test.ts`:

```ts
it('rejects gachaObtainable that is present but not boolean', () => {
  const defs = clone();
  // @ts-expect-error deliberately wrong type
  defs[0].gachaObtainable = 'yes';
  expect(validatePetDefs(defs).ok).toBe(false);
});

it('accepts gachaObtainable absent or boolean', () => {
  const a = clone(); // absent on all
  expect(validatePetDefs(a).ok).toBe(true);
  const b = clone();
  b[0].gachaObtainable = false;
  expect(validatePetDefs(b).ok).toBe(true);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/content/validate.test.ts`
Expected: FAIL — the non-boolean case is currently accepted (`ok: true`).

- [ ] **Step 3: Add the field to `PetDef`** — in `src/data/types.ts`, after the `enabled: boolean;` line (~130):

```ts
  enabled: boolean;         // gacha-pool gate; P4 reads it
  gachaObtainable?: boolean; // P4b gacha eligibility; absent = obtainable (read as `!== false`)
```

- [ ] **Step 4: Add the validate check** — in `src/content/validate.ts`, inside the per-def `for (const d of defs)` loop, immediately after the `evolutionStage` check (line 179):

```ts
    if (d.gachaObtainable !== undefined && typeof d.gachaObtainable !== 'boolean')
      push(`pet-def ${d.id} gachaObtainable must be a boolean`);
```

- [ ] **Step 5: Default it in backfill** — in `src/content/petDefMigrate.ts`, add to the mapped object in `backfillPetDefs`:

```ts
  return raw.map((d, i) => ({
    ...d,
    gen: typeof d.gen === 'number' ? d.gen : 1,
    dexNo: typeof d.dexNo === 'number' ? d.dexNo : i + 1,
    types: Array.isArray(d.types) && d.types.length > 0 ? d.types : [d.element],
    gachaObtainable: typeof d.gachaObtainable === 'boolean' ? d.gachaObtainable : true,
  })) as PetDef[];
```

- [ ] **Step 6: Write the failing backfill test** — APPEND in `src/content/petDefMigrate.test.ts`:

```ts
it('defaults gachaObtainable to true when absent', () => {
  const out = backfillPetDefs(preV2() as RawPetDef[]);
  for (const d of out) expect(d.gachaObtainable).toBe(true);
});

it('preserves an explicit gachaObtainable false', () => {
  const raw = preV2() as RawPetDef[];
  raw[0].gachaObtainable = false;
  expect(backfillPetDefs(raw)[0].gachaObtainable).toBe(false);
});
```

- [ ] **Step 7: Run the whole content suite, verify pass**

Run: `npx vitest run src/content/validate.test.ts src/content/petDefMigrate.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify gate + commit**

```bash
npx tsc -b
git add src/data/types.ts src/content/validate.ts src/content/petDefMigrate.ts src/content/validate.test.ts src/content/petDefMigrate.test.ts
git commit -m "feat: add gachaObtainable gate to PetDef (schema, validate, backfill)"
```

---

### Task 2: `rollStatsFromBands` helper

**Files:**
- Modify: `src/domain/pets.ts`
- Test (APPEND): `src/domain/pets.test.ts`

- [ ] **Step 1: Write the failing test** — APPEND a new `describe` in `src/domain/pets.test.ts` (it already imports from `./pets`; add `rollStatsFromBands` to that import, and `StatRange`/`BattleStats` types are in `../data/types`):

```ts
import type { BattleStats, StatRange } from '../data/types';

describe('rollStatsFromBands', () => {
  const bands = (r: StatRange): Record<keyof BattleStats, StatRange> => ({ hp: r, atk: r, def: r, spd: r, luk: r });

  it('rolls each stat inside its band (inclusive)', () => {
    const s = rollStatsFromBands(bands([50, 60]), () => 0.5);
    for (const v of Object.values(s)) { expect(v).toBeGreaterThanOrEqual(50); expect(v).toBeLessThanOrEqual(60); }
  });

  it('hits band floor at rng 0 and ceiling at rng ~1', () => {
    expect(rollStatsFromBands(bands([72, 88]), () => 0).hp).toBe(72);
    expect(rollStatsFromBands(bands([72, 88]), () => 0.999).hp).toBe(88);
  });

  it('respects per-stat band differences', () => {
    const mixed = { hp: [10, 10], atk: [90, 90], def: [40, 40], spd: [50, 50], luk: [60, 60] } as Record<keyof BattleStats, StatRange>;
    expect(rollStatsFromBands(mixed, () => 0.5)).toEqual({ hp: 10, atk: 90, def: 40, spd: 50, luk: 60 });
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/domain/pets.test.ts`
Expected: FAIL — `rollStatsFromBands` is not exported.

- [ ] **Step 3: Implement** — in `src/domain/pets.ts`, add after `rollStatsForRarity` (reuse the existing module-private `rollInBand`):

```ts
/** Roll each of the five stats inclusively within its own per-stat band. P4b gacha (per-def). */
export function rollStatsFromBands(
  bands: Record<keyof BattleStats, StatRange>,
  rng: () => number,
): BattleStats {
  return {
    hp: rollInBand(rng, bands.hp[0], bands.hp[1]),
    atk: rollInBand(rng, bands.atk[0], bands.atk[1]),
    def: rollInBand(rng, bands.def[0], bands.def[1]),
    spd: rollInBand(rng, bands.spd[0], bands.spd[1]),
    luk: rollInBand(rng, bands.luk[0], bands.luk[1]),
  };
}
```

Add `StatRange` to the existing `import type { … } from '../data/types';` line in `pets.ts` if not already present.

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/domain/pets.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify gate + commit**

```bash
npx tsc -b
git add src/domain/pets.ts src/domain/pets.test.ts
git commit -m "feat: add rollStatsFromBands (per-def stat roll)"
```

---

### Task 3: `pullEgg` picks a def from the passed pool

**Files:**
- Modify: `src/domain/gacha.ts`
- Test (rewrite the species case, keep the rest): `src/domain/gacha.test.ts`

- [ ] **Step 1: Update the test contract** — in `src/domain/gacha.test.ts`:

  1. Change the comment at line 15 to: `// rng order consumed: [0] rarity, [1] pool-pick, [2..6] five stats.`
  2. Add a `defs` fixture and thread it through `args`. Replace the `args` helper (line 16) with:

```ts
import type { PetDef } from '../data/types';

const band = [40, 60] as [number, number];
const mkBands = (b: [number, number]) => ({ hp: b, atk: b, def: b, spd: b, luk: b });
const DEFS: PetDef[] = [
  { id: 'def-leaf',  name: 'Leaflet', gen: 1, dexNo: 1, types: ['leaf'],  element: 'leaf',
    statBands: { common: mkBands([40,60]), rare: mkBands([55,75]), epic: mkBands([72,88]), legendary: mkBands([85,90]) }, enabled: true },
  { id: 'def-water', name: 'Dewdrop', gen: 1, dexNo: 4, types: ['water'], element: 'water',
    statBands: { common: mkBands([40,60]), rare: mkBands([55,75]), epic: mkBands([72,88]), legendary: mkBands([85,90]) }, enabled: true },
];
const args = (rng: () => number, defs: PetDef[] = DEFS) => ({ price: PRICE, id: 'pet-1', rng, table: TABLE, defs });
```

  3. Replace the `picks species uniformly` test (lines 51-54) with a pool-pick test:

```ts
it('picks a def from the pool by the pool-pick rng and derives species/defId/stats from it', () => {
  // rng: [0]=0 -> common rarity, [1]=0.75 -> index floor(0.75*2)=1 -> def-water, [2..6] stats mid-band
  const res = pullEgg({ coins: 200 }, args(seq([0, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5])));
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  expect(res.pet.defId).toBe('def-water');
  expect(res.pet.species).toBe('water');
  for (const v of Object.values(res.pet.stats)) { expect(v).toBeGreaterThanOrEqual(40); expect(v).toBeLessThanOrEqual(60); }
});
```

  The unchanged tests (insufficient-coins, exact-price, in-band stats, legendary near-max, no-mutation) keep working because `DEFS[0]` bands equal `TABLE` bands and `seq([0,…])` picks index 0.

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/domain/gacha.test.ts`
Expected: FAIL — `pullEgg` doesn't accept `defs` / still rolls species, defId is `def-leaf` not `def-water`.

- [ ] **Step 3: Rewrite `pullEgg`** — replace the body of `src/domain/gacha.ts` (remove the `SPECIES` const and species roll):

```ts
import type { PetDef, PetInstance } from '../data/types';
import { makePet, rollRarity, rollStatsFromBands, type RarityTier } from './pets';

export type PullEggResult =
  | { ok: true; coins: number; pet: PetInstance }
  | { ok: false; reason: 'insufficient-coins' };

/**
 * Pure. Validates coins, then rolls rarity -> picks a def from `defs` -> rolls
 * stats from that def's bands and builds a hatched pet.
 * RNG consumed in order: [0] rarity, [1] pool-pick, [2..6] five stats.
 * The caller passes a NON-EMPTY obtainable pool (it falls back to the starter).
 */
export function pullEgg(
  state: { coins: number },
  args: { price: number; id: string; rng: () => number; table: readonly RarityTier[]; defs: readonly PetDef[] },
): PullEggResult {
  if (state.coins < args.price) return { ok: false, reason: 'insufficient-coins' };
  const rarity = rollRarity(args.rng, args.table);
  const def = args.defs[Math.floor(args.rng() * args.defs.length)];
  const stats = rollStatsFromBands(def.statBands[rarity], args.rng);
  const pet = makePet({ id: args.id, defId: def.id, species: def.element, stats, rarity, hatched: true });
  return { ok: true, coins: state.coins - args.price, pet };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/domain/gacha.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Verify gate + commit** (tsc will flag the call site in Task 4 — expected; commit the domain + test together, fix the call site next)

```bash
npx vitest run src/domain/gacha.test.ts
git add src/domain/gacha.ts src/domain/gacha.test.ts
git commit -m "feat: pullEgg picks a def from the passed pool (rng slot order preserved)"
```

> Note: `npx tsc -b` will now error in `gameStore.ts` (missing `defs`). That is fixed in Task 4 — do not run the full type-check as a gate here; the gacha unit suite is the gate for this task.

---

### Task 4: Wire the call site — obtainable pool + fallback

**Files:**
- Modify: `src/state/gameStore.ts` (import line 15; `pullEgg` action ~line 396)

- [ ] **Step 1: Add the registry import** — change line 15 of `src/state/gameStore.ts`:

```ts
import { defaultDefForElement, starterDef, getActivePetDefs } from '../domain/petDef';
```

- [ ] **Step 2: Build the pool and pass it in** — replace the `pullEgg` action body (lines 396-409):

```ts
      pullEgg: () =>
        set((s) => {
          const pool = getActivePetDefs().filter((d) => d.enabled && d.gachaObtainable !== false);
          const defs = pool.length ? pool : [starterDef()]; // never-empty: a pull must never blank/throw
          const res = pullEggDomain(
            { coins: s.coins },
            { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities, defs },
          );
          if (!res.ok) return s; // no-op; UI disables Pull when too poor
          return {
            pets: [...s.pets, res.pet],
            coins: res.coins,
            lastPull: res.pet,
            caughtDefIds: addCaught(s.caughtDefIds, res.pet.defId),
          };
        }),
```

- [ ] **Step 3: Run the full type-check + tests, verify pass**

Run: `npx tsc -b && npx vitest run src/domain/gacha.test.ts src/state`
Expected: PASS, no type errors.

- [ ] **Step 4: Verify gate + commit**

```bash
npm test
npx tsc -b
git add src/state/gameStore.ts
git commit -m "feat: pull from the obtainable PetDef pool with starter fallback"
```

---

### Task 5: Admin obtainable checkbox (PetsTab)

**Files:**
- Modify: `src/components/admin/PetsTab.tsx` (in `PetForm`, next to the `enabled` checkbox ~line 299)
- Test (APPEND, if a PetsTab/PetForm test file exists): `src/components/admin/PetsTab.test.tsx`

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/components/admin/PetsTab.test.tsx 2>/dev/null || echo "none"`
If a file exists, APPEND the Step 2 test to it. If "none", skip the test steps (Steps 2 & 4) — this is a thin one-line control verified by manual smoke; do not scaffold a new harness.

- [ ] **Step 2 (only if the test file exists): Write the failing test** — APPEND:

```ts
it('toggling the obtainable checkbox patches gachaObtainable', () => {
  const onPatch = vi.fn();
  render(<PetForm def={{ ...sampleDef, gachaObtainable: true }} allDefs={[sampleDef]} onPatch={onPatch} onRename={vi.fn()} onSetStarter={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /gacha obtainable/i }));
  expect(onPatch).toHaveBeenCalledWith({ gachaObtainable: false });
});
```

(Reuse whatever `sampleDef`/render helpers the existing file already defines; match its imports.)

- [ ] **Step 3: Add the checkbox** — in `src/components/admin/PetsTab.tsx`, immediately after the `enabled` `<label>` block (closes ~line 302):

```tsx
      <label>gacha obtainable
        <input type="checkbox" className="ml-1" aria-label="gacha obtainable"
          checked={def.gachaObtainable !== false}
          onChange={(e) => onPatch({ gachaObtainable: e.target.checked })} />
      </label>
```

- [ ] **Step 4 (only if the test file exists): Run, verify pass**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify gate + commit**

```bash
npx tsc -b && npm run build
git add src/components/admin/PetsTab.tsx
# include the test file in the add ONLY if it existed and you appended to it
git commit -m "feat: admin gacha-obtainable toggle in PetsTab"
```

---

### Task 6: Reveal custom art (Gacha + EvolutionCinematic)

**Files:**
- Modify: `src/components/EvolutionCinematic.tsx` (add optional `def` prop)
- Modify: `src/components/Gacha.tsx` (resolve def, thread it, swap reveal img)

- [ ] **Step 1: Add the optional `def` prop to `EvolutionCinematic`** — in `src/components/EvolutionCinematic.tsx`:

  Update the import and signature:

```ts
import type { PetDef, PetStage, Species } from '../data/types';
```

```ts
export function EvolutionCinematic({
  from, to, species, def, onDone,
}: { from: PetStage; to: PetStage; species: Species; def?: PetDef; onDone: () => void }) {
```

  And thread `def` into the sprite source (line 60):

```ts
  const src = spriteSrc(species, showNew ? to : from, 'happy', def);
```

- [ ] **Step 2: Resolve and thread the def in `Gacha.tsx`** — in `src/components/Gacha.tsx`:

  Add imports:

```ts
import { spriteSrc } from '../config/sprites';
import { resolvePetDef } from '../domain/petDef';
import { usePetDefs } from '../state/usePetDefs';
```

  Inside the component, after `lastPull` is read, resolve the def reactively:

```ts
  const defs = usePetDefs();
  const pulledDef = lastPull ? resolvePetDef(lastPull.defId, defs) : undefined;
```

  Pass `def` to the cinematic (the `hatching` branch):

```tsx
      <EvolutionCinematic
        from="egg"
        to="baby"
        species={lastPull.species}
        def={pulledDef}
        onDone={() => setHatching(false)}
      />
```

  Replace the reveal image `src` (line 77) — `pulled` is `lastPull` when revealed, so `pulledDef` matches:

```tsx
          <img
            src={pulledDef ? spriteSrc(pulledDef.element, 'baby', 'happy', pulledDef) : SPRITES[pulled.species].baby.happy}
            alt={PET_NAME[pulled.species]}
```

  (Keep the existing `SPRITES` import — it's the defensive fallback; `spriteSrc` itself also falls back to element art, and `PetSprite onError` is unaffected.)

- [ ] **Step 3: Type-check + build, verify pass**

Run: `npx tsc -b && npm run build`
Expected: PASS, no type errors.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (re-run once if a Windows worker-fork crash appears).

- [ ] **Step 5: Commit**

```bash
git add src/components/EvolutionCinematic.tsx src/components/Gacha.tsx
git commit -m "feat: show pulled def's custom sprite in the gacha reveal + hatch cinematic"
```

---

### Task 7: End-to-end manual smoke

**No code.** Validates the slice against real data.

- [ ] **Step 1:** Start emulators + admin dev server:

```bash
npm run emulators   # storage on :9199
npm run dev:admin
```

- [ ] **Step 2:** Open `/#admin`, sign in via 🔑 Dev admin. In the Pets tab: author/confirm a non-`leaf` def (e.g. a custom water def) with `enabled` on and `gacha obtainable` on; optionally upload a custom default sprite and tune its `common` stat band.
- [ ] **Step 3:** Author a second def with `gacha obtainable` **off**; confirm it never appears from pulls (statistically — pull several times).
- [ ] **Step 4:** Pull eggs. Confirm:
  - pulled pets resolve to real authored defs (not only the 4 elements),
  - the custom sprite shows in the hatch cinematic and the reveal card,
  - tuned stat bands are reflected in pulled stats,
  - the pulled def is marked caught in Collection → Dex (P4a `addCaught`).
- [ ] **Step 5:** Confirm the empty-pool guard: in a scratch scenario where no def is obtainable, a pull still returns the starter (never blanks). (Can be reasoned/asserted from Task 4 fallback rather than forced in the UI if disabling all defs is blocked by the "≥1 enabled" admin rule.)

---

## Self-Review

**Spec coverage:**
- Decision 1 (gachaObtainable gate) → Task 1 (schema/validate/backfill) + Task 5 (admin UI) + Task 4 (filter use). ✓
- Decision 2 (stats from def.statBands) → Task 2 (`rollStatsFromBands`) + Task 3 (use in pullEgg). ✓
- Decision 3 (reveal custom art) → Task 6. ✓
- Pure `pullEgg` / pool passed in → Task 3 signature + Task 4 call site. ✓
- Empty-pool fallback → Task 4. ✓
- defId onto instance + addCaught end-to-end → Task 3 `makePet` + Task 4 (existing addCaught) + Task 7 smoke. ✓
- RNG slot-order contract update → Task 3 Step 1. ✓
- Out of scope (xlsx, Firebase go-live) → not tasked. ✓

**Placeholder scan:** No TBD/TODO; all code steps carry full code. Task 5 conditional test is gated on file existence with explicit instructions, not a placeholder.

**Type consistency:** `rollStatsFromBands(bands, rng)` signature identical in Task 2 (def) and Task 3 (use). `gachaObtainable?: boolean` read as `!== false` consistently in Task 1, 4, 5. `EvolutionCinematic` `def?: PetDef` prop matches the `Gacha.tsx` pass site (Task 6). `pullEgg` args `{ price, id, rng, table, defs }` identical in Task 3 def and Task 4 call. ✓
