# Handoff — Generational Pet Dex P4b (gacha over the dex)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — actual checkout `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; the whole line promotes as one release — open as **PR #33**, base `main`, 161 commits ahead).
**Status:** ✅ DONE (2026-06-28). Shipped on `journey-redesign`, commits `adb439c..9c6ef87` (8 impl) + `5ee9e8e` (hermetic e2e). 962 unit + 3 P4b e2e green; tsc + build clean. Brainstorm → spec (`docs/superpowers/specs/2026-06-28-generational-pet-dex-p4b-gacha-design.md`) → plan (`docs/superpowers/plans/2026-06-28-generational-pet-dex-p4b-gacha.md`) → subagent-driven execution complete. **Deferred:** visual manual smoke (custom sprite in reveal/cinematic, broken-URL→element fallback — needs browser); P4c follow-ups (`EvolutionScreen` real-evolution custom art, gameStore obtainable-filter unit test). See `[[sentence-pet-generational-dex-p4b-gacha]]`.
**Predecessors:** `[[sentence-pet-generational-dex-p4a]]` (dex tracking — DONE), `[[sentence-pet-generational-dex-p3b]]`. Epic handoff `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4-plus-handoff.md`; epic spec `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md`.

## ⚠️ Deferred (not in this slice)
Firebase go-live / production is deferred by decision (emulators only today). Out of scope.

