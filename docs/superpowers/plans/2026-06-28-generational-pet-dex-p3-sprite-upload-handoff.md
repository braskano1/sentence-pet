# Handoff — Generational Pet Dex P3: per-`PetDef` sprite upload

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — actual checkout at `D:/ai_projects/AI_design_thinking/sentence-pet` (NOT the H:\ Google-Drive copy, which only holds design docs).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; the whole drill-revamp + pet-authoring line promotes as one release later).
**Status:** NOT STARTED. **P1 + P2a + P2b are DONE** on `journey-redesign` (model + validation + migration + the full `PetsTab` authoring UI; 882 tests green, `tsc -b` + `npm run build` clean).
**Spec (epic):** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md` — P3 is one line there ("Per-`PetDef` sprite upload (overrides element art); Storage rules + emulator"). **This phase needs its own design pass before planning** (see "Brainstorm first" below).
**P2b plan (reference for conventions/cadence):** `docs/superpowers/plans/2026-06-28-generational-pet-dex-p2b.md`.

## Goal

Let an admin upload custom art for an individual `PetDef` that **overrides** the element-based built-in sprite. Today every creature of element `leaf` shares the 4-element art; P3 makes each authored creature able to carry its own sprite(s). This unblocks authoring a real generational dex with distinct creatures (the structure shipped in P2; this is the art axis).

The work has three parts: (a) **Firebase Storage integration** (greenfield — none exists yet), (b) a **sprite-upload control in `PetsTab`'s `PetForm`**, and (c) a **resolver change** so the game renders the uploaded sprite with an element-art fallback.

## ⚠️ Brainstorm first — real open design questions

Unlike P2b (which was fully locked by the spec), P3 has genuine unresolved design decisions. **Start with `superpowers:brainstorming`** to settle these with the user before writing a plan:

1. **Sprite granularity — the big one.** Current art is **per-stage × per-mood = 6 variants** per species (baby/young/adult × happy/sad), plus a generic egg. Resolver: `spriteSrc(species, stage, mood)` at `src/config/sprites.ts:67`. Options for a `PetDef` override:
   - **MVP single-image:** one uploaded sprite used for all stages/moods; element art still used for egg. Cheapest to author (1 upload/creature) but no mood/stage variety.
   - **Full set:** all 6 variants uploadable, each independently falling back to element art when absent. Richest, but 6 uploads × 150 creatures is heavy authoring.
   - **Middle:** one sprite per *stage* (3), mood reused; or just adult-happy override. Decide with the user — this drives the data shape AND the upload UI.
2. **Fallback granularity.** Per-variant fallback (any missing variant → element art) vs all-or-nothing (must upload the full set or none). Per-variant is friendlier and preserves never-blank.
3. **Data shape on `PetDef`.** A new optional field — e.g. `spriteUrls?: Partial<Record<PetStage, Partial<Record<PetMood, string>>>>`, or a flatter `spriteUrl?: string` for the MVP. Whatever is chosen, it's a **content field** (Firestore `content/petDefs`), validated by `validatePetDefs`, hydrated/backfilled — same lifecycle as the P2a v2 fields.
4. **Upload mechanism.** Firebase Storage upload (the spec's intent; needs emulator + rules) vs. a simpler interim (admin pastes a hosted URL). Storage is the real target; confirm scope.
5. **Storage path + rules.** e.g. `petDefs/{defId}/{stage}-{mood}.webp`; rules allow admin-claim writes + public (or auth) reads.

## What exists already (reuse — do NOT rebuild)

### Sprite resolution / rendering
- **Resolver:** `spriteSrc(species: Species, stage: PetStage, mood: PetMood): string` — `src/config/sprites.ts:67-69`. Returns `EGG_SPRITE` for `stage==='egg'`, else `SPRITES[species][stage][mood]`. **This is the single hook point** — P3 makes it consult the `PetDef` override before the element fallback (e.g. add an optional `def?: PetDef` param, or resolve via the active pet's `defId`).
- **Registry:** `SPRITES: Record<Species, Record<SpriteStage, Record<PetMood, string>>>` — `src/config/sprites.ts:43-77`, built from static `.webp` imports.
- **Component:** `src/components/PetSprite.tsx` — calls `spriteSrc(species, stage, mood)` at line 47; derives mood via `moodFor(happiness, …)`. **Used by many consumers** (PetRoom, Gacha, EvolutionCinematic, reward/boss screens) — threading a `def`/`defId` through all of them is the main integration cost. Cheaper alternative: have `PetSprite` resolve the def itself from `defId` via `resolvePetDef` (already exists: `src/domain/petDef.ts:57`).
- **Assets:** `src/assets/sprites/{species}/{stage}-{mood}.webp` (static imports). Uploaded sprites are runtime URLs — needs loading/error handling (see landmines).
- **Mood:** `moodFor(happiness, max)` in `src/domain/species.ts`.

### `PetDef` + lifecycle (from P1/P2a/P2b)
- **Type:** `src/data/types.ts:118` — `PetDef { id, name, gen, dexNo, types, element, statBands, evolvesFromId?, evolvesToId?, evolutionStage?, starter?, enabled }`. **No sprite/art field yet** — P3 adds one.
- **`element: Species`** (`types.ts:124`) is documented as the art-family / fallback sprite source — the override layers on top of it.
- **Resolve def from instance:** `resolvePetDef(defId, defs?)` — `src/domain/petDef.ts:57` (never null; falls back to starter). Every `PetInstance` already carries `defId` (`types.ts:146`), set since P1.
- **Validation:** `validatePetDefs(defs)` — `src/content/validate.ts:129`. Add any sprite-field rules here (e.g. URL non-empty if present); same `{ok, errors[]}` shape surfaced by the admin's `aria-live` error `<ul>`.
- **Migration:** `backfillPetDefs(raw)` — `src/content/petDefMigrate.ts:14`, wired into `cachedPetDefs`/`hydratePetDefs` before validate. If the sprite field is optional, no backfill needed; if defaults are wanted, extend here.
- **Persistence:** `fetchPetDefs`/`savePetDefs` (`src/firebase/content.ts`), `cachedPetDefs`/`writePetDefsCache` (`src/content/cache.ts`), `hydratePetDefs` (`src/content/load.ts`). The `PetsTab` save path already does `savePetDefs` → `setActivePetDefs` + `writePetDefsCache` (swap registry **after** save).

### Admin surface
- **`PetsTab`** — `src/components/admin/PetsTab.tsx`. `PetForm` already has fieldsets for scalars, stat bands, and evolution; a **Sprites fieldset** slots cleanly as a new `<fieldset>` (mirror the existing ones: implicit `<label>`-wrap, accessible names, `aria-live` errors, immutable patch via `onPatch`). Self-contained draft + validate gate + Save already in place.
- **Dev harness:** `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; `/#admin` → 🔑 Dev admin sign-in (DEV-only). Admin gate `src/auth/adminEntry.ts` + `AdminRoute.tsx`.

