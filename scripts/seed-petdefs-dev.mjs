// DEV-only: seed the Firestore emulator's content/petDefs as Model B — every pet
// is a 3-def evolution chain (baby -> young -> adult). The 4 built-in elements use
// the existing per-species stage art (no sprite override needed); the Tempest Falcon
// uses the split sheet art served by the vite dev server (absolute http URLs).
// Grid card shows ONE line number per pet (1..5 on the chain root). Non-root stages
// get offset dexNos (never shown — detail labels stages by name).
// Usage: node scripts/seed-petdefs-dev.mjs   (emulators must be running)
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const DEV = process.env.DEV_ORIGIN ?? 'http://localhost:5173';

const range = (min, max) => [min, max];
const stats = (min, max) => ({ hp: range(min, max), atk: range(min, max), def: range(min, max), spd: range(min, max), luk: range(min, max) });
const STAT_BANDS = { common: stats(40, 60), rare: stats(55, 75), epic: stats(72, 88), legendary: stats(85, 90) };

/**
 * Build a 3-def chain for one creature.
 * @param base      id/prefix, e.g. 'def-leaf'
 * @param element   one of leaf|fire|air|water (art family + override guard)
 * @param lineNo    the pet's single dex number shown on the grid card (root dexNo)
 * @param opts      { starter?, rarity?, sprites?: {baby,young,adult} }
 */
function chain(base, element, lineNo, opts = {}) {
  const ids = [`${base}-1`, `${base}-2`, `${base}-3`];
  // root keeps the nice line number; young/adult get offset, never-displayed dexNos
  const dexNos = [lineNo, 100 + lineNo * 3 + 1, 100 + lineNo * 3 + 2];
  const stages = [1, 2, 3];
  return ids.map((id, i) => ({
    id,
    name: opts.name ?? 'Pet',
    gen: 1,
    dexNo: dexNos[i],
    types: [element],
    element,
    statBands: STAT_BANDS,
    enabled: true,
    evolutionStage: stages[i],
    ...(i > 0 ? { evolvesFromId: ids[i - 1] } : {}),
    ...(i < 2 ? { evolvesToId: ids[i + 1] } : {}),
    ...(i === 0 && opts.starter ? { starter: true } : {}),
    ...(i === 0 && opts.rarity ? { rarity: opts.rarity } : {}),
    ...(opts.sprites ? { sprite: { default: opts.sprites[['baby', 'young', 'adult'][i]] } } : {}),
  }));
}

const fSprite = (stage) => `${DEV}/src/assets/sprites/tempest-falcon/${stage}.webp`;

const defs = [
  ...chain('def-leaf', 'leaf', 1, { name: 'Leaflet', starter: true }),
  ...chain('def-fire', 'fire', 2, { name: 'Embers' }),
  ...chain('def-air', 'air', 3, { name: 'Zephyr' }),
  ...chain('def-water', 'water', 4, { name: 'Dewdrop' }),
  ...chain('def-tempest-falcon', 'air', 5, {
    name: 'Tempest Falcon',
    rarity: 'rare',
    sprites: { baby: fSprite('baby'), young: fSprite('young'), adult: fSprite('adult') },
  }),
];

initializeApp({ projectId: 'demo-sentence-pet' });
await getFirestore().doc('content/petDefs').set({ defs });
console.log(`seeded content/petDefs: ${defs.length} defs = 5 chains (lines 1-5), falcon sprites @ ${DEV}`);
process.exit(0);
