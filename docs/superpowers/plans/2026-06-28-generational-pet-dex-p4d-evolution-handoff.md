# Handoff — Generational Pet Dex P4d (def-chain evolution: `evolvesToId` runtime transform)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — checkout `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; whole line promotes as one release via **PR #33**, base `main`).
**Status:** NOT STARTED. **Brainstorm first** (`superpowers:brainstorming`), then spec → plan → subagent-driven execution (the cadence that caught real misses in P4a/b/c — keep it).
**Predecessors:** `[[sentence-pet-generational-dex-p4c-reward-pets]]` (reward pets — DONE), `[[sentence-pet-generational-dex-p4b-gacha]]`, `[[sentence-pet-generational-dex-p2a]]` (where gen/dexNo + the evolution structure on `PetDef` landed). Epic handoff `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4-plus-handoff.md` ("P4d — Evolution execution").

## ⚠️ Deferred (not in this slice)
Firebase go-live / production is deferred by decision (emulators only). Out of scope.

## Goal
Today a pet **evolves visually** (stage: egg→baby→young→adult, driven by XP/level in `domain/xp.ts` → `lastStageChange` → the evolution cinematic) but its **identity** (`defId`) never changes — a Bulbasaur stays the Bulbasaur def, just at a later art stage. P4d makes a pet **become a different authored PetDef** when it evolves: a `PetDef` already carries `evolvesToId` / `evolvesFromId` / `evolutionStage` (authored in `PetsTab`; reciprocity enforced by `reconcileEvolution`). P4d advances `pet.defId` along `evolvesToId` at the evolution moment, so the dex chain (`domain/dex.ts evolutionChain`) reflects a real species transform and the new def's sprite/stats apply.

## What exists today (VERIFY each before building — I did not deep-trace the runtime)
- **`PetDef` evolution fields** — `evolvesFromId?`, `evolvesToId?`, `evolutionStage?` exist on the type (`src/data/types.ts`) and are authored in `src/components/admin/PetsTab.tsx` (`addPet` seeds them; `reconcileEvolution` keeps `evolvesFromId`/`evolvesToId` reciprocal — see `[[sentence-pet-generational-dex-p2b]]`). Confirm exact field names/shape.
- **Stage evolution runtime** — `src/domain/xp.ts applyXp` returns `{ pet, levelUp, stageChange }`; `stageChange: StageChange | null` (`{from,to}` over `PetStage`). The store (`gameStore.ts` `finishRound`/`finishBoss`/a feed/level path) threads `lastStageChange` → `EvolutionScreen` plays the cinematic. P4d's def-swap should hook the SAME moment a `stageChange` fires (or a specific stage threshold — DECIDE which stage triggers the def-chain hop; not every stage bump is a species change).
- **Dex chain view** — `src/domain/dex.ts` `evolutionChain` already walks `evolvesFromId`/`evolvesToId`; `DexDetail` renders the chain overlay (P4a). Confirm it reads the same fields P4d advances along.
- **Sprite/def resolution** — `resolvePetDef(pet.defId, defs)` + `spriteSrc(species, stage, mood, def)`; `usePetDefs()` reactive in React, `getActivePetDefs()` snapshot in store actions. P4c threaded `def` into every cinematic (incl `EvolutionScreen`) — so once `defId` advances, the cinematic + room already render the new def's art with no extra wiring. Verify.
- **`caughtDefIds`** (P4a) unions defIds; evolving into a new def should record the evolved def caught (`addCaught(caughtDefIds, evolvedDefId)`) — like P4c's grant does.

