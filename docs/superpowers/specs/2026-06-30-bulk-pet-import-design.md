# Bulk pet import pipeline — design

**Date:** 2026-06-30
**Branch:** `pet-import-proof` (cut from `main` @ d1c5fcd)
**Status:** approved, pre-implementation

## Goal

Import a friend's creature character sheets into sentence-pet as game pets. The
single-pet proof (Tempest Falcon) is verified end-to-end. This scales it to the
full set: **126 importable sheets** → segmented sprites → Firebase Storage →
~126 chained PetDefs in Firestore.

## Source art

`H:\My Drive\01 Current Projects\AI\AI_design_thinking\Pictures\Animal`

Each PNG = one creature sheet: 3 ages side-by-side **adult (left, big) → young
(mid) → baby (right, small)** + a name banner + rarity label, on white/cream bg.

Importable folders (126 total): Air 19, Earth 25, Fire 21, Water 24, Carnivorous
plants 5, Insect Kingdom 6, Season 6, Tiny friend 6, Newly Discovered 6, root 8.
Excluded: `baby/`, `young/`, `mood/` (sample leaf-bunny), `pets_egg.png`.
Filenames are GUIDs — no name info, so OCR is mandatory. The "~95" estimate in
the original handoff was low; extras are likely non-sheet/variant images that the
contact-sheet review will cull. Rarities on banners: Rare / Epic / **Mythical**.

## Locked decisions

1. **Model B** — every creature = 3 chained PetDefs (baby→young→adult) via
   `evolvesFromId`/`evolvesToId`, `evolutionStage` 1/2/3.
2. **Element mapping** — Air/Fire/Water folders map direct; **Earth + all
   collection folders → `leaf`**. (Element only affects art-family fallback +
   sprite-override guard; low stakes.)
3. **Names + rarity from OCR**, dumped to an editable TSV the user corrects.
   Mythical → `legendary`. Rarity set on chain ROOT only.
4. **Contact-sheet review gate** before any mass write.
5. **Programmatic upload + write** — a script uploads sprites to Firebase Storage
   and writes all defs to `content/petDefs`. Admin PetsTab is for editing
   afterward, not bulk authoring.
6. **Emulator first, then promote** — build/validate/screenshot-verify in the
   emulator (Storage :9199, Firestore :8080); promote to the live Firebase
   project only after user approval.
7. **Stats** — keep the existing fixed per-rarity `STAT_BANDS` (same bands for all
   pets, rarity drives stats). No per-pet stat data exists on the sheets.
8. **Dex numbering** — built-ins keep chain-root dexNos 1-4 (Leaflet, Embers,
   Zephyr, Dewdrop); imported pets continue 5,6,7… Non-root stage defs get
   offset never-displayed dexNos (`100 + lineNo*3 + {1,2}`), per the existing
   `chain()` helper.

## Pipeline

All scripts live under `scripts/import/`. Each stage produces an artifact so the
pipeline is resumable and reviewable.

### 1. Segment — `segment.mjs` (python core)

Generalize the proven Falcon recipe over every importable folder:
rembg whole sheet → cv2 connected-components → keep blobs sharing the **ground
baseline** (`botY ≥ maxbot − 0.12·H`, which drops the floating banner) → take 3
largest → sort left→right = adult/young/baby → per-component alpha mask → tight
crop → downscale ≤512 (`MAX` in `src/firebase/imageTranscode.ts`) → save `.webp`.

- Output: `src/assets/sprites/<slug>/{baby,young,adult}.webp`.
- Slug: `<element>-<NNN>` (zero-padded sequence per element; GUIDs are useless as
  names). Slug is stable and is the join key across all later stages.
- **Self-reports blob count per sheet.** Any sheet that does not yield exactly 3
  ground blobs is flagged in the manifest, never silently mangled.
- Manifest: `scripts/import/manifest.json` — `{slug, srcFile, element, blobCount,
  bannerBox}` per sheet.

### 2. OCR — `ocr.mjs`

OCR the banner region (the blob rejected by the baseline filter, bbox recorded in
the manifest) per sheet → name + rarity. Map rarity text → `common|rare|epic|
legendary` (Mythical→legendary). Write **`scripts/import/import.tsv`** with
columns: `slug · srcFile · name · rarity · element · blobCount · flag`.

### 3. Review gate #1 — `contact-sheet.mjs`

Render one grid PNG: each row = a creature with its baby/young/adult crops + the
OCR'd name/rarity label. Rows with `blobCount ≠ 3` highlighted. User eyeballs bad
splits and wrong OCR, then hand-edits `import.tsv` (fix names/rarity/element,
mark excludes). Bad-crop sheets are excluded or re-segmented.

**Review gate #2:** user explicitly approves `import.tsv` before any write.

### 4. Generate + validate — `gen-defs.mjs`

Read approved TSV → emit 3-def chains via the existing `chain(base, element,
lineNo, opts)` helper (continue dexNo from 5; built-ins keep 1-4). Element per
the mapping. Rarity on root only. Run `backfillPetDefs` → `validatePetDefs` on
the full merged set (built-ins + imports). Any validation failure stops the
pipeline with the offending def reported. Output: `scripts/import/defs.json`.

`validatePetDefs` invariants to satisfy: unique `id`; unique `(gen,dexNo)`;
`element ∈ {leaf,fire,air,water}`; `types[] ≥ 1`; full `statBands` for all 4
rarities; evolution refs resolve; stages strictly increase along a chain; no
cycles; sprite URLs must be `http(s)` (`isHttpUrl`).

### 5. Upload + seed (emulator) — `upload-and-seed.mjs`

Upload each sprite to **emulator Storage** (:9199) → collect public URLs → bake
into defs → write `content/petDefs`. Then screenshot-verify the Dex grid (~126
cards, all baby silhouettes) + a few detail chains via Playwright guest-play.

### 6. Promote to live (after user OK)

Run the same upload+write against the **real Firebase project**. CORS/auth
landmines are handled here, isolated from dev iteration. Admin PetsTab edits
anything afterward.

## How the catalog reaches the app (mental model)

`main.tsx` boot: `setActivePetDefs(cachedPetDefs() ?? BUILTIN_PET_DEFS)` →
`hydratePetDefs()` fetches Firestore `content/petDefs`, runs `backfillPetDefs` →
`validatePetDefs`; swaps only if valid. Editing `BUILTIN_PET_DEFS` in code does
NOT render — the seed (Firestore) is what shows. App caches catalog in
localStorage `sentence-pet-petdefs`; after a re-seed that changes the count,
clear it (or bump a cache version) or stale data renders.

## Gotchas (carried from proof)

- **Sprite-URL ↔ port coupling** (dev seed only): bakes `http://localhost:5173`;
  if vite picks another port, re-seed with `DEV_ORIGIN`. (Storage URLs in the
  real pipeline avoid this.)
- **Windows firebase export bug**: `emulators:export` fails `EPERM rename`. Use
  auto-seed for persistence, not export.
- **PowerShell-tool cwd resolves wrong** — use Bash with explicit
  `cd /d/ai_projects/AI_design_thinking/sentence-pet`.
- rembg prints a harmless CUDA-dll warning (CPU fallback).
- **`active` default dev hack** in `src/domain/petDef.ts` — verify it's
  `BUILTIN_PET_DEFS` (comment marks "revert before commit") before committing.

## Out of scope

- Per-pet hand-tuned stats (fixed rarity bands instead).
- Admin-UI bulk authoring (programmatic write instead).
- Auto cache-busting of the localStorage catalog (manual clear / version bump).
