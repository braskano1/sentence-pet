# Handoff — Admin Pet Authoring (data-driven pet catalog + sprite uploads)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell)
**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`; the whole drill-revamp + this line promotes as one release later)
**Status:** NOT STARTED — this is a forward-looking handoff. Next agent: brainstorm → spec → plan → build (subagent-driven, two-stage review per task), same as P3a/P3b were run.

## Goal

Let an admin **author the creatures that exist in the game** — a data-driven **pet catalog** (definitions), replacing today's hardcoded 4-species union — and **upload new sprite art** for them. Today every pet is one of 4 baked-in species with pre-baked art; there is no admin pet authoring and no pet catalog anywhere.

**Two scope decisions already made (do not re-litigate):**
1. **Author pet catalog (definitions):** admin defines creatures (name, element, stat/rarity bands, evolution stages, sprites) stored as content in Firestore, parallel to courses.
2. **Upload new sprite assets:** genuinely new-looking creatures — admin uploads per-stage/mood images (Firebase Storage) + a dynamic sprite registry; not limited to the existing 4 looks.

> **Forward link (deferred):** the course-journey update comes LATER and will **connect to pets** — courses/bosses will reward or unlock specific pets. That means pet definitions need **stable, referenceable IDs**. Build the pet catalog FIRST; the course side will reference pet-def ids afterward. Design the catalog so a `Course`/`BossNode`/`Lesson` can later carry a `rewardPetDefId?` without reworking the pet model.

## Current state (grounded — verify line numbers before relying)

The 4 species are a **hardcoded union** baked in everywhere. This is the central thing the feature changes.

- **Model:** `src/data/types.ts` — `Species = 'leaf'|'fire'|'air'|'water'` (~L102), `Rarity` (~L104), `PetStage = 'egg'|'baby'|'young'|'adult'` (~L88), `BattleStats {hp,atk,def,spd,luk}` (~L108), `NutritionBars` (~L93), `PetInstance` (~L117: `id, species, hatched, xp, happiness, bars, stats, growth, rarity, name`). `PetInstance.species` IS the element today.
- **Domain:** `src/domain/pets.ts` (`makePet`, `rollStats`, `rollRarity`, `rollStatsForRarity`, `rarityForStats`, `allocateStatPoints`); `src/domain/species.ts` (`SPECIES[]` const, `pickSpecies`, `moodFor`); `src/domain/xp.ts` (`STAGE_LEVEL={baby:1,young:16,adult:36}`, xp curve). Stage is **display-derived from xp**, never stored.
- **Sprites:** `src/config/sprites.ts` — static `SPRITES: Record<Species, Record<stage, Record<mood,string>>>` of bundled `.webp` imports (36 files: 4 species × 3 stages × 2 moods + egg). `spriteSrc(species,stage,mood)`. `src/config/petDisplay.ts` `petStageSprite`/`petLevel`. Assets at `src/assets/sprites/{species}/{stage}-{mood}.webp`.
- **Gacha:** `src/domain/gacha.ts` `pullEgg` (rng order: rarity → species → 5 stats); config `src/config/gameConfig.ts` `gacha.rarities` (weights + stat bands); `src/state/gameStore.ts` `pullEgg` action; `src/components/Gacha.tsx`. The obtainable "pool" is hardcoded RNG over the 4 species — **no catalog of obtainable pets**.
- **Persistence:** `src/state/gameStore.ts` `pets: PetInstance[]` + `activePetId` in `PersistedState`; cloud per-pet docs `users/{uid}/pets/{petId}` with `PetDoc = PetInstance` 1:1 (`src/sync/mapping.ts`); reconcile in `src/sync/reconcile.ts`. **No content-level pet catalog exists** (pets are purely per-user, RNG-generated).
- **Collection:** `src/components/Collection.tsx` shows owned `pets[]`; no "all possible pets" registry, no Pokédex.
- **Boss ↔ pet:** `src/content/model.ts` `CheckpointBoss { tierId, element: Species, name, rivalSprite:{species,stage} }` — bosses reuse the pet sprite registry. Admin `src/components/admin/BossesTab.tsx` hardcodes the species/stage dropdown options.
- **Admin tool today:** `src/components/admin/AdminShell.tsx` drafts a single **`Course`** (Pool / Journey / Bosses / Import tabs; `validateCourse` + `saveCourse` + `setCourse`). It does NOT touch pets except boss `rivalSprite` selection.

## The core architectural shift

**Split ELEMENT from CREATURE.** Today `species` conflates both. Keep the 4 **elements** fixed (they drive the battle matchup wheel and existing element logic — do NOT make those data-driven) and introduce a data-driven **pet definition** (the authorable creature) that *references* an element.

Proposed model (refine in brainstorming):
```
PetDef (NEW content entity, admin-authored, global):
  id            // stable, course-referenceable
  name
  element       // one of the fixed 4 (matchup wheel)
  rarityBias?   // optional weighting / allowed rarities
  statBands     // per-stat [min,max] (or per-rarity bands)
  stages        // names/thresholds if customizable; default to STAGE_LEVEL
  sprites       // per-stage × mood image refs (Storage URLs) + egg
  enabled       // in the gacha pool?
