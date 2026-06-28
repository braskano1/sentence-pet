# Spec — Generational Pet Dex P4c: reward pets via `rewardPetDefId`

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout `D:/ai_projects/AI_design_thinking/sentence-pet`
**Branch:** `journey-redesign` (integration branch; commit here, do NOT merge to `main` — whole line promotes via PR #33).
**Predecessor handoff:** `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4c-reward-pets-handoff.md`
**Status:** APPROVED — ready for implementation plan.

## Goal
Clearing a boss can grant a **specific authored pet** (`rewardPetDefId`) instead of the current raw random-element egg. The granted pet:
- is data-driven (explicit `defId`, band-rolled stats — not flat `rollStats`),
- flows into the dex automatically (`addCaught` already fires at the grant site),
- reveals via a hatch cinematic (egg→baby), like a gacha pull.
When a boss has **no** `rewardPetDefId`, the grant falls back to the P4b obtainable-gacha pool (never the raw element built-in). This removes the last raw-`SPECIES` roll in the codebase.

## Decisions (locked in brainstorm)
1. **Field home:** `rewardPetDefId?: string` on **every `BossNode`** (each gate + finalBoss can grant).
2. **No-reward fallback:** P4b pool-pick — `getActivePetDefs().filter(d => d.enabled && d.gachaObtainable !== false)`, never-empty `[starterDef()]` fallback.
3. **Reveal:** hatch cinematic (`EvolutionCinematic` egg→baby) for the granted pet.
4. **Stats:** `rollStatsFromBands(def.statBands['common'], rng)`; rarity fixed `'common'` (authored rarity deferred — YAGNI).
5. **Grant-once:** keep existing `firstClear` gate. **No** persisted "already-granted" set (no PERSIST_VERSION bump).
6. **Validation:** cross-ref at the admin save boundary by threading the pet-def id set into `validateCourse` (kept pure); runtime stays safe via `resolvePetDef` starter-fallback.
7. **Fold in all 3 carried items.**

## Architecture / data flow
```
Admin authors BossNode.rewardPetDefId
        │  (validateCourse rejects a dangling id at Save)
        ▼
journey.ts bossUnit() copies node.rewardPetDefId → synth Lesson.rewardPetDefId
        ▼
gameStore.finishBoss (firstClear): reads cleared.rewardPetDefId
   present → resolvePetDef(id)            (starter-fallback = never blank)
   absent  → pool-pick (P4b obtainable filter)
   → makePet({ defId, species: def.element, stats: rollStatsFromBands(common), rarity:'common' })
   → lastPull = egg; caughtDefIds = addCaught(...); lastHatch = egg
        ▼
RewardScreen Continue → rewardHatch (RewardHatchScreen plays egg→baby cinematic)
   → evolution (active-pet stage-up, if any) → petRoom
```

## Components / changes

### Data model
- `src/content/course.ts` — `BossNode`: add `rewardPetDefId?: string`.
- `src/content/model.ts` — `Lesson`: add `rewardPetDefId?: string` (synth target; comment it as set only on synthetic boss lessons).
- `src/content/journey.ts` `bossUnit()` — propagate `...(node.rewardPetDefId ? { rewardPetDefId: node.rewardPetDefId } : {})` onto the synth lesson.

### Grant — `src/state/gameStore.ts` `finishBoss` firstClear block (~283–298)
Replace the random-element egg with the data-driven grant described above.
- Reward def: `cleared?.rewardPetDefId ? resolvePetDef(rewardId) : poolPick(rng)`.
- `poolPick`: same filter + `[starterDef()]` never-empty fallback as `pullEgg` (gameStore.ts:398–399). Pick index `Math.floor(rng()*defs.length)` — keep RNG call order deterministic for tests.
- `makePet({ id: crypto.randomUUID(), species: def.element, defId: def.id, stats: rollStatsFromBands(def.statBands['common'], rng), rarity: 'common' })` — verify `makePet` accepts an explicit `defId` (must NOT default it from species).
- Set new transient `lastHatch = egg` alongside existing `lastPull` / `caughtDefIds`.

### Reveal
- `src/state/gameStore.ts` — add transient `lastHatch: Pet | null` (initial `null`) + `clearHatch()` action. **Exclude from persist partialize** (match `lastStageChange` / `lastLevelUp`). Add `'rewardHatch'` to the `Screen` union.
- `src/components/RewardHatchScreen.tsx` (NEW — verify the path does not already exist; APPEND-safe): reads `lastHatch`; if null `setScreen('petRoom')` (reload guard, mirrors EvolutionScreen); renders `EvolutionCinematic from='egg' to='baby' species={lastHatch.species} def={resolvePetDef(lastHatch.defId)} onDone={() => { clearHatch(); setScreen(lastStageChange ? 'evolution' : 'petRoom'); }}`.
- `src/App.tsx` — route `case 'rewardHatch'` → `<RewardHatchScreen />`; add to `zoneForScreen` (cinematic zone = `null` music, like `evolution`).
- `src/components/RewardScreen.tsx` — Continue `onClick` → `setScreen(lastHatch ? 'rewardHatch' : lastStageChange ? 'evolution' : 'petRoom')` (read `lastHatch` from store).

### Validation — `src/content/validate.ts`
- `validateCourse(course, opts?: { petDefIds?: ReadonlySet<string> })`: when `opts.petDefIds` is provided, for each boss in `[...course.gates, course.finalBoss].filter(Boolean)` with a `rewardPetDefId` not in the set → `push(\`boss <id>: unknown rewardPetDefId <x>\`)`. No-arg behavior unchanged (existing callers/tests unaffected).
- `src/components/admin/AdminShell.tsx` — pass `{ petDefIds: new Set(getActivePetDefs().map(d => d.id)) }` to `validateCourse`.
- `src/components/admin/ImportTab.tsx` — same (so an import with a dangling reward id surfaces the error).

### Admin UI — `src/components/admin/BossesTab.tsx`
- In `BossField` (shared gated+final editor), add a clearable `<select>` over `getActivePetDefs()` (option label = def name, value = def id, plus a "— none —" option that clears). Bind to the BossNode's `rewardPetDefId`. Patch at **node level** (`onPatch({ rewardPetDefId })`) — NOT inside `boss:{}`. Verify `onPatch` accepts node-level partials; if `BossField` only forwards `boss` patches today, widen it.

### xlsx import — `src/content/excelImport.ts` (+ `ImportTab`)
- **Verify first** whether the Bosses sheet is parsed into `BossNode`s. If yes → add an optional `rewardPetDefId` column (blank → omit). If bosses are not sheet-built → defer and note in the plan. No assumption.

### Fold-ins
1. `src/components/EvolutionScreen.tsx` — pass `def={resolvePetDef(pet.defId)}` to `EvolutionCinematic` so custom-sprite pets show their art on real evolution.
2. `src/state/gameStore.test.ts` — add a unit test for the `pullEgg` obtainable-pool filter + `[starterDef()]` fallback (gameStore.ts:398–399), currently only e2e-covered.
3. `src/components/admin/PetsTab.tsx` — fix `setDraft(draft.map(...))` → `setDraft(prev => prev.map(...))` (functional update, stale-closure fix).

## Testing
**Unit**
- `journey.test.ts` — synth lesson carries `rewardPetDefId` when the node has one; omits it otherwise.
- `gameStore.test.ts` — finishBoss firstClear: (a) reward id → exact def granted (defId, element, band stats); (b) no reward id → pool-pick from obtainable defs; (c) dangling reward id → `resolvePetDef` starter-fallback (no blank/throw); `lastHatch` set; `caughtDefIds` unions the granted defId. Plus the fold-in #2 pool-filter test.
- `validate.test.ts` — `validateCourse` with `petDefIds`: dangling reward id → error; valid id → ok; no-arg call unchanged.

**e2e (hermetic — `e2e/`, follow `p4b-gacha.spec.ts` inject pattern)**
- Inject catalog via `window.petDefs`, author a boss `rewardPetDefId` on the course via `window.store`, clear the boss, assert: exact pet granted, hatch cinematic shows, pet marked caught in Collection → Dex.

**Verify gate every slice:** `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run.

## Landmines (carried from handoff)
- `makePet` must get an explicit `defId` — never let it default from species (would re-mint the element built-in).
- `def.statBands` must hold every rarity key — guaranteed for catalog defs (`validatePetDefs` enforces); reward def comes from the validated catalog or `starterDef()`.
- `lastHatch` is transient — must be excluded from persist (else a reload mid-flow replays a hatch).
- `validateCourse` and `validatePetDefs` are separate — the cross-ref needs the id set threaded in.
- Never `git add -A` (stage explicit files); don't hand-edit generated `src/content/seed.ts`.
- "create" target files (e.g. `RewardHatchScreen.tsx`) — confirm they don't already exist; instruct implementers to APPEND to existing test files, not overwrite.

## Out of scope
- Firebase go-live / production (emulators only).
- P4d def-chain evolution (`evolvesToId` runtime transform).
- Persisted "already-granted" tracking set (firstClear suffices).
- Authored reward rarity (fixed `'common'`).

## Manual smoke (admin / live data touched)
Emulators (`npm run emulators`, storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin; author a boss `rewardPetDefId`, clear the boss, confirm the exact pet is granted + hatch plays + marked caught in Collection → Dex.
