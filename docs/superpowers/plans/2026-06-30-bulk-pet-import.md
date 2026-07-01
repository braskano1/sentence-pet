# Bulk Pet Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 126 creature character-sheet PNGs into ~126 chained PetDefs (baby→young→adult) with Storage-hosted sprites, written to Firestore — emulator first, promote to live after approval.

**Architecture:** A staged pipeline under `scripts/import/`, each stage emitting a file artifact so it is resumable and reviewable. Segment (python/rembg/cv2) → OCR (agent-vision over banner montages) → contact-sheet review → generate+validate defs (vite-node, reusing `chain()`/`backfillPetDefs`/`validatePetDefs`) → upload+seed to emulator Storage/Firestore → Playwright screenshot verify → promote to live.

**Tech Stack:** Node ESM (`firebase-admin`), `vite-node` (run TS domain code), python (PIL, rembg, numpy, cv2), Playwright. Emulators: Firestore 8080, Auth 9099, Storage 9199. Project id `demo-sentence-pet`, bucket `demo-sentence-pet.appspot.com`.

**Run context:** All commands from Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell-tool cwd resolves wrong). Branch `pet-import-proof`.

---

## File structure

- `scripts/import/lib.mjs` — shared constants + helpers (folder→element map, slug, paths, manifest IO).
- `scripts/import/segment.py` — sheet → 3 alpha-cropped ≤512 `.webp` + banner crop; reports blob count.
- `scripts/import/segment.mjs` — driver: walk folders, call segment.py per sheet, write `manifest.json`.
- `scripts/import/banner-montage.mjs` — tile banner crops into legible montages for agent OCR.
- `scripts/import/contact-sheet.mjs` — tile baby/young/adult crops + labels into review grid(s).
- `scripts/import/gen-defs.ts` — `import.tsv` → chains → `backfillPetDefs` → `validatePetDefs` → `defs.json`.
- `scripts/import/upload-and-seed.mjs` — upload sprites to Storage, bake URLs, write `content/petDefs`.
- `scripts/import/verify.spec.ts` — Playwright Dex screenshot verification.
- `scripts/import/promote.mjs` — same as upload-and-seed against the live project (gated).

Artifacts (gitignored, under `scripts/import/out/`): per-sheet sprite dirs are written to `src/assets/sprites/<slug>/`; `manifest.json`, `import.tsv`, `defs.json`, montages, contact sheets live in `scripts/import/out/`.

---

## Task 1: Scaffold + shared lib

**Files:**
- Create: `scripts/import/lib.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Create the shared lib**

```js
// scripts/import/lib.mjs — shared constants + helpers for the import pipeline.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const REPO = resolve(process.cwd());
export const SRC_ROOT = 'H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures/Animal';
export const OUT_DIR = join(REPO, 'scripts/import/out');
export const SPRITES_DIR = join(REPO, 'src/assets/sprites');
export const MANIFEST = join(OUT_DIR, 'manifest.json');
export const TSV = join(OUT_DIR, 'import.tsv');
export const DEFS = join(OUT_DIR, 'defs.json');

// Folder → element. Air/Fire/Water direct; Earth + every collection → leaf.
export const FOLDER_ELEMENT = {
  Air: 'air', Fire: 'fire', Water: 'water', Earth: 'leaf',
  'Carnivorous plants': 'leaf', 'Insect Kingdom collection': 'leaf',
  'Season collection': 'leaf', 'Tiny friend collection': 'leaf',
  '🧬 8. Newly Discovered Creatures': 'leaf', '.': 'leaf', // loose root sheets
};
export const IMPORT_FOLDERS = Object.keys(FOLDER_ELEMENT);
export const SKIP_FOLDERS = ['baby', 'young', 'mood'];
export const RARITY_MAP = { rare: 'rare', epic: 'epic', mythical: 'legendary', common: 'common' };

export const pad3 = (n) => String(n).padStart(3, '0');
export const slugFor = (element, seq) => `${element}-${pad3(seq)}`;