### Firebase (Storage is greenfield)
- **App init:** `src/firebase/app.ts` — `initializeApp()` only; **no `getStorage()` anywhere**. `storageBucket` is read from `VITE_FIREBASE_STORAGE_BUCKET` (`.env.local` → `demo-sentence-pet.appspot.com`).
- **`firebase.json`** currently: `firestore.rules` + emulators auth :9099, firestore :8080 (both with `host: 0.0.0.0`), UI disabled, singleProjectMode. **No Storage block, no `storage.rules` file.** ⚠️ `firebase.json` is **intentionally modified-but-unstaged** locally (the unstaged diff is the `host: 0.0.0.0` additions). P3 must add a Storage emulator block + `storage` rules pointer here — coordinate deliberately: decide whether to finally stage `firebase.json` or keep it local, and **never** sweep it in with `git add -A`.
- **No upload code exists** (`uploadBytes`/`getDownloadURL`/`firebase/storage` → zero hits). ImportTab parses xlsx locally; it does not touch Storage. P3 writes the first `src/firebase/storage.ts`.

## Scope (once design is locked)

1. **Firebase Storage wiring** — `getStorage` in a new `src/firebase/storage.ts`; connect to the Storage emulator in DEV (mirror the Firestore/auth emulator-connect pattern in `src/firebase/db.ts`/`app.ts`); add the Storage emulator block to `firebase.json`; create `storage.rules` (admin-claim write to the sprite path, read per design); ensure `npm run dev:admin` / the emulator bootstrap starts Storage.
2. **`PetDef` sprite field** — add the chosen optional field to `src/data/types.ts`; extend `validatePetDefs` if it needs rules; extend `backfillPetDefs` only if defaults are required; update `BUILTIN_PET_DEFS` only if the field is non-optional (prefer optional → builtins keep using element art).
3. **Upload UI in `PetForm`** — a Sprites `<fieldset>`: file input(s) per the chosen granularity, upload to Storage on select, write the returned download URL into the draft via `onPatch`, show a thumbnail + a clear/remove control, loading + error states. Save persists the URL like any other field (it's already in the draft → `savePetDefs`).
4. **Resolver override** — `spriteSrc` (and `PetSprite`) consult the `PetDef` sprite field, falling back to element art per the locked fallback granularity. **Never-blank**: a missing/failed/404 sprite must fall back to element art, never render broken.
5. **Tests** — Storage upload mocked (like `savePetDefs`/`useAuth` are mocked in `PetsTab.test.tsx`); upload writes the URL into the draft; resolver returns the override when present and the element art when absent/failed; validate rules if any. Mirror `PetsTab.test.tsx` conventions.

## Landmines / heads-ups

- **No `PERSIST_VERSION` bump expected.** The sprite field lives on `PetDef` (Firestore **content** `content/petDefs`), which has its own hydrate/backfill path — it is NOT part of the persisted game store (`PersistedState`/`selectPersisted`, `PERSIST_VERSION = 16` at `src/state/gameStore.ts:109`). `PetInstance` already has `defId`; P3 adds no `PetInstance` field. Two sentinel tests guard the store if you ever touch it: `gameStore.test.ts` + `gameStore.persisted.test.ts`. **Flag at plan time if any task thinks it needs a bump.**
- **Sprite-variant coverage / never-blank.** Current art is 6 variants/creature (stage×mood). Whatever override granularity is chosen, EVERY (stage, mood) the game can render must resolve to *something* — per-variant fallback to element art is the safe default.
- **Storage emulator CORS.** The Storage emulator commonly trips browser CORS when fetching `getDownloadURL` results from app code. Budget time for emulator CORS config / a dev proxy.
- **Runtime image loading.** Static imports never fail; Storage URLs can 404 / be slow. Handle loading placeholder, error fallback to element art, and avoid refetch-per-render (cache/memoize).
- **`PetSprite` is widely consumed.** Prefer resolving the def inside `PetSprite` from `defId` (via `resolvePetDef`) over threading a `def` prop through every call site.
- **`firebase.json` is dirty-by-design.** It's intentionally modified-but-unstaged. Adding Storage config edits an already-dirty file — handle staging deliberately; **stage explicit files only, never `git add -A`** (concurrent sessions).
- **`src/content/seed.ts` is generated** (`npm run seed:export`) — builtins-only here; don't hand-edit it.
- **Admin claim for upload writes.** `storage.rules` must gate writes on the `admin == true` custom claim (same model as `firestore.rules` for `/content/*`).

## Out of scope (P4 and beyond)
- Gacha pool over the dex; dex tracking (seen/caught); obtainability; course/boss `rewardPetDefId`; **evolution execution** (battle/leveling firing a chain). Structure exists from P2; nothing triggers it yet.
- Sourcing the Bosses tab species/stage dropdowns from the catalog (follow-on; note, don't do).

## Dev / test harness (reuse)
- Emulators (auth :9099, firestore :8080; **add storage** in P3); `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; one-click 🔑 Dev admin sign-in on `/#admin` (DEV-only).
- Verify: `npm test`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`), `npm run build`. Manual smoke against the emulator: `/#admin` → dev sign-in → Pets tab → open a def → upload a sprite → save → reload persists → the game renders the uploaded art (and falls back to element art when cleared).

## Suggested skills for the next session
- `superpowers:brainstorming` — **required first**: lock sprite granularity, fallback rule, data shape, and Storage-vs-URL scope (see "Brainstorm first").
- `superpowers:writing-plans` → `superpowers:subagent-driven-development` — per-task, two-stage review (spec then quality) + final whole-feature review, the cadence P2a/P2b ran.
- `accessibility` — the file-upload control (accessible name, error/loading announced via `aria-live`, keyboard-operable, thumbnail alt text).
