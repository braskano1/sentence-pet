// One-shot: grant the {admin:true} custom claim to a user.
// Requires a service account key via GOOGLE_APPLICATION_CREDENTIALS.
// Usage: node scripts/set-admin-claim.mjs <uid>
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/set-admin-claim.mjs <uid>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

await getAuth().setCustomUserClaims(uid, { admin: true });
console.log(`admin=true set on ${uid}. The user must sign out/in to refresh their ID token.`);
process.exit(0);
