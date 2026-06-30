// scripts/import/contact-sheet.mjs — review artifacts for filling import.tsv by hand.
// Produces, in scripts/import/out/:
//   contact-N.png        — per-slug rows of [adult|young|baby] crops, labeled slug + blobCount
//                          (verify segmentation + identify which slug is which creature)
//   bannerless-N.png     — full source-sheet thumbnails for sheets that have NO banner crop,
//                          labeled slug, so their names/rarity are readable for OCR-by-hand
// Names come from the banners-*.png montages (82 sheets) + these bannerless montages (36 sheets).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR, SPRITES_DIR, SRC_ROOT, MANIFEST, readJson } from './lib.mjs';

const manifest = readJson(MANIFEST);
const PLACE = 'xc:pink'; // missing-crop marker (stands out)

// --- crops contact sheet: 3 columns (adult|young|baby), one slug per row ---
const PER_ROWS = 12; // 12 slugs (36 tiles) per page
for (let p = 0; p * PER_ROWS < manifest.length; p++) {
  const group = manifest.slice(p * PER_ROWS, p * PER_ROWS + PER_ROWS);
  const args = [];
  for (const m of group) {
    const d = join(SPRITES_DIR, m.slug);
    const tag = `${m.slug} [${m.blobCount}${m.flag ? ' FLAG' : ''}]`;
    // adult tile carries the slug label; young/baby unlabeled
    for (const stage of ['adult', 'young', 'baby']) {
      const f = join(d, `${stage}.webp`);
      args.push('-label', stage === 'adult' ? tag : '', existsSync(f) ? f : PLACE);
    }
  }
  const out = join(OUT_DIR, `contact-${p + 1}.png`);
  execFileSync('magick', ['montage', ...args, '-tile', '3x', '-geometry', '200x200+6+6',
    '-background', 'white', '-pointsize', '16', out]);
  console.log('wrote', out, `(${group.length} slugs)`);
}

// --- bannerless source montage: full sheets whose banner wasn't auto-cropped ---
const bannerless = manifest.filter((m) => !existsSync(join(OUT_DIR, `banner-${m.slug}.png`)));
const PER_SRC = 9;
for (let p = 0; p * PER_SRC < bannerless.length; p++) {
  const group = bannerless.slice(p * PER_SRC, p * PER_SRC + PER_SRC);
  const args = [];
  for (const m of group) {
    const src = join(SRC_ROOT, m.folder === '.' ? '' : m.folder, m.srcFile);
    args.push('-label', m.slug, existsSync(src) ? src : PLACE);
  }
  const out = join(OUT_DIR, `bannerless-${p + 1}.png`);
  execFileSync('magick', ['montage', ...args, '-tile', '3x', '-geometry', '420x300+8+8',
    '-background', 'white', '-pointsize', '20', out]);
  console.log('wrote', out, `(${group.length} sheets)`);
}
console.log(`\n${manifest.length} slugs; ${bannerless.length} bannerless (in bannerless-*.png).`);
console.log('Fill name+rarity columns in scripts/import/out/import.tsv using banners-*.png + bannerless-*.png.');
