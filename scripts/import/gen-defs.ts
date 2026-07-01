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
