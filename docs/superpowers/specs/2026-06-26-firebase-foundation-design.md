# Firebase Foundation — Design Spec

**Date:** 2026-06-26
**Sub-project:** B-admin / accounts phase, slice 1 of 4.
**Status:** approved (brainstorm), pending implementation plan.

## Context

Sentence Pet is currently frontend-only: all content (`src/data/journey.ts`, `src/data/wordBank.ts`) is static TS compiled into the bundle, and all player state lives in localStorage (Zustand persist v9). The team wants an admin backend to author content, and — newly in scope — student accounts so students can persist their pet collection across devices and battle friends. That is the full Firebase/accounts phase sketched in `GAME_DESIGN.md` §8.

The work decomposes into four sequential sub-projects:

1. **Firebase foundation** (this spec) — project, Auth, Firestore, security rules, SDK wiring. Shared prerequisite.
2. **Content authoring** (admin) — content in Firestore, live player fetch. Needs #1.
3. **Student accounts + cloud save** — email/password login, migrate localStorage pets/progress/coins to per-user Firestore. Needs #1.
4. **Battle / friends** (multiplayer) — friend graph, battle. Needs #3.

Each gets its own spec → plan → build cycle. This spec covers **only #1**.

## Locked decisions (from brainstorm)

- **Storage:** Firestore (runtime).
- **Player read path (future slice):** live fetch from Firestore, cached locally. Drives `content` being public-read.
- **Admin gate:** Firebase Auth + **admin custom claim**.
- **Student login (future slice):** email/password. Students are minors (Thai M.4, ~15–16) → PDPA consent handled in the accounts slice, not here.
- **Content model (future slice):** shared item pool + lesson references.
- **Foundation shape:** **tracer bullet** — thinnest end-to-end vertical proving every layer once.
- **Dev/test:** Firebase Emulator Suite.
- **Access-layer structure:** thin module layer + React auth context (approach A).

## Goal

Stand up a thin, end-to-end Firebase base that proves Auth + custom-claim gating + Firestore read/write + security rules all work, behind a minimal gated admin route — so the three downstream slices build on proven infrastructure instead of dead scaffolding.

## Architecture

### Module layout

```
src/firebase/
  app.ts        // initializeApp from import.meta.env.VITE_FIREBASE_*; exports app
  auth.ts       // getAuth, signIn(email,pw), signOutUser(), onAuthChange(cb)
  db.ts         // getFirestore handle; connects emulator when VITE_USE_EMULATOR === 'true'
  ping.ts       // tracer repo: writePing(uid), readPing(uid) on ping/{uid}
src/auth/
  AuthProvider.tsx  // context provider: {user, isAdmin, loading, signIn, signOut}
  useAuth.ts        // hook over the context
src/components/admin/
  AdminRoute.tsx    // gate component
  AdminShell.tsx    // minimal authed-admin landing
scripts/
  set-admin-claim.mjs   // one-shot firebase-admin script to grant {admin:true}
firebase.json       // emulator config (Auth + Firestore)
.firebaserc         // project alias
firestore.rules     // security rules
.env.example        // committed config template
```

- `isAdmin` is read from the ID-token custom claim via `getIdTokenResult().claims.admin === true` — **not** a Firestore lookup.
- Firebase web config is **not secret**; it is safe in the client bundle. Env vars keep it out of source and allow per-environment values.
- The **player app is untouched** this slice — no student login, no content fetch, no persist change.

### Tracer-bullet flow

Hidden route `/admin` (entry not linked from player UI). Flow:

1. Unauthenticated → email/password login form → `signIn`.
2. Authenticated **non-admin** → "not authorized" message (proves claim gating + rule denial).
3. Authenticated **admin** → `AdminShell`: shows `Signed in as <email> · admin ✓`, a **Ping Firestore** button (`writePing(uid)` then `readPing(uid)`, shows round-trip result), and **Sign out**.

This exercises, once each: Auth sign-in → ID-token custom claim → Firestore write + read → security-rule enforcement (admin allowed, others denied).

## Data model (baseline)

