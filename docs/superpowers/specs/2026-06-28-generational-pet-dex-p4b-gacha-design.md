# Spec — Generational Pet Dex P4b (gacha over the dex)

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy is design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; promotes as one release, PR #33 base `main`).
**Predecessors:** P4a dex tracking (DONE), P3b storage sprite upload (DONE). Epic handoff `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4b-gacha-handoff.md`.
**Status:** Brainstorm complete, design approved. Next: writing-plans → subagent-driven execution.

## Goal

Gacha pulls real `PetDef`s from the live catalog instead of rolling over the hardcoded 4 elements. A pull picks an obtainable def, assigns its `defId`, derives `species` from `def.element`, and rolls stats from the def's own `statBands`. P4a's `addCaught` already fires at the pull site, so a pull now marks the real def caught in the Dex automatically.

## Deferred / out of scope

- Firebase go-live / production — deferred by decision (emulators only today).
- xlsx pet import column — pets are **not** imported via xlsx (ImportTab is course-only). Confirmed: no import change needed.

## Decisions (locked in brainstorm)

1. **Obtainability gate — new `gachaObtainable` field (Option A).** Admin-authored, default true. Explicit and future-proof over deriving from evolution semantics.
2. **Stats source — from `def.statBands[rarity]`.** Data-driven; PetsTab already exposes per-rarity band editing (`setBand`), so admin tuning of min/max becomes live on pulled pets. Built-in `statBands` already equal the gacha table (`bandsFromGacha`), so no behavior change for built-ins.
3. **Reveal custom-art fold-in — yes.** Thread the resolved `def` into the reveal so uploaded sprites show; element/default art fallback when no custom sprite (never-blank invariant holds).

## Architecture

### 1. Schema — `gachaObtainable`

- `src/data/types.ts`: add `gachaObtainable?: boolean` to `PetDef`. Read semantics everywhere: **obtainable = `d.gachaObtainable !== false`** (absent = obtainable).
- `src/content/petDefMigrate.ts` `backfillPetDefs`: default `gachaObtainable` to `true` when absent (consistent with the read semantics; explicit on migrated catalogs).
- `src/content/validate.ts` `validatePetDefs`: if `gachaObtainable` is present it must be a boolean; otherwise no constraint.
- `src/components/admin/PetsTab.tsx`: a checkbox next to `enabled`, bound to `onPatch({ gachaObtainable })`. Reads `def.gachaObtainable !== false` for the checked state.
- `BUILTIN_PET_DEFS` (`src/domain/petDef.ts`): leave the field absent → default-obtainable. No seed churn.

### 2. Pure domain — `pullEgg` (`src/domain/gacha.ts`)

Stays pure: the candidate pool is **passed in** via `args.defs`. No registry reach-in.

```ts
pullEgg(
  state: { coins },
  args: { price; id; rng; table; defs: readonly PetDef[] },
): PullEggResult
  if (coins < price) return { ok:false, reason:'insufficient-coins' }
  const rarity = rollRarity(rng, table)                       // RNG slot [0]
  const def    = args.defs[Math.floor(rng() * args.defs.length)]   // slot [1] — pool-index pick
  const stats  = rollStatsFromBands(def.statBands[rarity], rng)    // slots [2..6]
  const pet    = makePet({ id, defId: def.id, species: def.element, stats, rarity, hatched: true })
  return { ok:true, coins: coins - price, pet }
```

- **RNG slot order preserved** (rarity, pick, stats) so stat-roll alignment is unchanged. The old slot-[1] species-index roll becomes a pool-index roll. Update the contract comment in `gacha.ts` and the pinned tests deliberately — do not silence them.
- `pullEgg` assumes `args.defs` is non-empty; the call site guarantees it (see §3). The old `SPECIES` const and its species-index pick are removed.

New helper in `src/domain/pets.ts`:

```ts
rollStatsFromBands(bands: Record<keyof BattleStats, StatRange>, rng): BattleStats
```

