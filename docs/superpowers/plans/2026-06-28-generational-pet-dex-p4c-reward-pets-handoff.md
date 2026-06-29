# Handoff — Generational Pet Dex P4c (reward pets via `rewardPetDefId`)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — actual checkout `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; the whole line promotes as one release via **PR #33**, base `main`).
**Status:** NOT STARTED. **Brainstorm first** (`superpowers:brainstorming`), then spec → plan → subagent-driven execution.
**Predecessors:** `[[sentence-pet-generational-dex-p4b-gacha]]` (gacha over the dex — DONE), `[[sentence-pet-generational-dex-p4a]]` (dex tracking — DONE). Epic handoff `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4-plus-handoff.md` (see "P4c — Reward pets" + "P4d — Evolution execution").

## ⚠️ Deferred (not in this slice)
Firebase go-live / production is deferred by decision (emulators only today). Out of scope.

## Goal
Completing a course / clearing a boss can grant a **specific** authored pet (`rewardPetDefId`) instead of the current random-element egg. The granted pet flows into the dex automatically (P4a `addCaught` already fires at the grant site).

## What exists today

**Grant site — `src/state/gameStore.ts` `finishBoss` (firstClear block, ~line 283-298):**
```ts
if (firstClear) {
  pets = updateActive(s, (p) => { /* applyXp … */ });
  const egg = makePet({
    id: crypto.randomUUID(),
    species: (['leaf', 'fire', 'air', 'water'] as const)[Math.floor(rng() * 4)], // ← raw random element, NO defId
    stats: rollStats(rng),                                                         // ← flat rollStats, NOT band-based
    rarity: 'common',
  });
  pets = [...pets, egg];
  lastPull = egg;
  caughtDefIds = addCaught(caughtDefIds, egg.defId); // P4a — already unions defId (today: the element built-in)
}
```
- This is the **old gacha pattern P4b just removed from `pullEgg`**: random element, no `defId` (so `makePet` defaults it from species → element built-in), flat `rollStats`. P4c should make this grant data-driven (and ideally reuse the P4b pool-pick for the no-reward fallback).
- `addCaught` is already wired here — a real `rewardPetDefId` will be recorded caught with no extra work.

**Content shape — `src/content/course.ts`:**
- `BossNode` (line 8): `{ id, title, scope, …, boss: CheckpointBoss, onClear?: 'completeCourse' }`. **No `rewardPetDefId`.**
- `Course` (line 22): `{ id, title, …, units, gates: BossNode[], finalBoss?: BossNode }`.
- Bosses come in two scopes: gated gates + the `finalBoss`. DECIDE where the reward lives (per-BossNode? final-only? course-level?).

**Validation — `src/content/validate.ts` `validateCourse`:** validates units/lessons/items; **does not** see pet-def ids today (it validates a course bundle, not the pet-def catalog). A `rewardPetDefId` ref check needs the `PetDef` id set threaded in, or a separate validation pass (e.g. in `saveCourse`/admin where both are available). `validatePetDefs` is the pet-def validator; they're separate. Decide how to wire the cross-reference check.

**Admin — `src/components/admin/BossesTab.tsx`:** `BossField` editor renders the shared boss fields (name/tierId/element/rivalSprite) for gated + final editors via `onPatch({ boss: {…} })`. A `rewardPetDefId` control (dropdown over `getActivePetDefs()` ids, or a clearable select) slots in here.