Define the namespace now (mostly empty) so later slices slot in without re-architecting. Matches `GAME_DESIGN.md` §8.

| Path | Purpose | Slice |
|---|---|---|
| `ping/{uid}` | tracer round-trip only; removable later | this slice |
| `content/{…}` | authored journey/items | content slice |
| `reviewQueue/{id}` | AI items pending admin approval | later (AI phase) |
| `users/{uid}/…` | per-student pet/progress/collection | accounts slice |

## Security rules

`firestore.rules`, **deny-by-default**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() { return request.auth != null && request.auth.token.admin == true; }

    match /ping/{uid}            { allow read, write: if isAdmin(); }
    match /content/{doc=**}      { allow read: if true;  allow write: if isAdmin(); }
    match /reviewQueue/{doc}     { allow read, write: if isAdmin(); }
    match /users/{uid}/{d=**}    { allow read, write: if request.auth != null && request.auth.uid == uid; }
    // all other paths: denied by default
  }
}
```

- `content` is **public-read** to match the locked live-player-fetch decision — players read without accounts.
- `users/*` is owner-only, ready for the accounts slice.

## Admin custom-claim mechanism

No Cloud Functions (those require the Blaze plan). The admin claim is set by a **local one-shot Node script**:

- `scripts/set-admin-claim.mjs` uses `firebase-admin` → `setCustomUserClaims(uid, { admin: true })`.
- Run once per admin UID: `node scripts/set-admin-claim.mjs <uid>`.
- Requires a **service account JSON** downloaded from the Firebase console; path supplied via `GOOGLE_APPLICATION_CREDENTIALS`. The key file is **gitignored and never committed**.
- After running, the admin must sign out/in (or force-refresh the ID token) for the claim to appear.
- Keeps the foundation on the **Spark plan** (Auth + Firestore only). **Blaze is deferred** to the future AI-proxy phase.

## Testing strategy

- **Rules tests** (`@firebase/rules-unit-testing`, against the Firestore emulator) — the high-value integration test:
  - admin token can read+write `ping/*` and write `content/*`;
  - unauthenticated client can **read** `content/*` but **not** write;
  - non-owner is **denied** on `users/{other}/…`, owner is allowed;
  - default-deny on an unmatched path.
- **Unit/render tests** — `AuthProvider`, `useAuth`, `AdminRoute`, `AdminShell` with the Firebase SDK mocked (`vi.mock`), following the existing jsdom convention (no real network in jsdom).
- The emulator requires **Java**; flagged as an environment prerequisite. The rules suite **skips gracefully** when Java/emulator is unavailable so the main `vitest` run stays green.
- `npx tsc -b` and `npm run build` remain clean. **No Zustand persist version bump** (no schema change this slice).

## Manual console steps (operator runs; plan documents exact clicks)

1. Create a Firebase project (Spark plan).
2. Enable **Authentication → Email/Password** provider.
3. Create **Firestore** (production mode; rules deployed from the repo).
4. Register a **Web app** → copy config → fill `.env.local` (template `.env.example` committed).
5. Create the admin user (Auth console, or the login form once wired).
6. Download a **service account key** → run `node scripts/set-admin-claim.mjs <your-uid>`.
7. Deploy rules: `firebase deploy --only firestore:rules`.

## Non-goals (this slice only)

- ❌ Student login/signup, anonymous auth, PDPA consent copy.
- ❌ Migrating localStorage pets/progress/coins to Firestore.
- ❌ Content authoring UI, content fetch in the player app, the item-pool model.
- ❌ Battle, friends, multiplayer.
- ❌ Cloud Functions, AI proxy, image storage, Blaze plan.
- ❌ Polished admin UI — `AdminShell` is functional only; visual polish via `impeccable` later.

## Success criteria

- A signed-in admin reaches `/admin`, sees the admin shell, and a Firestore ping round-trips.
- A signed-in non-admin and an unauthenticated visitor are both refused at `/admin`.
- Rules tests pass against the emulator, encoding the allow/deny matrix above.
- `npx tsc -b`, `npm run build`, and the full `vitest` suite are green (rules suite skips cleanly without Java).
- Player app behavior is unchanged.