Rolls each of the five stats inclusively within its own `[min,max]`. `rollStatsForRarity` (table-based) stays for the legacy/starter path; `rollStatsFromBands` is the per-def path. Optionally `rollStatsForRarity` may delegate, but not required.

### 3. Call site — `gameStore.pullEgg` (`src/state/gameStore.ts` ~line 377)

```ts
const pool = getActivePetDefs().filter((d) => d.enabled && d.gachaObtainable !== false);
const defs = pool.length ? pool : [starterDef()];   // never-empty fallback
const res = pullEggDomain(
  { coins: s.coins },
  { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities, defs },
);
if (!res.ok) return s;
return { pets:[...s.pets, res.pet], coins: res.coins, lastPull: res.pet,
         caughtDefIds: addCaught(s.caughtDefIds, res.pet.defId) };
```

- Empty obtainable pool → fall back to `[starterDef()]` so a pull never throws/blanks.
- `addCaught` is already wired (P4a); it now unions a **real** defId. Verify end-to-end into Collection → Dex.

### 4. Reveal custom-art (`src/components/Gacha.tsx` + `EvolutionCinematic.tsx`)

- `EvolutionCinematic`: add an optional `def?: PetDef` prop; build `src = spriteSrc(species, stage, 'happy', def)` (currently `spriteSrc(species, stage, 'happy')`). Absent def → unchanged element art.
- `Gacha.tsx`:
  - Resolve `const def = resolvePetDef(pulled.defId)` (use the reactive `usePetDefs()` catalog, not a one-shot snapshot, so a live catalog swap re-renders correctly).
  - Pass `def` to `EvolutionCinematic` (the hatch sequence).
  - Reveal image: replace `SPRITES[pulled.species].baby.happy` with `spriteSrc(def.element, 'baby', 'happy', def)`.
- Never-blank: `spriteSrc`'s element fallback + `PetSprite onError` already cover a missing/broken custom sprite — keep it intact.

## Testing

- `src/domain/gacha.test.ts`: update the RNG-contract comment; rewrite the species test as a **pool-pick** test (def chosen by slot-[1] index from the passed `defs`); assert the returned pet carries `defId === def.id`, `species === def.element`, and stats inside `def.statBands[rarity]`. Keep insufficient-coins, exact-price, no-mutation cases.
- `src/domain/pets.test.ts` (or alongside): `rollStatsFromBands` rolls each stat within its band; respects per-stat band differences.
- `src/content/validate.test.ts`: `gachaObtainable` present-but-non-boolean is rejected; absent/boolean OK.
- `src/content/petDefMigrate.test.ts`: backfill defaults `gachaObtainable` true.
- `src/components/admin/PetsTab` test (if present): the obtainable checkbox patches the draft.
- Component/integration: a pull with a non-element custom def appears caught in the Dex and the reveal shows its sprite.

## Landmines (carried from handoff)

- RNG-order contract is pinned by tests — update the comment + tests deliberately; keep slot order (rarity, pick, stats).
- `pullEgg` MUST stay pure — pass `defs` in; no module-registry reach-in.
- `def.statBands` must have every rarity key (built-ins guarantee it; `validatePetDefs` already enforces it for authored defs).
- Never `git add -A` — stage explicit files (concurrent-session contamination).
- "create" vs existing files — verify a "create" target doesn't already exist; instruct implementers to APPEND to existing test files.
- Never-blank invariant — any art path keeps the `spriteSrc` / `PetSprite onError` element fallback.
- Don't hand-edit generated `src/content/seed.ts` (`npm run seed:export`).
- For the live catalog in React use `usePetDefs()` (reactive), not a one-shot `getActivePetDefs()`.

## Verify gate (every slice)

`npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows worker-fork crash ("Worker exited unexpectedly") → re-run, not a real failure. Manual smoke (emulators + `dev:admin` seed, `/#admin` 🔑 Dev admin): pull eggs, confirm real defs appear, get marked caught, and custom sprites show in the reveal.