**xlsx import:** the course importer (`ImportTab` / `parseWorkbookToCourse`) builds courses from a workbook. If bosses are importable there, a `rewardPetDefId` Bosses-sheet column may be needed — **verify whether the Bosses sheet is parsed at all** before adding a column (don't assume).

**Reward UI — `src/components/RewardScreen.tsx`:** renders `lastReward` after a clear and routes to the stage-evolution cinematic on `lastStageChange`. The granted pet today surfaces via `lastPull`. Confirm the reward pet shows correctly (name card / sprite) — and reuse the P4b custom-art path (`spriteSrc(def.element, …, def)`) if a reward sprite should display.

## What to build (decide each in brainstorm)

1. **Where `rewardPetDefId` lives.** Options: on every `BossNode` (each gate + final can grant), final-boss-only (`Course.finalBoss`), or course-level. YAGNI vs flexibility — pick one.
2. **Grant-once vs repeatable.** Today firstClear gates the egg. Likely keep grant-once (firstClear). If a separate "already granted" set is needed, that's a **persisted-store change** (PERSIST_VERSION bump + migration) — avoid if firstClear suffices.
3. **Stats source for the reward pet.** Consistent with P4b → roll from `def.statBands[rarity]` (`rollStatsFromBands`) rather than flat `rollStats`. Decide the rarity (fixed `common`? authored?).
4. **Fallback when no `rewardPetDefId`.** Keep the random-element egg, OR (recommended, aligns with P4b) roll from the obtainable gacha pool (`getActivePetDefs().filter(d => d.enabled && d.gachaObtainable !== false)`, never-empty `[starterDef()]` fallback) so boss rewards stop minting raw element built-ins. This also kills the last raw-`SPECIES`-roll in the codebase.
5. **Validation wiring.** `rewardPetDefId` must reject a dangling id (no matching `PetDef`). Decide: thread the pet-def id set into `validateCourse`, or validate at the admin save boundary (`saveCourse`) where both catalogs are loaded.
6. **Reward reveal.** Should a reward pet play the hatch cinematic (like gacha) or just show on the reward screen? Reuse `EvolutionCinematic` + `spriteSrc(def.element, …, def)` if so (P4b pattern).

## Landmines
- The boss-clear egg grant (`gameStore.ts:290`) is the old random-element pattern — when you touch it, **keep `makePet` getting an explicit `defId`** (reward def, or pool-pick fallback) so it stops defaulting to the element built-in.
- `def.statBands` must have every rarity key — built-ins guarantee it; `validatePetDefs` enforces it for authored defs. If you roll reward stats from bands, the reward def is guaranteed valid only if it came from the validated catalog.
- Persisted-state caution: a "granted rewards" tracking set ⇒ PERSIST_VERSION bump + migration (see P4a's 16→17). Prefer firstClear gating to avoid it.
- `validateCourse` and `validatePetDefs` are **separate validators** — don't assume one sees the other's data. Cross-ref check needs both id sets in scope.
- Don't conflate this with **P4d def-chain evolution** (`evolvesToId` runtime transform) — that's the next slice, not this one.
- Never-blank invariant: any reward sprite path keeps the `spriteSrc` / `PetSprite onError` element fallback.
- Don't hand-edit generated `src/content/seed.ts` (`npm run seed:export`); never `git add -A` (stage explicit files).

## Smaller fold-ins (carried, optional — fold in if you touch the area)
- **`EvolutionScreen` real-evolution custom art (P4b leftover):** the routed L16/L36/stage cinematic (`EvolutionScreen.tsx`) still passes no `def` → owned custom-sprite pets show element art on evolve. `EvolutionCinematic` already accepts the optional `def?` prop (P4b); thread `resolvePetDef(pet.defId)` in. One-prop change.
- **gameStore obtainable-filter unit test:** the P4b pool filter + `[starterDef()]` fallback (`gameStore.ts:397-399`) is integration-covered (e2e `p4b-gacha.spec.ts`) but has no dedicated unit test. Cheap to add.
- **PetsTab `setDraft` concurrency fix (tracked):** non-functional `setDraft(draft.map(...))` — stale-closure, rapid edits can drop a write. Fix = `setDraft(prev => prev.map(...))`. Pre-existing, low-risk.

## Process for the next session
1. `superpowers:brainstorming` — lock the 6 decisions above (esp. where the field lives + the no-reward fallback) before planning.
2. `superpowers:writing-plans` → `superpowers:subagent-driven-development` (fresh subagent per task, two-stage review spec→quality, final whole-feature review). This cadence caught real misses in P4a/P4b (persisted-shape guards, a non-distinguishing test, a redundant ternary) — keep it.
3. Verify gate every slice: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows worker-fork crash ("Worker exited unexpectedly") → re-run, not a real failure.
4. Hermetic e2e where useful: `window.store` + the new `window.petDefs` ({get,set,builtins}) DEV handle drive the gacha/grant store with no auth/emulators — see `e2e/p4b-gacha.spec.ts` for the inject-catalog pattern.
5. Manual smoke (admin/live data touched): emulators (`npm run emulators`, storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin; author a boss `rewardPetDefId`, clear the boss, confirm the exact pet is granted + marked caught in Collection → Dex.

## Conventions / hazards (carried)
- **Never `git add -A`** — stage explicit files (concurrent-session contamination).
- **"create" vs existing files** — verify a "create" target doesn't already exist; subagent listings miss subdir test files (has clobbered tests before). Instruct implementers to APPEND.
- Pure domain functions stay pure — pass data in, no module-registry reach-in.
- For the live catalog in React use `usePetDefs()` (reactive); in store actions use the one-shot `getActivePetDefs()` snapshot.