## Goal
Gacha pulls real `PetDef`s from the dex — assigning a `defId` and deriving species from `def.element` — instead of rolling over the hardcoded 4 elements. Respect per-def obtainability + rarity. Pulled defs already flow into the dex (P4a's `addCaught` fires at the pull site), so a pull will mark a def caught automatically once it carries a real defId.

## What exists today

**`src/domain/gacha.ts` — `pullEgg` (PURE):**
```ts
const SPECIES: readonly Species[] = ['leaf', 'fire', 'air', 'water']; // line 5
// rng consumed IN ORDER: [0] rarity, [1] species, [2..6] five stats
export function pullEgg(state: { coins }, args: { price; id; rng; table }): PullEggResult {
  if (state.coins < args.price) return { ok:false, reason:'insufficient-coins' };
  const rarity  = rollRarity(args.rng, args.table);
  const species = SPECIES[Math.floor(args.rng() * SPECIES.length)];      // <-- becomes a def pick
  const stats   = rollStatsForRarity(rarity, args.rng, args.table);      // <-- table bands, NOT def.statBands
  const pet     = makePet({ id: args.id, species, stats, rarity, hatched: true });
  return { ok:true, coins: state.coins - args.price, pet };
}
```
- **No `defId`** → `makePet` defaults it from `species` (`defaultDefForElement(species).id`). So today a pull resolves to the element built-in, never a custom def.
- **Stats come from the gacha `table` bands**, not from the picked def's `statBands`. `PetDef.statBands` exists (`Record<Rarity, Record<keyof BattleStats, StatRange>>`); built-ins seed it = the gacha table (`petDef.ts` `bandsFromGacha`), but admin can author per-def bands.

**Call site — `src/state/gameStore.ts` `pullEgg` action (~line 377):**
```ts
const res = pullEggDomain({ coins: s.coins },
  { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities });
if (!res.ok) return s;
return { pets:[...s.pets, res.pet], coins: res.coins, lastPull: res.pet,
         caughtDefIds: addCaught(s.caughtDefIds, res.pet.defId) };  // P4a — already unions defId
```

**Config — `src/config/gameConfig.ts` `gacha` (line 43):** `eggPrice: 60`; `rarities` weight/band table (common65/rare25/epic8/legendary2).

**`PetDef` (`src/data/types.ts:118`):** has `enabled: boolean` ("gacha-pool gate; P4 reads it"), `statBands`, `element`, `evolvesFromId`/`evolvesToId`, `starter`. **No `gachaObtainable` field yet.**

**Registry:** `getActivePetDefs()` (`src/domain/petDef.ts`); now a subscribable external store (P4a fix) — `subscribePetDefs` + React hook `usePetDefs` (`src/state/usePetDefs.ts`). `getActivePetDefs().filter(d => d.enabled)` is the live catalog.

**Reveal — `src/components/Gacha.tsx`:** drives `EvolutionCinematic` (`species={lastPull.species}`, line 41) and renders `SPRITES[pulled.species].baby.happy` directly (line 77) — **uses element art, NOT `spriteSrc(def.element,…,def)`**, so a custom uploaded sprite does NOT show in the reveal.

## What to build (decide each in brainstorm)

1. **Candidate pool + obtainability gate.** Pool = `getActivePetDefs().filter(d => d.enabled && <obtainable?>)`. DECIDE the gate:
   - Option A: new `gachaObtainable?: boolean` on `PetDef` (admin-authored; default true) + `validateCourse`/`validatePetDefs` + admin PetsTab control + migration default.
   - Option B: derive — exclude evolution-only defs (`evolvesFromId` set, i.e. not a base form) and/or reward-only defs. No new field, but couples gacha to evolution semantics.
   - YAGNI vs future-proofing; pick one.

2. **Pick a def, derive species.** Replace the species-index roll with a pool-index roll: `pool[Math.floor(rng() * pool.length)]`, then `species = def.element`, `defId = def.id`. **Keep `pullEgg` pure — pass the candidate `defs` in via `args`; do NOT import the registry inside.**

3. **Stats source.** DECIDE: roll from `def.statBands[rarity]` (data-driven, lets admin tune per-def) vs keep the gacha `table` bands. If def.statBands → thread the picked def's bands into the stat roll; keep the `table` only for the rarity weights (or move rarity weights too). Note `rollStatsForRarity` currently reads the table — may need a variant that takes explicit bands.

4. **Rarity model.** Simplest: keep rarity rolled independently (as today), def picked uniformly from the pool. Alternative: rarity-gated pools / per-def weight. Recommend simplest unless there's a design reason.

5. **defId onto the instance.** `makePet({ id, defId: def.id, species: def.element, stats, rarity, hatched:true })`. P4a's `addCaught(s.caughtDefIds, res.pet.defId)` at the call site then records the real def caught — verify end to end.

6. **Empty-pool defensive fallback.** If the obtainable pool is empty, fall back to the starter/built-ins so a pull never throws / never blanks.

## Smaller fold-ins (natural here)
- **Reveal custom-art threading (P3b leftover):** thread `defId`/def into `Gacha.tsx` + `EvolutionCinematic` so uploaded sprites show during the reveal — replace `SPRITES[species].baby.happy` (Gacha.tsx:77) and the `species`-only `EvolutionCinematic` prop with `spriteSrc(def.element, stage, mood, def)`. One-prop pattern (same as P3a/P4a consumer wiring). Use `resolvePetDef(pet.defId)` to get the def.

## Landmines
- **RNG-order contract is pinned by tests.** `gacha.ts:4` comment + `src/domain/gacha.test.ts` (`rng order consumed: [0] rarity, [1] species, [2..6] five stats`). The species test (`[0,0.75,…] → 'water'`, line 51-53) will change meaning once `[1]` is a pool-index roll. **Update the contract + tests deliberately** — keep the slot order (rarity, pick, stats) so stat rolls stay aligned; don't silence tests.
- `pullEgg` MUST stay pure (pass `defs` in). Same rule as `spriteSrc`/`resolveCourseBundle`.
- If adding `gachaObtainable`: persisted? No — it's content on `PetDef`, not player state. But `validatePetDefs` + `backfillPetDefs` (`src/content/petDefMigrate.ts`) must default it; admin authoring (PetsTab) needs a control; xlsx import (if pets are importable) may need a column.
- `def.statBands` is `Record<Rarity, Record<stat, [min,max]>>` — if you roll stats from it, ensure every rarity key exists (built-ins guarantee it; validate authored defs do too).
- Don't hand-edit generated `src/content/seed.ts` (`npm run seed:export`).

## Process for the next session
1. `superpowers:brainstorming` — lock the 6 decisions above (esp. obtainability gate + stats source) before planning.
2. `superpowers:writing-plans` → `superpowers:subagent-driven-development` (fresh subagent per task, two-stage review spec→quality, final whole-feature review). This cadence caught real misses in P4a (persisted-shape guard tests, infinite-render selector) — keep it.
3. Verify gate every slice: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows worker-fork crash ("Worker exited unexpectedly") → re-run, not a real failure.
4. Manual smoke (admin/live data touched): emulators (`npm run emulators`, storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin sign-in; pull eggs and confirm real defs appear + get marked caught in Collection → Dex.

## Conventions / hazards (carried)
- **Never `git add -A`** — stage explicit files (concurrent-session contamination).
- **"create" vs existing files** — verify a "create" target doesn't already exist; subagent listings miss subdir test files (has clobbered tests before). Instruct implementers to APPEND.
- Pure domain functions stay pure — pass data in, no module-registry reach-in.
- Never-blank invariant — any art path must keep the `spriteSrc`/`PetSprite onError` element fallback.
- `selectCaughtSet` must NOT be passed directly to `useGameStore()` (new Set/call → infinite loop); read `caughtDefIds` via `useShallow` + derive in `useMemo` (see DexGrid). For the live catalog in React, use `usePetDefs()` (reactive), not a one-shot `getActivePetDefs()` snapshot.
