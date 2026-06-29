// P3b smoke-test setup (emulator-only). Creates an admin user in the Auth
// emulator and generates two xlsx fixtures (valid + invalid) for the import flow.
// Requires the Auth emulator at 127.0.0.1:9099. Usage:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/p3b-smoke-setup.mjs
import { mkdirSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as XLSX from 'xlsx';

const PROJECT = 'demo-sentence-pet';
const EMAIL = 'admin@test.dev';
const PASSWORD = 'test1234';
const OUT = 'dist-smoke';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('FIREBASE_AUTH_EMULATOR_HOST not set — refusing to touch prod.');
  process.exit(1);
}

initializeApp({ projectId: PROJECT });
const auth = getAuth();

// Create (or reuse) the admin user, then stamp the admin claim.
let uid;
try {
  const u = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true });
  uid = u.uid;
  console.log(`created user ${EMAIL} uid=${uid}`);
} catch (e) {
  if (e.code === 'auth/email-already-exists') {
    const u = await auth.getUserByEmail(EMAIL);
    uid = u.uid;
    console.log(`reusing user ${EMAIL} uid=${uid}`);
  } else { throw e; }
}
await auth.setCustomUserClaims(uid, { admin: true });
console.log(`admin=true set on ${uid}`);

// xlsx fixtures.
mkdirSync(OUT, { recursive: true });
function write(name, sheets) {
  const book = XLSX.utils.book_new();
  for (const [n, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), n);
  }
  const path = `${OUT}/${name}`;
  XLSX.writeFile(book, path);
  console.log(`wrote ${path}`);
}

const validSheets = {
  Course: [['id', 'title', 'emoji'], ['sp-import', 'Imported Course', '📦']],
  Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['iu1', 'Imported Unit', '🧪', 1, false]],
  Items: [['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'variant', 'slots', 'answer'],
          ['id1', 'dragdrop', 1, 'iu1', 'iu1-n1', 'ฉันวิ่ง', 'pattern', 'Pronoun,Verb', 'I,run']],
  Bosses: [['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'],
           ['imp-final', 'final', '', 'iu1', 6, 'id1']],
};
write('valid.xlsx', validSheets);

// Invalid: drop the Bosses sheet → parser reports a missing required sheet.
const { Bosses, ...invalidSheets } = validSheets;
void Bosses;
write('invalid.xlsx', invalidSheets);

console.log('SMOKE_SETUP_OK');
process.exit(0);
