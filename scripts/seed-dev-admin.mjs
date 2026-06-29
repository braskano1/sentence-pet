// DEV-only: create the fixed admin account in the Auth emulator and grant it
// the {admin:true} claim, so the "🔑 Dev admin sign-in" button on /#admin works.
// Emulator data is ephemeral — re-run after restarting the emulators.
// Usage: npm run dev:admin   (emulators must be running)
// Credentials MUST match src/dev/adminAccount.ts.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT = 'demo-sentence-pet';
const EMAIL = 'admin@test.dev';
const PASSWORD = 'test1234';

// Default to the local Auth emulator so a plain `npm run dev:admin` just works.
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

initializeApp({ projectId: PROJECT });
const auth = getAuth();

let uid;
try {
  uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true })).uid;
  console.log(`created ${EMAIL} (uid=${uid})`);
} catch (e) {
  if (e.code === 'auth/email-already-exists') {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    console.log(`reusing ${EMAIL} (uid=${uid})`);
  } else { throw e; }
}
await auth.setCustomUserClaims(uid, { admin: true });
console.log(`admin=true set. Open <dev-url>/#admin and click "🔑 Dev admin sign-in" (${EMAIL} / ${PASSWORD}).`);
process.exit(0);
