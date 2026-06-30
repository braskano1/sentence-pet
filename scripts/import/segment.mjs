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
