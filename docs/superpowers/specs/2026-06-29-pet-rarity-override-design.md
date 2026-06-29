# Pet Rarity Override — Design

**Date:** 2026-06-29
**Status:** Approved (design); ready for implementation plan.

## Problem

Today a pet's rarity (`common | rare | epic | legendary`) is decided at spawn time and is **not** controllable per creature:

- **Gacha** (`src/domain/gacha.ts`) rolls rarity by weight from the gacha table.
- **Boss-reward pet** (`src/state/gameStore.ts:309`) hardcodes `rarity: 'common'`.
- **Starter** (`src/state/gameStore.ts:188`) hardcodes `rarity: 'common'`.

The admin wants to set a fixed rarity per creature so a given `PetDef` always spawns at a chosen rarity.

## Decisions (locked with the user)

1. **Model A — rarity stays an instance trait.** A per-def rarity forces the *initial spawn* roll only; rarity remains a property of the spawned `PetInstance`. PetDef does **not** become the runtime source of a pet's rarity.
2. **Applies to all spawn paths** — gacha, boss-reward, and starter.
3. **Evolution keeps rarity.** `evolvePetDef` already preserves the instance `rarity` (re-bases stats only); it is **not** touched by this feature. A forced-rarity pet keeps its rarity through the whole evolution chain.
4. **Optional / backward-compatible.** The field is an optional override. Unset = exactly today's behavior (gacha rolls by weight; reward + starter = common). No `PERSIST_VERSION` bump, no migration.
5. **Admin control = dropdown.** A single `Select` ("rarity override") in the PetForm Identity card, consistent with the existing controls. Options: **Default (roll)**, Common, Rare, Epic, Legendary.

## Data model

`src/data/types.ts` — add one optional field to `PetDef`:

```ts
export interface PetDef {
  // ...existing fields...
  /** Admin rarity override. Absent → roll (gacha) / common (reward + starter).
   *  When set, every spawn of this def is forced to this rarity and stats roll
   *  from `statBands[rarity]`. Rarity remains an instance trait (preserved on evolve). */
  rarity?: Rarity;
}
```

`Rarity` already exists (`'common' | 'rare' | 'epic' | 'legendary'`). No schema-version change — this is global content (`content/petDefs`), not persisted save state.

## Spawn logic

A def's `rarity`, when present, wins at every spawn site. Stats always roll from the **resolved** rarity's band.

### Gacha — `src/domain/gacha.ts` (`pullEgg`)

Keep the documented RNG consumption order (`[0] rarity, [1] pool-pick, [2..6] stats`) so existing tests that don't set `def.rarity` stay green. Roll the rarity as today, pick the def as today, then **override** the rarity value if the picked def has one:

```ts
const rolledRarity = rollRarity(args.rng, args.table);
const def = args.defs[Math.floor(args.rng() * args.defs.length)];
const rarity = def.rarity ?? rolledRarity;           // forced def wins; rolled value discarded
const stats = rollStatsFromBands(def.statBands[rarity], args.rng);
const pet = makePet({ id: args.id, defId: def.id, species: def.element, stats, rarity, hatched: true });
```

The rolled rarity is intentionally discarded for forced defs; this keeps RNG offsets stable (no test churn for the unforced path). A forced-rarity def in the pool therefore ignores the weighted roll for itself — that is the feature.

### Boss-reward pet — `src/state/gameStore.ts` (~line 309)

```ts
const rarity = def.rarity ?? 'common';
const egg = makePet({
  id: crypto.randomUUID(),
  species: def.element,
  defId: def.id,
  stats: rollStatsFromBands(def.statBands[rarity], rng),  // was statBands.common
  rarity,                                                  // was 'common'
});
```

### Starter — `src/state/gameStore.ts` (~line 188)

```ts
const sdef = starterDef();
const rarity = sdef.rarity ?? 'common';
const stats = sdef.rarity ? rollStatsFromBands(sdef.statBands[rarity], rng) : rollStats(rng);
return makePet({ id: STARTER_ID, defId: sdef.id, species: 'leaf', stats, rarity, hatched: false });
```

When the starter def has no override, behavior is byte-for-byte today's (`rollStats` + `'common'`). When set, stats come from that rarity's band.

## Admin UI

`src/components/admin/petsTab/PetForm.tsx` — add a `Field` in the **Identity** `Card`, after `element` / `types`:

```tsx
<Field label="rarity override">
  <Select
    value={def.rarity ?? ''}
    onChange={(e) => onPatch({ rarity: (e.target.value || undefined) as Rarity | undefined })}
  >
    <option value="">Default (roll)</option>
    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
  </Select>
</Field>
```

- `RARITIES` is already imported in PetForm (from `./helpers`).
- Empty string → `onPatch({ rarity: undefined })`, which leaves the field unset (Default). `Rarity` must be imported into PetForm's type imports.
- No new component; reuses the existing `Select`. The persisted `def.rarity` round-trips through the existing `savePetDefs` (whole-doc write) with no other plumbing.

## Out of scope (YAGNI)

- No per-stage-def rarity climbing on evolve (that was Model B, rejected).
- No re-roll of an existing owned pet's rarity when an admin later changes a def's override (override affects *new* spawns only).
- No rarity weighting/odds editor — this is a hard override, not a probability.
- No display changes to the dex/pet UI beyond what already renders rarity (existing `RARITY_BADGE`/`RARITY_RING` keyed on the instance rarity already handle forced values).

## Testing

Pure/unit tests, appended (never overwrite existing test files):

- **`src/domain/gacha.test.ts`**: a def with `rarity: 'legendary'` always yields a legendary pet with stats in the legendary band, regardless of the rarity-roll RNG value; a def with no `rarity` still rolls as today (existing tests unchanged).
- **`src/state/gameStore.test.ts`**: boss-reward pet adopts `def.rarity` when set (stats in that band), falls back to `'common'` when unset; starter adopts `starterDef().rarity` when set, else unchanged (`rollStats` + common).
- **`src/components/admin/PetsTab.test.tsx`** (or a PetForm-level test): selecting a rarity in the dropdown patches `def.rarity`; selecting "Default (roll)" clears it to `undefined`.

## Verification gate

`npx vitest run`, `npx tsc -b`, `npx vite build`. (Windows "Worker exited unexpectedly" vitest flake → re-run.)

## Notes / hazards (carry-forward)

- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell cwd resolves wrong).
- Stage explicit files; never `git add -A`. Append to `*.test.*`, never overwrite (prior phases lost tests to clobbering).
- Implement on its own branch off `main` (independent of the in-flight `dex-stage-display` branch).
