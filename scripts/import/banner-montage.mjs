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
