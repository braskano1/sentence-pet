// scripts/import/upload-and-seed.mjs — upload stage sprites to the emulator Storage,
// bake the resulting URLs into the imported defs, and write content/petDefs as
// [4 built-in element chains (dex lines 1-4)] + [111 imported chains (lines 5-115)].
// Emulators must be running (npm run dev:emulators) and already auto-seeded.
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
const db = getFirestore();

const publicUrl = (objPath) => `http://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(objPath)}?alt=media`;

const { importedDefs } = readJson(DEFS);

// 1) upload each stage sprite, rewrite sprite.default from placeholder -> emulator URL
let uploaded = 0;
for (const def of importedDefs) {
  const m = /\/([^/]+)\/(baby|young|adult)\.webp$/.exec(def.sprite.default);
  if (!m) throw new Error(`bad placeholder url on ${def.id}: ${def.sprite.default}`);
  const [, slug, stage] = m;
  const local = join(SPRITES_DIR, slug, `${stage}.webp`);
  if (!existsSync(local)) throw new Error(`missing sprite ${local}`);
  // Must live under petDefs/** — storage.rules grants public read only there.
  const objPath = `petDefs/${slug}/${stage}.webp`;
  await bucket.upload(local, { destination: objPath, metadata: { contentType: 'image/webp' } });
  def.sprite.default = publicUrl(objPath);
  uploaded++;
}

// 2) keep ONLY the 4 built-in element chains (def-leaf/fire/air/water-[1-3], lines 1-4).
//    Drop the baseline def-tempest-falcon (line 5) — the imports own lines 5-115 and
//    include Tempest Falcon (air-018) already. Import ids are def-<el>-NNN-[1-3], so the
//    single-digit-suffix regex matches baseline chains only, never imports.
const cur = (await db.doc('content/petDefs').get()).data();
const baseline = (cur?.defs ?? []).filter((d) => /^def-(leaf|fire|air|water)-[1-3]$/.test(d.id));
if (baseline.length !== 12) {
  throw new Error(`expected 12 baseline element defs, found ${baseline.length} — is the emulator auto-seed done?`);
}

const defs = [...baseline, ...importedDefs];

// 2b) The "100 + line*3" non-root offset scheme collides with root dex lines once
//     there are >~30 chains (baseline offsets 104-114 land inside root range 5-115).
//     Non-root dexNos are never displayed (detail labels stages by name), so remap
//     every non-root def to a unique high band. Roots keep their shown line number.
let hi = 1000;
for (const d of defs) if (d.evolvesFromId) d.dexNo = hi++;

// 3) safety: no duplicate ids or (gen,dexNo) pairs
const ids = new Set(), gd = new Set();
for (const d of defs) {
  if (ids.has(d.id)) throw new Error(`duplicate id ${d.id}`);
  ids.add(d.id);
  const key = `${d.gen}:${d.dexNo}`;
  if (gd.has(key)) throw new Error(`duplicate (gen,dexNo) ${key} at ${d.id}`);
  gd.add(key);
}

await db.doc('content/petDefs').set({ defs });
console.log(`uploaded ${uploaded} sprites; wrote content/petDefs: ${defs.length} defs ` +
  `(${baseline.length} baseline + ${importedDefs.length} imported = ${defs.length / 3} chains)`);
process.exit(0);
