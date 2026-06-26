// One-shot: push the migrated content bundle to Firestore (content/pool + content/journey).
// Requires GOOGLE_APPLICATION_CREDENTIALS (service account) and dist-seed/content.json
// (run `npm run seed:export` first). Usage: npm run seed:push
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const bundle = JSON.parse(readFileSync('dist-seed/content.json', 'utf8'));

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const batch = db.batch();
batch.set(db.collection('content').doc('pool'), { items: bundle.pool });
batch.set(db.collection('content').doc('journey'), { units: bundle.units });
await batch.commit();

console.log(`seeded content: ${bundle.units.length} units, ${Object.keys(bundle.pool).length} items.`);
process.exit(0);
