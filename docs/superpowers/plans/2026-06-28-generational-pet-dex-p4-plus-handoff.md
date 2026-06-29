# Handoff — Generational Pet Dex P4+ (end-game systems)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — actual checkout `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; the whole line promotes as one release — currently open as **PR #33**).
**Status:** NOT STARTED. P1–P3b of the generational dex are DONE; the admin pet-def hydration + auth-hang fixes are DONE. 929 unit tests pass, `tsc -b` clean, `npm run build` clean.
**Predecessors:** `[[sentence-pet-generational-dex-p3b]]`, `[[sentence-pet-admin-petdef-hydration-fix]]`, `[[sentence-pet-auth-loading-hang-fix]]`. Epic spec `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md`.

## ⚠️ Explicitly deferred (NOT in this handoff)
**Firebase go-live / production** is deferred by decision. The app runs entirely on emulators today (`.env.local` → `demo-sentence-pet`, `VITE_USE_EMULATOR=true`; `.env.local.qabak` to restore). Provisioning the prod project, deploying `firestore.rules`/`storage.rules`, seeding prod data (`npm run seed:push`), prod env config, and prod smoke are a separate ops phase — out of scope here.

## What this handoff covers
The structural-but-unwired end-game systems. The dex *data model* exists; nothing consumes the obtainability/evolution/reward hooks yet. This is an EPIC — decompose into independently-shippable slices (P4a…P4d) and **brainstorm each slice on its own** before planning. Suggested order below (each ships working software).

---

## P4a — Dex tracking (seen / caught) — ✅ DONE (PR #33, commits 5695bc4→c26fc9a)
**Shipped:** persisted accumulating `caughtDefIds` (PERSIST_VERSION 16→17 + migration), `src/domain/dex.ts` (`addCaught` + `evolutionChain`), `DexGrid` (caught/silhouette grid) + `DexDetail` (def-chain overlay), `My Pets | Dex` ARIA tab in Collection, shared `formatDexNo`. 951 tests green. Decision: single "caught" flag, one dex entry per PetDef (not per stage), adult-stage art. Spec `docs/superpowers/specs/2026-06-28-generational-pet-dex-p4a-dex-tracking-design.md`. **Catalog-staleness — FIXED** (`ea5854b`): the pet-def registry is now a subscribable external store (`subscribePetDefs` + notify in `setActivePetDefs`, skipping identical swaps); DexGrid reads it via the `useSyncExternalStore` hook `usePetDefs` (`src/state/usePetDefs.ts`). Dex reflects async `hydratePetDefs` without reload. Reuse `usePetDefs` for any future view reading `getActivePetDefs()`. Note: `selectCaughtSet` must NOT be passed directly to `useGameStore()` (new Set/call → infinite loop) — use useShallow+useMemo.

---

**Original goal (for reference):** Record which `PetDef`s the player has discovered/obtained; show caught vs silhouette in the Collection screen. Foundation for obtainability (P4b).

**What exists:** Nothing. No seen/caught state anywhere (`grep` for seen/caught/discovered → empty). `Collection` screen exists (`Screen` union has `'collection'`); `PetInstance` records owned pets but there's no "dex" of all defs with discovery status.

**What to build:** a persisted set of discovered `defId`s on the game store (`src/state/gameStore.ts`, **bump `PERSIST_VERSION`** — currently 16, `src/state/gameStore.ts:109`); mark-seen on hatch/gacha/reward; Collection UI showing every enabled `PetDef` (from `getActivePetDefs()`) as caught (full art via `spriteSrc(def.element, …, def)`) or undiscovered (silhouette). Decide: seen-vs-caught distinction, or single "obtained" flag (YAGNI — probably just "caught").

**Landmines:** `PERSIST_VERSION` bump needs a migration (default empty set for old saves). Dex must enumerate the *live* catalog (`getActivePetDefs()`), which on the admin route is now hydrated (fix landed) and on the player route hydrates via `main.tsx`.

## P4b — Gacha over the dex
**Goal:** Gacha pulls real `PetDef`s from the dex (assigning `defId`), not the hardcoded 4 elements; respects per-def obtainability + rarity.

**What exists:** `pullEgg` (`src/domain/gacha.ts`) rolls `rarity → species → stats` over a **hardcoded** `const SPECIES = ['leaf','fire','air','water']` and builds a pet via `makePet({species})` — no `defId`, no dex. `GAME_CONFIG.gacha` (`src/config/gameConfig.ts:43`) holds the rarity table. `Gacha.tsx` drives the reveal (uses `EvolutionCinematic`).

**What to build:** roll over the **enabled** `PetDef`s (`getActivePetDefs().filter(d => d.enabled)`), assign the chosen `defId` onto the `PetInstance`, derive species from `def.element`. Add an obtainability gate (which defs are pullable — e.g. a `gachaObtainable` flag on `PetDef`, or exclude reward-only/evolution-only defs). Mark the pulled def caught (P4a).

**Landmines:** **RNG-order contract is pinned by tests** — `gacha.ts:4` "Order is the species-index contract for the uniform pull below — tests pin it; do not reorder." Changing the pull from species-index to def-index will break `src/domain/gacha.test.ts`; update the contract deliberately (don't just silence tests). `pullEgg` is pure — keep it pure (pass the candidate def list in, don't import the registry inside).

