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
  '🧬 8. Newly Discovered Creatures': 'leaf',
  // NOTE: root '.' excluded — those loose PNGs are egg art (ChatGPT Image *),
  // not 3-age creature sheets.
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