export function ensureDirs() {
  for (const d of [OUT_DIR, SPRITES_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const writeJson = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2));
```

- [ ] **Step 2: Gitignore the import artifacts**

Add to `.gitignore`:

```
scripts/import/out/
```

- [ ] **Step 3: Verify lib loads**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && node -e "import('./scripts/import/lib.mjs').then(m=>console.log(m.IMPORT_FOLDERS.length,'folders',m.slugFor('air',5)))"`
Expected: `10 folders air-005`

- [ ] **Step 4: Commit**

```bash
git add scripts/import/lib.mjs .gitignore
git commit -m "feat(import): scaffold bulk-import shared lib"
```

---

## Task 2: Segmentation core (python)

Generalize the proven Falcon recipe: rembg → connected-components → keep ground-baseline blobs (drops banner) → 3 largest → sort L→R = adult/young/baby → alpha crop → ≤512 → webp. Also emit the rejected top blob as the banner crop.

**Files:**
- Create: `scripts/import/segment.py`

- [ ] **Step 1: Write segment.py**

```python
# scripts/import/segment.py — one sheet -> {adult,young,baby}.webp + banner.png
# Usage: python segment.py <src.png> <out_sprite_dir> <out_banner.png>
# Prints JSON: {"blobCount": N, "bannerBox": [x,y,w,h] | null}
import sys, json
import numpy as np
from PIL import Image
from rembg import remove
import cv2

MAX = 512  # mirrors MAX_SPRITE_DIM in src/firebase/imageTranscode.ts

def main(src, out_dir, banner_path):
    img = Image.open(src).convert("RGBA")
    cut = remove(img)                      # rembg -> transparent bg (harmless CUDA warn on CPU)
    arr = np.array(cut)
    alpha = arr[:, :, 3]
    H = alpha.shape[0]
    mask = (alpha > 16).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    # component 0 = background; gather the rest with geometry
    comps = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 500:                     # drop specks
            continue
        comps.append({"i": i, "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                      "bot": int(y + h), "area": int(area)})
    if not comps:
        print(json.dumps({"blobCount": 0, "bannerBox": None})); return
    maxbot = max(c["bot"] for c in comps)
    ground = [c for c in comps if c["bot"] >= maxbot - 0.12 * H]   # share the baseline
    banner = [c for c in comps if c not in ground]
    ground.sort(key=lambda c: c["area"], reverse=True)
    three = ground[:3]
    three.sort(key=lambda c: c["x"])       # left->right = adult, young, baby
    names = ["adult", "young", "baby"]
    import os; os.makedirs(out_dir, exist_ok=True)
    for name, c in zip(names, three):
        comp_mask = (labels == c["i"]).astype(np.uint8)
        ys, xs = np.where(comp_mask)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = arr[y0:y1, x0:x1].copy()
        cm = comp_mask[y0:y1, x0:x1]
        crop[:, :, 3] = crop[:, :, 3] * cm  # isolate this component's alpha
        im = Image.fromarray(crop, "RGBA")
        w, h = im.size
        if max(w, h) > MAX:
            s = MAX / max(w, h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        im.save(os.path.join(out_dir, f"{name}.webp"), "WEBP", lossless=True)
    box = None
    if banner:
        b = max(banner, key=lambda c: c["area"])
        bx0, by0, bx1, by1 = b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]
        Image.fromarray(arr[by0:by1, bx0:bx1], "RGBA").save(banner_path)
        box = [b["x"], b["y"], b["w"], b["h"]]
    print(json.dumps({"blobCount": len(ground), "bannerBox": box}))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
```

- [ ] **Step 2: Test on the Falcon source sheet (known-good)**

Find the falcon source (an Air sheet). Pick any Air PNG and run:

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && python scripts/import/segment.py "H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures/Animal/Air/02827460-54B2-4C94-9F84-2953D02FC997.png" scripts/import/out/_probe scripts/import/out/_probe/banner.png`
Expected: JSON line `{"blobCount": 3, "bannerBox": [...]}` and 3 `.webp` files in `scripts/import/out/_probe/`. If blobCount ≠ 3, inspect the crop visually before proceeding — the baseline threshold (0.12) may need a per-sheet tweak (recorded as a flag, not a hard failure).

- [ ] **Step 3: Eyeball the probe crops**

Read the 3 generated webps with the Read tool. Confirm tight, transparent, correct age order (adult biggest). If wrong, adjust threshold/area constants and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/import/segment.py
git commit -m "feat(import): generalize sheet segmentation (python/rembg/cv2)"
```

---

## Task 3: Segmentation driver + manifest

**Files:**
- Create: `scripts/import/segment.mjs`

- [ ] **Step 1: Write the driver**

```js
// scripts/import/segment.mjs — walk import folders, segment each sheet, write manifest.json
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT, SPRITES_DIR, OUT_DIR, MANIFEST, IMPORT_FOLDERS, FOLDER_ELEMENT,
         slugFor, ensureDirs, writeJson } from './lib.mjs';

ensureDirs();
const manifest = [];
const seqByElement = {};

for (const folder of IMPORT_FOLDERS) {
  const dir = folder === '.' ? SRC_ROOT : join(SRC_ROOT, folder);
  if (!existsSync(dir)) continue;
  const element = FOLDER_ELEMENT[folder];
  const pngs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png') && !f.startsWith('pets_egg'));
  for (const png of pngs) {
    const seq = (seqByElement[element] = (seqByElement[element] ?? 0) + 1);
    const slug = slugFor(element, seq);
    const spriteDir = join(SPRITES_DIR, slug);
    const bannerPath = join(OUT_DIR, `banner-${slug}.png`);
    const src = join(dir, png);
    let res;
    try {
      const out = execFileSync('python', ['scripts/import/segment.py', src, spriteDir, bannerPath], { encoding: 'utf8' });
      res = JSON.parse(out.trim().split('\n').pop());
    } catch (e) {
      res = { blobCount: -1, bannerBox: null, error: String(e.message ?? e) };
    }
    manifest.push({ slug, folder, element, srcFile: png, blobCount: res.blobCount,
                    bannerBox: res.bannerBox, flag: res.blobCount !== 3 });
    console.log(`${slug}  blobs=${res.blobCount}  ${png}`);
  }
}
writeJson(MANIFEST, manifest);
const bad = manifest.filter((m) => m.flag);
console.log(`\n${manifest.length} sheets, ${bad.length} flagged (blobCount != 3):`);
for (const b of bad) console.log(`  FLAG ${b.slug} (${b.blobCount}) ${b.folder}/${b.srcFile}`);
```

- [ ] **Step 2: Run the full segmentation**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && node scripts/import/segment.mjs`
Expected: ~126 lines, a manifest written, a flagged list at the end. Note the flagged count — those need manual attention in Task 6. (This is slow: rembg per sheet. Run in background if needed.)

- [ ] **Step 3: Sanity-check the manifest**

Run: `node -e "const m=require('./scripts/import/out/manifest.json'); console.log('total',m.length,'ok',m.filter(x=>x.blobCount===3).length,'flagged',m.filter(x=>x.flag).length)"`
Expected: total ≈ 126, most blobCount===3.

- [ ] **Step 4: Commit (sprites are app assets, manifest is gitignored)**

```bash
git add src/assets/sprites/
git commit -m "feat(import): segment all sheets into stage sprites"
```

---

## Task 4: Banner montage for OCR

**Files:**
- Create: `scripts/import/banner-montage.mjs`

- [ ] **Step 1: Write the montage builder (uses ImageMagick `magick`)**

```js
// scripts/import/banner-montage.mjs — tile banner crops into legible montages (20 per sheet) for agent OCR.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, MANIFEST, readJson } from './lib.mjs';

const manifest = readJson(MANIFEST);
const withBanner = manifest.filter((m) => existsSync(join(OUT_DIR, `banner-${m.slug}.png`)));
const PER = 20;
for (let p = 0; p * PER < withBanner.length; p++) {
  const group = withBanner.slice(p * PER, p * PER + PER);
  // label each banner with its slug so the agent can map name->slug
  const args = [];
  for (const m of group) {
    args.push('-label', m.slug, join(OUT_DIR, `banner-${m.slug}.png`));
  }
  const out = join(OUT_DIR, `banners-${p + 1}.png`);
  execFileSync('magick', ['montage', ...args, '-tile', '2x', '-geometry', '+8+8',
    '-background', 'white', '-pointsize', '18', out]);
  console.log('wrote', out, `(${group.length} banners)`);
}
```

- [ ] **Step 2: Build the montages**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && node scripts/import/banner-montage.mjs`
Expected: `banners-1.png` … `banners-N.png` (≈7 sheets for 126 banners) in `scripts/import/out/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/import/banner-montage.mjs
git commit -m "feat(import): banner montage builder for OCR"
```

---

## Task 5: OCR banners → import.tsv (agent-vision)

No python OCR engine is installed and banners use stylized game fonts. Read the montages directly with the Read tool and transcribe — more reliable than tesseract, zero new deps.

**Files:**
- Create: `scripts/import/out/import.tsv` (the agent writes this)

- [ ] **Step 1: Read every banner montage**

Read each `scripts/import/out/banners-*.png` with the Read tool. For each labeled banner, record the slug (printed as the label), the creature name, and the rarity word (Rare/Epic/Mythical).

- [ ] **Step 2: Write import.tsv**

Header + one row per manifest entry. Columns: `slug<TAB>srcFile<TAB>name<TAB>rarity<TAB>element<TAB>blobCount<TAB>flag`. Map rarity Mythical→legendary, else lowercase. For flagged (blobCount≠3) or unreadable banners, leave name blank and set flag=1 so the review gate catches them. Pull slug/srcFile/element/blobCount from `manifest.json`.

- [ ] **Step 3: Verify row count matches manifest**

Run: `node -e "const fs=require('fs');const m=require('./scripts/import/out/manifest.json');const rows=fs.readFileSync('./scripts/import/out/import.tsv','utf8').trim().split('\n').length-1;console.log('manifest',m.length,'tsv rows',rows, m.length===rows?'OK':'MISMATCH')"`
Expected: `... OK`

- [ ] **Step 4: Commit (out/ is gitignored; commit nothing — note progress only)**

No commit (artifact is gitignored). Proceed to review gate.

---

## Task 6: Review gate — contact sheet (USER CHECKPOINT)

**Files:**
- Create: `scripts/import/contact-sheet.mjs`

- [ ] **Step 1: Write the contact-sheet builder**

```js
// scripts/import/contact-sheet.mjs — review grid: row per creature, baby|young|adult + name/rarity label.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, SPRITES_DIR, TSV } from './lib.mjs';

const rows = readFileSync(TSV, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const PER = 12;
for (let p = 0; p * PER < rows.length; p++) {
  const group = rows.slice(p * PER, p * PER + PER);
  const args = [];
  for (const [slug, , name, rarity, , blobCount, flag] of group) {
    const d = join(SPRITES_DIR, slug);
    for (const stage of ['baby', 'young', 'adult']) {
      const f = join(d, `${stage}.webp`);
      args.push('-label', `${slug} ${name ?? '?'} ${rarity ?? '?'}${flag === '1' ? ' ⚠' : ''}`,
        existsSync(f) ? f : 'xc:pink');
    }
  }
  const out = join(OUT_DIR, `contact-${p + 1}.png`);
  execFileSync('magick', ['montage', ...args, '-tile', '3x', '-geometry', '180x180+6+6',
    '-background', 'white', '-pointsize', '14', out]);
  console.log('wrote', out);
}
```

- [ ] **Step 2: Build contact sheets**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && node scripts/import/contact-sheet.mjs`
Expected: `contact-1.png` … in `scripts/import/out/`.

- [ ] **Step 3: STOP — present to user**

Show the contact-sheet paths and the flagged list. Ask the user to eyeball bad splits + wrong names/rarity and to hand-edit `import.tsv` (fix name/rarity/element, set flag=1 / blank name to exclude a bad sheet). **Do not proceed past this step without explicit user approval of `import.tsv`.**

- [ ] **Step 4: Commit the tooling**

```bash
git add scripts/import/contact-sheet.mjs
git commit -m "feat(import): contact-sheet review builder"
```

---

## Task 7: Generate + validate defs

Reuse the proven `chain()` shape (root keeps line dexNo, non-root offset dexNos, `sprite.default`) and the real `backfillPetDefs`/`validatePetDefs`. Sprite URLs are placeholders here (validated for http shape in Task 8 after upload); for validation-only we inject a dummy http URL so the http-shape check passes, then Task 8 replaces them with real Storage URLs.

**Files:**
- Create: `scripts/import/gen-defs.ts`

- [ ] **Step 1: Write gen-defs.ts**

```ts
// scripts/import/gen-defs.ts — import.tsv -> chains -> backfill -> validate -> defs.json
// Run: npx vite-node scripts/import/gen-defs.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { backfillPetDefs } from '../../src/content/petDefMigrate';
import { validatePetDefs } from '../../src/content/validate';
import { BUILTIN_PET_DEFS } from '../../src/domain/petDef';

const OUT = join(process.cwd(), 'scripts/import/out');
const PLACEHOLDER = 'http://localhost:5173/__pending__';

const stats = (min: number, max: number) => ({ hp: [min, max], atk: [min, max], def: [min, max], spd: [min, max], luk: [min, max] });
const STAT_BANDS = { common: stats(40, 60), rare: stats(55, 75), epic: stats(72, 88), legendary: stats(85, 90) };

type Row = { slug: string; name: string; rarity: string; element: string };
const rows: Row[] = readFileSync(join(OUT, 'import.tsv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => l.split('\t'))
  .map(([slug, , name, rarity, element, , flag]) => ({ slug, name, rarity, element, flag }))
  .filter((r: any) => r.flag !== '1' && r.name && r.name.trim() !== '')
  .map(({ slug, name, rarity, element }: any) => ({ slug, name, rarity, element }));

// Continue the dex line numbering after the 4 built-in chain roots (lines 1-4) -> imports start at 5.
let line = 4;
const raw: any[] = [];
for (const r of rows) {
  line += 1;
  const base = `def-${r.slug}`;
  const ids = [`${base}-1`, `${base}-2`, `${base}-3`];
  const dexNos = [line, 100 + line * 3 + 1, 100 + line * 3 + 2];
  const sprites = ['baby', 'young', 'adult'].map((s) => `${PLACEHOLDER}/${r.slug}/${s}.webp`);
  ids.forEach((id, i) => {
    raw.push({
      id, name: r.name, gen: 1, dexNo: dexNos[i], types: [r.element], element: r.element,
      statBands: STAT_BANDS, enabled: true, evolutionStage: i + 1,
      ...(i > 0 ? { evolvesFromId: ids[i - 1] } : {}),
      ...(i < 2 ? { evolvesToId: ids[i + 1] } : {}),
      ...(i === 0 && r.rarity ? { rarity: r.rarity } : {}),
      sprite: { default: sprites[i] },
    });
  });
}

const importedDefs = backfillPetDefs(raw);
// Validate the MERGED catalog (built-ins keep dex lines 1-4; imports 5+).
const merged = [...BUILTIN_PET_DEFS, ...importedDefs];
const { ok, errors } = validatePetDefs(merged as any);
if (!ok) { console.error('VALIDATION FAILED:\n' + errors.join('\n')); process.exit(1); }
writeFileSync(join(OUT, 'defs.json'), JSON.stringify({ importedDefs }, null, 2));
console.log(`generated ${importedDefs.length} defs (${rows.length} chains), validation OK`);
```

- [ ] **Step 2: Run generation + validation**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vite-node scripts/import/gen-defs.ts`
Expected: `generated N defs (N/3 chains), validation OK`. If it prints `VALIDATION FAILED`, read the errors, fix the offending TSV rows or the generator, and re-run. Do not proceed until OK.

- [ ] **Step 3: Confirm dex-line continuity vs built-ins**

Run: `node -e "const {importedDefs}=require('./scripts/import/out/defs.json'); const roots=importedDefs.filter(d=>!d.evolvesFromId).map(d=>d.dexNo).sort((a,b)=>a-b); console.log('import root dexNos start', roots[0], 'end', roots[roots.length-1])"`
Expected: starts at 5, contiguous.

- [ ] **Step 4: Commit**

```bash
git add scripts/import/gen-defs.ts
git commit -m "feat(import): generate+validate pet-def chains from tsv"
```

---

## Task 8: Upload sprites + seed (emulator)

**Files:**
- Create: `scripts/import/upload-and-seed.mjs`

- [ ] **Step 1: Write the upload+seed script**

```js
// scripts/import/upload-and-seed.mjs — upload stage sprites to emulator Storage, bake URLs, write content/petDefs.
// Emulators must be running (npm run dev:emulators).
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SPRITES_DIR, DEFS, readJson } from './lib.mjs';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.STORAGE_EMULATOR_HOST ??= 'http://127.0.0.1:9199';
const PROJECT = 'demo-sentence-pet';
const BUCKET = `${PROJECT}.appspot.com`;
const HOST = '127.0.0.1:9199';

initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
const bucket = getStorage().bucket();

const publicUrl = (objPath) =>
  `http://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(objPath)}?alt=media`;

const { importedDefs } = readJson(DEFS);

// Each def's sprite.default points at <PLACEHOLDER>/<slug>/<stage>.webp — derive slug+stage, upload, rewrite.
for (const def of importedDefs) {
  const m = /\/([^/]+)\/(baby|young|adult)\.webp$/.exec(def.sprite.default);
  if (!m) throw new Error(`bad placeholder url on ${def.id}: ${def.sprite.default}`);
  const [, slug, stage] = m;
  const local = join(SPRITES_DIR, slug, `${stage}.webp`);
  if (!existsSync(local)) throw new Error(`missing sprite ${local}`);
  const objPath = `petdef-sprites/${slug}/${stage}.webp`;
  await bucket.upload(local, { destination: objPath, metadata: { contentType: 'image/webp' } });
  def.sprite.default = publicUrl(objPath);
}

await getFirestore().doc('content/petDefs').set({ defs: importedDefs });
console.log(`uploaded ${importedDefs.length} sprites, wrote content/petDefs (${importedDefs.length} defs)`);
process.exit(0);
```

- [ ] **Step 2: Ensure emulators are running**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && curl -s http://127.0.0.1:8080 >/dev/null && echo UP || echo DOWN`
If DOWN: start `npm run dev:emulators` in a background terminal and wait for ready.

⚠️ **Note:** `dev:emulators` auto-seeds the 5 baseline chains on every start (idempotent). This script overwrites `content/petDefs` with ONLY the imported defs. Decide with the merge: this script should write `[...baselineFromSeed, ...importedDefs]` OR the seed should be extended. **Simplest correct path:** have this script read the current doc, keep the 4 built-in chains, append imports. Add before the final `set`:

```js
const cur = (await getFirestore().doc('content/petDefs').get()).data();
const baseline = (cur?.defs ?? []).filter((d) => /^def-(leaf|fire|air|water)-/.test(d.id));
await getFirestore().doc('content/petDefs').set({ defs: [...baseline, ...importedDefs] });
```

- [ ] **Step 3: Run upload+seed**

Run: `node scripts/import/upload-and-seed.mjs`
Expected: `uploaded N sprites, wrote content/petDefs (...)`.

- [ ] **Step 4: Confirm Storage objects + doc**

Run: `node -e "const u='http://127.0.0.1:9199/v0/b/demo-sentence-pet.appspot.com/o/petdef-sprites%2F'; require('http').get(u, r=>console.log('storage list status', r.statusCode))"`
Expected: 200.

- [ ] **Step 5: Commit**

```bash
git add scripts/import/upload-and-seed.mjs
git commit -m "feat(import): upload sprites to storage + seed content/petDefs"
```

---

## Task 9: Verify in-app (Playwright screenshots)

**Files:**
- Create: `scripts/import/verify.spec.ts`

- [ ] **Step 1: Reuse the hermetic-auth guest stub + open the Dex**

```ts
// scripts/import/verify.spec.ts — screenshot the Dex grid + a detail chain after a full import seed.
// Run: npx playwright test scripts/import/verify.spec.ts
import { test, expect } from '@playwright/test';
import { stubFirebaseAuth } from '../../e2e/support/hermetic-auth';

test('dex renders the imported catalog', async ({ page }) => {
  await stubFirebaseAuth(page);              // guest-play path used by the proof
  await page.goto('/#dex');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'scripts/import/out/verify-dex-grid.png', fullPage: true });
  const cards = page.getByTestId('dex-card');  // adjust to the real selector in DexGrid.tsx
  expect(await cards.count()).toBeGreaterThan(100);
});
```

- [ ] **Step 2: Confirm the real selectors before running**

Read `src/components/DexGrid.tsx` and `e2e/support/hermetic-auth.ts`; fix the import path, route hash, and card selector to match. (The proof already verified guest-play screenshots — mirror that spec's setup.)

- [ ] **Step 3: Clear the localStorage catalog cache, then run**

The app caches the catalog in localStorage `sentence-pet-petdefs`; a stale cache hides the new count. The hermetic stub starts a fresh context (no stale cache), so the spec is safe. Run:

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx playwright test scripts/import/verify.spec.ts`
Expected: PASS, card count > 100. Read `scripts/import/out/verify-dex-grid.png` to confirm ~126 cards, all baby silhouettes.

- [ ] **Step 4: Commit**

```bash
git add scripts/import/verify.spec.ts
git commit -m "test(import): playwright dex verification of imported catalog"
```

---

## Task 10: Promote to live (USER CHECKPOINT — gated)

**Files:**
- Create: `scripts/import/promote.mjs`

- [ ] **Step 1: STOP — confirm with user before touching live Firebase**

Promotion uploads to the real Storage bucket and overwrites the live `content/petDefs`. Do not run without explicit user go-ahead and confirmation of the target project + service-account credentials (`GOOGLE_APPLICATION_CREDENTIALS`).

- [ ] **Step 2: Write promote.mjs (mirror Task 8 against the live project)**

```js
// scripts/import/promote.mjs — upload sprites + write content/petDefs to the LIVE project.
// Requires GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT/BUCKET env. NO emulator env set.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SPRITES_DIR, DEFS, readJson } from './lib.mjs';

const PROJECT = process.env.FIREBASE_PROJECT;
const BUCKET = process.env.FIREBASE_BUCKET;        // e.g. <project>.appspot.com
if (!PROJECT || !BUCKET) throw new Error('set FIREBASE_PROJECT and FIREBASE_BUCKET');
initializeApp({ credential: applicationDefault(), projectId: PROJECT, storageBucket: BUCKET });
const bucket = getStorage().bucket();
const { importedDefs } = readJson(DEFS);

for (const def of importedDefs) {
  const [, slug, stage] = /\/([^/]+)\/(baby|young|adult)\.webp$/.exec(def.sprite.default);
  const local = join(SPRITES_DIR, slug, `${stage}.webp`);
  if (!existsSync(local)) throw new Error(`missing ${local}`);
  const objPath = `petdef-sprites/${slug}/${stage}.webp`;
  await bucket.upload(local, { destination: objPath, metadata: { contentType: 'image/webp' } });
  await bucket.file(objPath).makePublic();
  def.sprite.default = `https://storage.googleapis.com/${BUCKET}/${objPath}`;
}
const cur = (await getFirestore().doc('content/petDefs').get()).data();
const baseline = (cur?.defs ?? []).filter((d) => /^def-(leaf|fire|air|water)-/.test(d.id));
await getFirestore().doc('content/petDefs').set({ defs: [...baseline, ...importedDefs] });
console.log(`LIVE: uploaded ${importedDefs.length} sprites + wrote content/petDefs`);
process.exit(0);
```

- [ ] **Step 3: Run promotion (only after Step 1 approval)**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && FIREBASE_PROJECT=<id> FIREBASE_BUCKET=<bucket> GOOGLE_APPLICATION_CREDENTIALS=<path> node scripts/import/promote.mjs`
Expected: `LIVE: uploaded ...`. Then load the live app, clear localStorage `sentence-pet-petdefs`, confirm the Dex shows the full catalog.

- [ ] **Step 4: Revert the dev hack + commit**

Verify `src/domain/petDef.ts` `active` default is `BUILTIN_PET_DEFS` (not `ALL_PET_DEFS`) before any commit that touches it. Then:

```bash
git add scripts/import/promote.mjs
git commit -m "feat(import): live promotion script for sprites + catalog"
```

---

## Notes carried from the proof (do not rediscover)

- `validatePetDefs` requires `sprite.default` to be http(s) (`isHttpUrl`); emulator Storage URLs (`http://127.0.0.1:9199/...`) and live URLs both qualify. Placeholder http URL in Task 7 keeps validation green pre-upload.
- localStorage `sentence-pet-petdefs` caches the catalog; clear after any count change, or stale data renders.
- Windows `emulators:export` fails (`EPERM rename`) — rely on auto-seed, not export.
- rembg prints a harmless CUDA-dll warning on CPU.
- `src/domain/petDef.ts` `active` is currently `ALL_PET_DEFS` (PROOF hack) — must be `BUILTIN_PET_DEFS` before committing that file.