## What to build (decide each in brainstorm)
1. **Trigger.** Which evolution moment advances `defId`? Options: when `applyXp` returns a `stageChange` whose target stage matches `def.evolutionStage`; or a dedicated level threshold; or only specific authored hops. Map `evolutionStage` semantics to the `PetStage` ladder first — don't assume 1:1.
2. **The transform — pure domain fn.** Add something like `evolvePetDef(pet, defs): PetInstance` (pure, data-in) that, when `def.evolvesToId` is set and the trigger fires, returns the pet with `defId = evolvesToId`, `species = nextDef.element`, and DECIDE stat handling (keep current stats? re-band from `nextDef.statBands`? carry growth?). Keep it pure — pass `defs` in, no registry reach-in (the P4c/P4b convention).
3. **Where it hooks in the store.** The same `set((s) => …)` block that produces `lastStageChange`. Be careful: `applyXp` mutates stage; the def-swap must compose cleanly with `lastStageChange`/`lastLevelUp` and the existing cinematic routing. (P4c added a `rewardHatch` hop before `evolution` — make sure P4d's species-change still routes through `evolution` correctly; the EvolutionScreen reads `selectActivePet` so it'll show the post-swap def if the swap lands before the screen renders.)
4. **Dex recording.** Union the evolved def into `caughtDefIds` at the swap site (mirror P4c grant). The chain overlay should then light up the evolved form.
5. **No `evolvesToId` = no-op.** A def at the end of its chain (or a one-stage def) just does the visual stage bump as today. Never blank: if `evolvesToId` is dangling, `resolvePetDef` starter-fallback already guards — but prefer validating the chain at author time (extend `validatePetDefs`/`reconcileEvolution` if not already).
6. **Persist.** Pets persist with `defId` — an evolved pet's new `defId` saves naturally, no PERSIST_VERSION bump expected (confirm; if you add a new persisted field, bump + migrate like P4a 16→17).

## Landmines (carried)
- Don't conflate **stage** (art: egg/baby/young/adult on ONE def) with **def-chain hop** (species change to a DIFFERENT def). P4d is the latter; the former already works. The trigger maps one onto the other — get that mapping explicit.
- `reconcileEvolution` reciprocity + post-save registry swap had an optimistic-update regression in P2b (caught in review) — if you touch authoring, re-check.
- Pure domain fns stay pure (pass `defs`/data in). React: `usePetDefs()`; store actions: `getActivePetDefs()` snapshot.
- `makePet`/def swap must keep an explicit `defId` (never default from species) — same trap P4c flagged.
- Never `git add -A` (stage explicit files); don't hand-edit generated `src/content/seed.ts` (`npm run seed:export`); "create" targets — verify they don't exist, APPEND to existing test files (subagent listings miss subdir test files; has clobbered tests before).

## Process for the next session
1. `superpowers:brainstorming` — lock decision #1 (trigger) + #2 (stat handling) before planning; those drive everything.
2. `superpowers:writing-plans` → `superpowers:subagent-driven-development` (fresh subagent per task, two-stage review spec→quality, final whole-feature review).
3. Verify gate every slice: `npx vitest run`, `npx tsc -b` (NOT `--noEmit`), `npx vite build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run.
4. Hermetic e2e: `window.store` + `window.petDefs` ({get,set,builtins}) + `window.contentStore` ({…,setBundle}) DEV handles drive grant/evolution with no auth/emulators — see `e2e/p4c-reward-pets.spec.ts` for the inject-catalog + inject-bundle pattern (the cleanest template). Full-UI cinematic asserts auth-gate-skip like `boss.spec.ts` test B.
5. Manual smoke: emulators (`npm run emulators`, storage :9199), `npm run dev:admin` seed, `/#admin` 🔑 Dev admin → author an evolution pair (`evolvesToId`), level/clear to the trigger, confirm the pet becomes the evolved def (sprite + dex chain lights the next form).

## Carried optional fold-ins (do if you touch the area)
- e2e p4c test D (full-UI hatch render) only runs with Firebase auth — if a hermetic UI-mount path appears, un-skip it.
- BossesTab/Import: a course-level "evolution preview" is NOT in scope; resist scope creep into authoring UI unless decision #5 needs validation there.
