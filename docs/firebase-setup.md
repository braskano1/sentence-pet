# Firebase setup (one-time, operator)

The app stays on the **Spark (free) plan** — Auth + Firestore only, no Cloud Functions.

> **Prerequisite for the emulator / rules tests:** **JDK 21 or higher** must be installed and on `PATH`. firebase-tools v15 refuses older Java versions.

## Console steps
1. Create a Firebase project (Spark plan) at https://console.firebase.google.com.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database → Production mode.**
4. **Project settings → General → Your apps → Web app (`</>`)** → register → copy the config.
5. Copy `.env.example` to `.env.local` and fill every `VITE_FIREBASE_*` value from that config. Leave `VITE_USE_EMULATOR=false` for cloud, `true` for the local emulator.
6. Create your admin user: **Authentication → Users → Add user** (or sign up once via the `#admin` login form), then copy that user's UID.
7. **Project settings → Service accounts → Generate new private key** → download the JSON. Keep it OUT of git (already gitignored).
8. Update `.firebaserc` `default` to your real project id.

## Grant yourself admin
```bash
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
npm run set-admin -- <your-uid>
```
Then sign out/in at `#admin` so the new claim lands in your ID token.

## Deploy security rules
```bash
npx firebase deploy --only firestore:rules
```

## Local development against the emulator
```bash
# Terminal 1 — requires JDK 21+
npm run emulators
# Terminal 2 — set VITE_USE_EMULATOR=true in .env.local first
npm run dev
```

## Run the rules tests
```bash
npm run test:rules   # boots the Firestore emulator (JDK 21+), runs the rules suite, shuts down
```

## Reaching the admin tool
Open the app at `<url>/#admin`. Non-admins and signed-out visitors are refused.

## Seeding content (one-time / after content model changes)

The player ships with a bundled content snapshot, but Firestore must be seeded so the
admin tool and live fetch have data:

1. `npm run seed:export`  — writes `dist-seed/content.json` from `src/content/seed.ts`.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to your service-account key (see admin-claim setup).
3. `npm run seed:push`    — writes `content/pool` + `content/journey` atomically.

Re-runnable; overwrites both docs. After this, edit content live via the admin tool (`#admin`).
