# Spec — Phase 0: Art Integration

**Date:** 2026-06-25
**Status:** Approved (brainstorming)
**Branch:** `art-integration`

## Context

Partner delivered the full pet art set (ChatGPT pipeline, in `H:\My Drive\01 Current Projects\AI\AI_design_thinking\Pictures\`). Pets are still emoji placeholders (`🥚🐣🐕🐕‍🦺` in `PetSprite.tsx`). This phase replaces emoji with real art for **all four species**, assigns a **random starter species** at hatch, and adds a **happy/sad expression swap** driven by happiness. It takes the project's first real persist bump since v2 (2→3, adds `species`).

This is **Phase 0 of a four-phase roadmap** (decided in brainstorming):
- **Phase 0 — Art integration** (this spec): wire art, random species, happy/sad. Persist 2→3.
- **Phase A — Decor shop:** 7 room backgrounds as buyable backgrounds. Adds `owned` set + `activeBackground`. Persist bump.
- **Phase B — Pet unlocks:** buy/switch the other 3 species; the 4 elemental eggs become shop icons. Adds `ownedPets` + `activePet`. Persist bump.
- **Phase C — Pattern ladder L3–L5:** pure data, independent, slots anywhere.

## Art inventory (confirmed by inspection)

Four elemental species: **leaf** (green earth bunny), **fire** (orange flame cat), **air** (white/blue owl), **water** (teal aquatic dragon).

- Generic pre-hatch egg: `Animal/pets_egg.png.png` (iridescent).
- 4 elemental eggs: `Animal/` root images `10_09_54`–`10_10_13` — **reserved for Phase B** shop icons (imported but unused in Phase 0).
- 4 adults: `Animal/` root images `10_11_55`–`10_12_13`.
- 4 babies: `Animal/baby/`.
- 4 youngs: `Animal/young/`.
- 13 mood **sheets** (`Animal/mood/`): each is a 4-pose expression strip (content / smiling / calm / sleepy) for a (species, stage). Source of happy/sad poses.

All source PNGs are ~1.2–2.5 MB, cream/near-white background, soft watercolor edges.

## Decisions (from brainstorming)

- **Random starter:** egg hatches into a uniformly-random 1-of-4 species, persisted once at hatch. No re-roll — other species come via Phase B shop.
- **Migrate:** existing already-hatched saves backfill to `species: 'leaf'` (deterministic). Only new hatches roll random.
- **Transparency:** auto-cutout cream background now (ImageMagick), so pets composite cleanly onto Phase-A decor rooms. White owl special-cased.
- **Moods:** happy/sad two-state swap this phase (threshold-driven). Full 13-mood system deferred.

## Design

### 1. Types (`src/data/types.ts`)
- `export type Species = 'leaf' | 'fire' | 'air' | 'water';`
- `export type PetMood = 'happy' | 'sad';`
- Add `species: Species` to the `Pet` interface (in `state/gameStore.ts`).

### 2. Sprite registry (`src/config/sprites.ts`, pure data)
- `SPRITES: Record<Species, Record<PetStage, Record<PetMood, string>>>` — Vite-imported `.webp` URLs (content-hashed, bundled, tree-shaken).
- `EGG_SPRITE: string` — generic iridescent pre-hatch egg.
- `ELEMENTAL_EGGS: Record<Species, string>` — imported, **reserved for Phase B**; exported so Phase B reuses, unused by Phase 0 components.
- Note: `PetStage` includes `egg`; the egg stage renders `EGG_SPRITE`, not a per-species entry. Registry covers `baby | young | adult` per species. Encode this so the completeness test does not demand a per-species `egg` row.

### 3. Asset pipeline (build-time prep — dedicated implementation task)
ImageMagick (`magick`, available). For each (species, stage):
1. Crop the matching mood sheet into quarters (`-crop 4x1@`).
2. Select **happy** = smiling pose, **sad** = eyes-closed/sleepy pose. If a sheet quarter is unusable, fall back to the single-pose `baby/`/`young/` neutral image for both moods (adult uses its sheet).
3. Cutout cream background: corner floodfill + per-image fuzz tuning; **owl special-cased** (white body must survive — use bounded floodfill from corners, not global `-transparent white`).
4. Resize to ~512px tall, export `.webp` quality ~80, target **< 60 kb** each.
5. Output to `src/assets/sprites/<species>/<stage>-<mood>.webp`; generic egg to `src/assets/sprites/egg.webp`; elemental eggs to `src/assets/sprites/eggs/<species>.webp`.

**Visual QA gate:** the prepping agent produces a montage of all generated cutouts; main thread eyeballs it (halos, eaten owl, bad crops) before wiring.

### 4. Pure logic (`src/domain/species.ts`)
- `pickSpecies(rng: () => number = Math.random): Species` — uniform 1-of-4; `rng` injectable for tests.
- `moodFor(happiness: number, max: number): PetMood` — `happiness >= max * THRESHOLD ? 'happy' : 'sad'`, `THRESHOLD = 0.5` (config in `gameConfig.ts` under a `mood` key). Pure, exhaustively tested at/around the boundary.

### 5. Store (`src/state/gameStore.ts`)
- `freshPet()` gains `species: 'leaf'` (placeholder; real value set at hatch — keeps the type total before hatching).
- `hatch()` sets `species: pickSpecies()` alongside `hatched: true`.
- Persist **version 3**. Extend the existing migrate: backfill `species: 'leaf'` when absent, preserving the current inventory backfill. Runs for v2→v3.
- `resetForTest()` resets species to `'leaf'`.

### 6. Components
- **`PetSprite.tsx`:** take `species` + `happiness` (in addition to `stage`, `feedTrigger`). Resolve `SPRITES[species][stage][moodFor(happiness, max)]`; render a `motion.img` (replaces emoji text node) preserving idle-bob, feed-bounce, evolution-pop. `alt` / `aria-label` = `pet-{species}-{stage}-{mood}`. Egg stage renders `EGG_SPRITE`.
- **`EggHatch.tsx`:** render `EGG_SPRITE` image instead of `🥚` (keep idle bob).
- **`PetRoom.tsx`:** pass `species` + `happiness` from store into `PetSprite`.

### 7. Testing (jsdom — pure logic carries the weight)
- `pickSpecies`: injected rng hits all 4 species; full-range sweep covers each bucket.
- `moodFor`: boundary cases (just below / at / above threshold; happiness 0 and max).
- Registry completeness: every `species × {baby,young,adult} × {happy,sad}` resolves to a truthy URL.
- Migrate: v2 save without `species` → `'leaf'`, inventory still backfilled.
- `PetSprite` / `EggHatch`: render-only — correct `<img>` `src`/`alt`, mounts without throwing. **Never assert animated style values.**
- Mock `canvas-confetti` in any test transitively importing `celebrate.ts` (existing convention).

## Out of scope
- Decor rooms / backgrounds (Phase A).
- Buying/switching species; elemental-egg shop icons (Phase B).
- Full 13-mood expression system (sleepy/calm/etc.).
- L3–L5 content (Phase C).

## Risks / notes
- **Owl cutout** is the main visual risk — global white-removal eats it. Bounded corner floodfill + QA gate mitigates; framed-card fallback if a sprite can't be cleanly cut.
- **Bundle weight:** 4×3×2 = 24 pet webps + egg ≈ under ~1.5 MB raw / well under that gzipped at q80/512px. Acceptable vs current ~127 kb JS bundle (images load separately, hashed).
- `npx tsc -b` for typecheck (root `tsconfig` has `files: []`; `--noEmit` is a no-op).
