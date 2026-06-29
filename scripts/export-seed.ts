import { writeFileSync, mkdirSync } from 'node:fs';
import { SEED, SEED_COURSE } from '../src/content/seed';

mkdirSync('dist-seed', { recursive: true });
writeFileSync('dist-seed/content.json', JSON.stringify(SEED, null, 2));
writeFileSync('dist-seed/course.json', JSON.stringify(SEED_COURSE, null, 2));
console.log(
  `wrote dist-seed/content.json (${SEED.units.length} units, ${Object.keys(SEED.pool).length} items) ` +
  `and dist-seed/course.json (${SEED_COURSE.gates.length} gates, finalBoss ${SEED_COURSE.finalBoss ? 'yes' : 'no'})`,
);
