# Filling `import.tsv` (Task 5 — the cheap, human-OCR path)

The bulk-import pipeline needs each creature's **name** + **rarity**. Reading those
off the art with a vision agent proved expensive (a runaway OCR run burned ~460
tool calls). So names/rarity are filled **by hand** from pre-built review images —
zero model cost.

## Where things are

All artifacts live in `scripts/import/out/` (gitignored). Regenerate any of them
with the committed scripts if missing:

| File(s) | Built by | Purpose |
|---|---|---|
| `manifest.json` | `node scripts/import/segment.mjs` | per-slug segmentation record |
| `import.tsv` | skeleton: see below | the file you edit |
| `banners-1..5.png` | `node scripts/import/banner-montage.mjs` | 82 sheets: banner crops labeled by slug (read name+rarity here) |
| `bannerless-1..4.png` | `node scripts/import/contact-sheet.mjs` | the other 36: full source sheets, slug-labeled |
| `contact-1..10.png` | `node scripts/import/contact-sheet.mjs` | every slug's adult\|young\|baby crops, labeled `slug [blobCount FLAG]` — verify the split |

Regenerate the skeleton `import.tsv` (all columns from manifest, name/rarity blank):

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet-import-wt
node -e 'const fs=require("fs");const m=require("./scripts/import/out/manifest.json");
const head="slug\tsrcFile\tname\trarity\telement\tblobCount\tflag";
const rows=m.map(x=>[x.slug,x.srcFile,"","",x.element,x.blobCount,x.flag?1:0].join("\t"));
fs.writeFileSync("scripts/import/out/import.tsv",[head,...rows].join("\n")+"\n");'
```

## How to fill

Edit `scripts/import/out/import.tsv`. Columns (TAB-separated):
`slug  srcFile  name  rarity  element  blobCount  flag`

Only `name` and `rarity` are blank. For each row:

1. Find the slug in `banners-*.png` (82) or `bannerless-*.png` (36).
2. Type the creature **name** (title case, as shown on the banner).
3. Type **rarity**, mapped: Rare→`rare`, Epic→`epic`, **Mythical→`legendary`**, Common→`common`.
4. Check the same slug in `contact-*.png`: if the adult|young|baby split is wrong
   (pink placeholder = missing crop, or wrong creature), either **blank the name**
   or set **`flag` = 1** to exclude that sheet from import.

Leave name blank on any row you want skipped — Task 7 drops blank-name / flag=1 rows.

## After filling

Hand the file back. Downstream is pure code/compute (no model vision cost):
`gen-defs.ts` (Task 7, validate) → `upload-and-seed.mjs` (Task 8, emulator) →
`verify.spec.ts` (Task 9, Playwright). See
`docs/superpowers/plans/2026-06-30-bulk-pet-import.md`.

## Running the Dex verification (Task 9)

With emulators running + seeded (`npm run dev:emulators` then
`node scripts/import/upload-and-seed.mjs`):

```bash
npx playwright test --config scripts/import/playwright.verify.config.ts
```

The config auto-starts vite (webServer, `reuseExistingServer`). The spec fetches
the seeded `content/petDefs` from the emulator REST API on the Node side and
injects it via `window.petDefs.set()` — the Firestore JS SDK's WebChannel does
not reliably connect from Playwright's Chromium to the emulator, so this verifies
that the **seeded catalog renders** (115 lines) rather than the SDK hydration
transport (covered by unit tests + the manual proof).
