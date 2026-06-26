import { writeFileSync, mkdirSync } from 'node:fs';
import { SEED } from '../src/content/seed';

mkdirSync('dist-seed', { recursive: true });
writeFileSync('dist-seed/content.json', JSON.stringify(SEED, null, 2));
console.log(`wrote dist-seed/content.json (${SEED.units.length} units, ${Object.keys(SEED.pool).length} items)`);