```
- `PetInstance` gains `defId: string` (the creature) while **keeping `species`/element for matchup**. Migration: map existing pets' `species` → element + a default `PetDef` per element so old saves resolve.
- Persisted-field change touches the full chain (see Landmines): `GameState`, `freshState`, `PersistedState` Pick, `selectPersisted`, `migrate` backfill, `PERSIST_VERSION` bump, AND cloud-sync fixtures (`mapping`/`reconcile`/`cloudSync` + the `PetDoc` 1:1 map). `l1Mode`/`courseComplete` are the reference patterns from P2/P3a.

## Scope

### 1. Pet-definition content model + persistence + migration
- New `PetDef` type + a Firestore content collection (mirror `content/courses`: e.g. `content/petDefs/{id}/doc` + a `content/petDefsIndex`). New `validatePetDef` (unique ids, name non-empty, element ∈ the 4, stat bands min≤max in range, required sprite refs present per stage/mood). New `savePetDefs`/`fetchPetDefs`/`hydratePetDefs` (cache-first, never-blank fallback — same discipline as `hydrateCourse`/`cachedCourse`).
- Make species **data-driven internally** while keeping the 4 elements: a runtime registry of pet defs the gacha/collection/battle resolve against; built-in defaults for the 4 elements as fallback so the game never blanks.
- Migrate existing per-user pets: `species` → `element` + default `defId`.

### 2. Admin "Pets" catalog tab (CRUD)
- New admin surface to create/edit/delete pet defs. **Do NOT fold this into the Course draft** — pet defs are course-independent global content with their own draft/validate/save path. Either a new tab in `AdminShell` with its own draft+save (not the Course draft), or a sibling admin route. Mirror the Course persistence pattern (validate-gates-save).
- Reuse the existing form conventions from `BossesTab`/`PoolTab` (controlled inputs, full accessible-name labels per the P3b a11y pass, `aria-live` error list).
- The Bosses tab's hardcoded species/stage dropdowns should eventually source from the pet catalog (follow-on, note it).

### 3. Sprite upload pipeline (Firebase Storage)
- Admin uploads per-stage × mood images → Firebase Storage (bucket already in `firebaseConfig`); store download URLs on the `PetDef`.
- **Dynamic sprite registry:** `spriteSrc` resolves a pet's def sprites with fallback to the built-in 4-element art (never-blank). Loading states for remote images.
- Storage **security rules** (admin-claim write, public read) + **Storage emulator** wired into `firebase.json` + local dev (extend the existing emulator + `npm run dev:admin` workflow).
- This is the biggest/riskiest piece — likely its own phase.

## Suggested phasing (each phase ships working software; brainstorm/spec/plan per phase)
- **P1 — model + persistence + migration (no UI, reuse existing 4 sprite sets):** `PetDef` type, Firestore `content/petDefs`, `validatePetDef`, hydrate/cache, `PetInstance.defId` + migration (PERSIST_VERSION bump + cloud-sync fixtures). Make resolution data-driven internally; the 4 elements map to default defs using existing art. Green tests + build.
- **P2 — admin Pets catalog tab (reuse existing sprite sets):** CRUD pet defs over element-based existing art; validate + save + a11y. Players can now obtain admin-authored creatures (stat/name/rarity variants over the 4 looks).
- **P3 — sprite upload + dynamic registry:** Storage upload UI, dynamic `spriteSrc` with fallback, Storage rules + emulator. Genuinely new-looking creatures.
- **P4 (separate, later — the "connects to pet" work):** gacha pool sourced from the catalog (enabled defs + weights); course/boss **rewardPetDefId** referencing pet-def ids (the course-journey update). Do this AFTER the catalog is stable.

## Landmines (carried + new)
- **`Species` union is load-bearing** across gameStore, domain (`pets.ts`/`species.ts`), `config/sprites.ts`, `petDisplay.ts`, gacha, bosses, and admin dropdowns. Changing it to a free string id ripples widely — prefer the **keep-element-add-defId** split so the battle matchup wheel and the 4-element logic stay intact.
- **Persisted-field change is ~8 sites + cloud-sync fixtures** (`GameState`, `freshState`, `PersistedState` Pick, `selectPersisted`, `migrate` backfill, `PERSIST_VERSION` bump, `mapping`/`reconcile`/`cloudSync` tests, `PetDoc` map). Reference patterns: `l1Mode` (v14), `courseComplete` (v15).
- **Never-blank discipline:** content loads are cache-first with seed fallback; remote sprites must fall back to built-in art and show loading state — the game must never render a blank pet.
- **Type gate is `npx tsc -b`** (NOT `tsc --noEmit`, a no-op here); vitest alone misses excess-property / PersistedState shape breaks.
- **Don't fold pet defs into the Course draft** — separate content type, separate validate/save/hydrate. The admin tool migrated to a `Course` draft in P3b; pets are a sibling, not part of it.
- **Reuse, don't rebuild:** gacha (`domain/gacha.ts`), battle, collection, sprite registry, xp/stage logic — feed them resolved defs; keep the 4-element matchup wheel.
- **Stage explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged (emulator config) — **never stage/commit it** without checking; if you add the Storage emulator you'll need to decide how to land that change deliberately.
- **`src/content/seed.ts` is generated** (admin export + `seed:export`); a pet-defs seed should follow the same generated pattern, not hand-edit.
- **`.env.local` holds a real ELEVENLABS key + is gitignored** — don't echo or commit it.

## Open decisions for brainstorming
- Element vs creature split exact shape (one `element` field + `defId`, vs a richer taxonomy). Confirm elements stay the fixed 4.
- Stage thresholds: keep global `STAGE_LEVEL` or per-def custom stages?
- Stat bands: per-def, or per-def × per-rarity (gacha uses rarity bands today)?
- Pet-defs admin surface: a new tab in `AdminShell` (own draft) vs a separate `#admin-pets` route.
- Sprite required set: which stage×mood images are mandatory vs fall back to a "happy" or element default?
- Storage emulator + rules: how to land `firebase.json` changes given it's intentionally unstaged today.

## Dev / test harness already in place (reuse)
- Emulators (auth :9099, firestore :8080); `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}` claim; one-click **🔑 Dev admin sign-in** on `/#admin` (DEV-only). Admin page is the hidden hash route **`/#admin`**.
- P3b opt-in browser smoke harness: `e2e/p3b-smoke.spec.ts` (`RUN_P3B_SMOKE=1`) + `scripts/p3b-smoke-setup.mjs`; `dist-smoke/` gitignored. Mirror this pattern for a pet-catalog smoke.
- Verify with `npm test`, `npm run build`, `npx tsc -b`; manual smoke offline against the emulator.

## Suggested skills for the next session
- `superpowers:brainstorming` — pin the element/creature model + sprite/storage shape before planning.
- `superpowers:writing-plans` then `superpowers:subagent-driven-development` — per-phase, two-stage review (how P3a/P3b ran).
- `accessibility` — the new Pets admin surface + upload UI.
- `claude-api` is NOT relevant here.