## P4c — Reward pets (`rewardPetDefId`)
**Goal:** Completing a course/boss grants a specific pet.

**What exists:** Only a planned comment — `src/data/types.ts:116` "Stable `id` is course-referenceable later (P4 rewardPetDefId)." No field. Course/Boss completion runs through `finishBoss` (drill-revamp P3a; course completion + `courseComplete`). Admin authoring: BossesTab / course editor.

**What to build:** add `rewardPetDefId?: string` to the Course/Boss shape (`src/content/course.ts`) + `validateCourse` (ref must resolve to a `PetDef.id`); surface it in the admin BossesTab; on `finishBoss`/course-complete, grant the pet (`makePet` with that `defId`) + mark caught (P4a). Decide: grant-once vs repeatable.

**Landmines:** persisted-store change if grant state is tracked; `validateCourse` must reject dangling `rewardPetDefId`. The xlsx import (`ImportTab`/`parseWorkbookToCourse`) Bosses sheet may need a `rewardPetDefId` column.

## P4d — Evolution execution (def-chain)
**Goal:** A pet actually transforms into its evolved `PetDef` (`evolvesToId`), not just the cosmetic stage bump.

**What exists — IMPORTANT, two different "evolutions":**
- **Stage evolution (DONE):** egg→baby→young→adult via leveling. `gameStore.ts:215` sets `screen:'evolution'` on a `lastStageChange`; `RewardScreen.tsx:119` routes there; `EvolutionScreen`/`EvolutionCinematic` play it. This already works.
- **Def-chain evolution (UNWIRED):** `PetDef.evolvesToId` + `evolutionStage` (`src/data/types.ts:127-128`) are authored in the admin and validated (`reconcileEvolution`), but **nothing transforms a `PetInstance` from its `defId` to its `evolvesToId`** at runtime.

**What to build:** a trigger (level threshold / item / boss) that swaps a pet's `defId` to `def.evolvesToId`, re-deriving species/art from the new def; reuse `EvolutionCinematic`. Decide the trigger and whether stats carry over or re-roll.

**Landmines:** don't conflate with stage evolution. `resolvePetDef` (`src/domain/petDef.ts`) + the element-guard in `spriteSrc` already handle defId→art; the evolved def's `element` may differ from the pet's current species — the element-guard will then (correctly) suppress art until species is updated to match, so **update `PetInstance.species` to the evolved `def.element` in the same transaction.**

---

## Smaller follow-ups (fold into whichever phase touches the area)
- **Evo/Gacha custom-art threading (P3b leftover):** thread `defId` into `EvolutionCinematic` + `Gacha` so uploaded sprites show during evolution/reveal (today they're species element-art only). One-prop pattern, same as the P3a consumer wiring. Natural fit with P4b/P4d.
- **Orphan-sprite Storage cleanup:** P3b chose "leave orphans." If revisited, `deleteObject` the old ref on sprite clear/replace/def-delete (`src/firebase/storage.ts`). Adds error paths.
- **PetsTab `setDraft` concurrency fix (tracked):** `patch()`/`setStarter`/`rename`/`addPet`/`deletePet` use non-functional `setDraft(draft.map(...))` (`src/components/admin/PetsTab.tsx`) — stale-closure; rapid edits can drop a write. Fix = `setDraft(prev => prev.map(...))`. Pre-existing, low-risk, do anytime.
- **One-frame element-art flicker** on `PetSprite` src re-arm (cosmetic). **Automated storage-rules test** (mirror `test:rules` firestore pattern). **Client image transcode** before upload. All optional.

## Process for the next session
1. `superpowers:brainstorming` — **required first, per slice.** Lock scope/decisions for P4a (or whichever slice) before planning. Don't try to spec all of P4 at once.
2. `superpowers:writing-plans` → `superpowers:subagent-driven-development` (per-task, two-stage review + final whole-feature review — the cadence used for P3b and the fixes).
3. Verify gate every slice: `npm test`, `npx tsc -b` (NOT `--noEmit`), `npm run build`. Flaky Windows worker-fork crash ("Worker exited unexpectedly") → re-run, not a real failure.
4. Manual smoke when a slice touches admin or live data: emulators (`npm run emulators` — now includes storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin sign-in. For storage, override `VITE_EMULATOR_HOST=127.0.0.1` and note vite may land on 5178+ when other instances hold 5173. The opt-in e2e smoke pattern is `e2e/p3b-sprite-upload-smoke.spec.ts` (`RUN_SPRITE_SMOKE=1`, `SMOKE_BASE_URL`).

## Conventions / hazards (carried)
- **Never `git add -A`** — stage explicit files (concurrent-session contamination).
- **"create" vs existing files** — verify a "create" target doesn't already exist before writing; subagent file listings miss subdir test files. This clobbered `AdminRoute.test.tsx` (6 tests) and a P3a test file — both caught in review. Instruct implementers to APPEND, not overwrite.
- **`src/content/seed.ts` is generated** (`npm run seed:export`) — don't hand-edit.
- **Never-blank invariant** — `PetSprite`'s `<img onError>` → element-art fallback must survive any change.
- Pure domain functions (`pullEgg`, `spriteSrc`, `resolveCourseBundle`) stay pure — pass data in, don't reach into module registries.
