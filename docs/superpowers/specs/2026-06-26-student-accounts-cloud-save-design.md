# Student Accounts + Cloud Save — Design Spec

**Date:** 2026-06-26
**Sub-project:** B-admin / accounts phase, **slice 3 of 4**.
**Status:** approved (brainstorm), pending implementation plan.
**Builds on:** `2026-06-26-firebase-foundation-design.md` (slice 1), `2026-06-26-content-authoring-design.md` (slice 2).

## Context

Sentence Pet is a mobile-first sentence-builder game for Thai M.4 students (~15–16, pre-A1). All player state currently lives in localStorage (Zustand persist v9): `pets[]`, `activePetId`, `coins`, `inventory`, `owned`, `activeBackground`, `journey.lessonStars`, plus transient UI fields. Content moved to Firestore in slice 2 and is account-independent (public read).

This slice adds **student accounts** so a kid keeps their pet collection, coins, and progress across devices, and **cloud save** persisting that state per-user under `users/{uid}/*`. It unblocks **slice 4 (battle/friends)**, which needs stable per-user identities and a friend-readable pet collection.

Slices 1–2 already stood up Firebase Auth, Firestore, deny-by-default security rules, the `users/{uid}/{document=**}` owner-only rule, an `AuthProvider`/`useAuth` context (admin-oriented), and `src/firebase/{app,auth,db}.ts`. The player app itself is currently **not** wrapped in `AuthProvider` and has no auth — slice 3 changes that.

## Locked decisions (from brainstorm)

| Fork | Decision | Rationale |
|---|---|---|
| **Auth model** | **Anonymous-first + `linkWithCredential` upgrade** | Kid plays immediately as a Firebase anonymous user (zero first-run friction, the egg-hatch flow is untouched). Signing up links the anon account to email/password, so same-device progress is auto-preserved with **no merge code**. Cloud save exists from the first run for every guest. |
| **Doc shape** | **Split docs**: `users/{uid}/profile` + `users/{uid}/pets/{petId}` | Pets and profile are filed separately, ready for slice-4 friends reading a pet subcollection. (User-chosen over the simpler single-doc; the extra sync/rules plumbing and partial-write consistency are accepted costs.) |
| **Sync timing** | **Debounced save-on-change (~1.5s quiet window)** | Near-live, crash-safe, one simple rule. Firestore offline persistence queues writes offline and flushes on reconnect — no custom queue. Split-doc fit: only the changed profile/pet docs are written. |
| **Conflict rule** | **Cloud always wins on sign-in** | "Your account follows you." Dead simple, predictable, no merge code. The common same-device anon→email path never hits a conflict (link preserves progress); only a second-device sign-in does, and there cloud overwrites local guest progress. |
| **Consent** | **Teacher/school-mediated** | The app shows a plain-language PDPA notice + records an in-app acknowledgment; legal guardian consent is obtained offline by the school/teacher. Lowest friction for a classroom-deployed tool; stores a provable acknowledgment record. |
| **Persist version** | **No bump (stay v9)** | Sync is a side-effect layer over the existing v9 blob; the Zustand schema does not change. `uid` lives in `AuthProvider`, sync-status is transient. The local→split-cloud-doc mapping is a transform at the Firestore boundary, not a schema change. |

> **Legal flag.** Claude is not a lawyer. The PDPA notice/consent copy in this slice is functional placeholder text and **must be reviewed by a human (and ideally legal/school admin) before production use.**

## Goal

Every player is a Firebase user from first load (anonymous), their state is mirrored to per-user Firestore docs via a debounced sync layer, and any student can upgrade to an email/password account (with a school-mediated consent acknowledgment) that follows them across devices — all behind the existing owner-only security rule, with the player app newly wrapped in auth.

## Architecture

### Module layout

```
src/firebase/
  auth.ts            // EXTEND: signInAnon(), linkEmailPassword(email,pw); signIn()/signOutUser()/onAuthChange() already exist
  users.ts           // NEW repo: cloud read/write under users/{uid}/*
src/auth/
  AuthProvider.tsx   // EXTEND: bootstrap anon on load; expose isAnonymous, linkEmail(), signIn(), signOut()
  useAuth.ts         // same hook; new fields surfaced
src/sync/
  cloudSync.ts       // debounced store subscriber → maps v9 blob to split docs, writes changed ones
  mapping.ts         // pure: blob → {profile, pets[]} and {profile, pets[]} → partial blob (no I/O)
  reconcile.ts       // on sign-in: cloud-always-wins → load cloud, setState into store
src/components/account/
  SignUpForm.tsx     // email + password + consent notice/ack (functional; impeccable polishes later)
  AccountButton.tsx  // guest: "Save your pets across devices" → SignUpForm; signed-in: email + Sign out
docs/
  firebase-setup.md  // EXTEND: enable Anonymous auth provider; PDPA notice copy + review note
```

`AuthProvider` now wraps the **player** tree (via `src/main.tsx`), not just the admin tree.

### Module responsibilities (isolation boundaries)

- **`src/firebase/auth.ts`** — thin Firebase SDK wrappers only. `signInAnon()` = `signInAnonymously(auth)`. `linkEmailPassword(email, pw)` = `linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, pw))`. No app logic. Depends on: `firebase/auth`, `./app`.
- **`src/firebase/users.ts`** — the only module that knows the Firestore paths/shapes for user data. Exports: `loadCloudSave(uid) → {profile, pets[]} | null`, `saveProfile(uid, profileDoc)`, `savePet(uid, petDoc)`, `writeConsent(uid, record)`. Stamps `updatedAt: serverTimestamp()` and `persistVersion`. Depends on: `firebase/firestore`, `./db`.
- **`src/sync/mapping.ts`** — **pure, no I/O.** `toCloud(state) → {profile, pets}` splits the partialized blob; `fromCloud({profile, pets}) → Partial<persisted blob>` recombines. Unit-testable in isolation. This is where the split-doc shape is defined in code.
- **`src/sync/cloudSync.ts`** — orchestrates the debounce. `startCloudSync(uid, {getState, subscribe, repo, debounceMs, scheduleFn})` subscribes to the store, on change debounces, diffs the new cloud shape against the last-synced snapshot, and calls `repo.saveProfile`/`repo.savePet` only for changed docs. Repo + timer + scheduler are **injected** so tests use fakes (no real Firestore, deterministic timing). Returns a stop function.
- **`src/sync/reconcile.ts`** — `reconcileFromCloud(uid, {repo, applyState})`: reads cloud via repo, maps `fromCloud`, applies to the store. Cloud-always-wins ⇒ a straight overwrite, no merge. Used on email sign-in. Repo + applyState injected.
- **`src/auth/AuthProvider.tsx`** — owns the auth lifecycle: on mount, if no `currentUser`, call `signInAnon()`. Tracks `{user, isAdmin, isAnonymous, loading}`. Wires `startCloudSync` when a uid is present and `reconcileFromCloud` on email sign-in. Exposes `linkEmail(email, pw)`, `signIn`, `signOut`.

### Data flow

**First run (new or existing-localStorage player):**
1. `main.tsx` renders `<AuthProvider><App/></AuthProvider>`.
2. `AuthProvider` sees no user → `signInAnon()` → anon `uid`.
3. localStorage hydrates the store instantly (existing v9 blob, or fresh).
4. `startCloudSync(uid)` begins; the first store settle pushes the current blob up as the first cloud backup (split into `profile` + `pets/*`).

**Sign-up (anon → email, same device):**
1. Guest taps `AccountButton` → `SignUpForm`.
2. Form collects email + password, shows the PDPA notice, requires the ack checkbox.
3. Submit → `linkEmailPassword(email, pw)` (anon account becomes an email account, **same uid, progress untouched**) → `writeConsent(uid, {ackAt, policyVersion, model:'school-mediated'})`.
4. Cloud docs already current from ongoing sync; nothing to migrate.

**Sign-in (existing account, second device):**
1. Kid taps `AccountButton` (signed out / fresh anon) → enters email + password → `signIn`.
2. Firebase swaps the anon session for the email account (new/old uid = the account's uid).
3. `reconcileFromCloud(uid)` → cloud profile+pets overwrite the store (**cloud wins**) → localStorage re-persists.
4. `startCloudSync` resumes for that uid.

**Sign-out:** `signOut()` → `AuthProvider` re-bootstraps a fresh anonymous session; local store keeps its current state (kid continues as guest).

## Data model

All under the existing owner-only path `users/{uid}/{document=**}`.

| Path | Type | Contents |
|---|---|---|
| `users/{uid}/profile` | doc | `coins`, `inventory`, `owned`, `activeBackground`, `activePetId`, `journey.lessonStars`, `screen`, `selectedDrill`, `selectedLevel`, `lastReward`, `lastPull`, `persistVersion` (number), `updatedAt` (serverTimestamp) |
| `users/{uid}/pets/{petId}` | doc per pet | the `PetInstance` fields + `updatedAt` (serverTimestamp) |
| `users/{uid}/consent` | doc | `{ ackAt (serverTimestamp), policyVersion (string), model: 'school-mediated' }` |

Notes:
- `persistVersion` on the profile lets a future local persist bump migrate cloud-loaded saves with the same `migrate` chain (forward-compat; not exercised this slice since we stay v9).
- Transient fields excluded by `partialize` (`lastLevelUp`, `currentLessonId`) are **not** synced.
- Pet deletion is out of scope this slice (the game has no pet-delete); the sync layer only creates/updates pet docs.

## Security rules

**No `firestore.rules` change.** The slice-1 rule already covers everything:

```
match /users/{uid}/{d=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }
```

This grants the owner read+write across `profile`, `pets/*`, and `consent`, and denies everyone else by default. **Extend the rules-test matrix** (`src/firebase/rules.test.ts`) with concrete cases for the new docs:
- owner can read+write own `users/{uid}/profile`, `users/{uid}/pets/{petId}`, `users/{uid}/consent`;
- a different signed-in user is **denied** read and write on each of those paths;
- an unauthenticated client is **denied** on each.

## Testing strategy

- **Pure logic (highest value, jsdom-safe):**
  - `src/sync/mapping.ts` — round-trip `toCloud`/`fromCloud`, field placement, transient-field exclusion.
  - `src/sync/cloudSync.ts` — with injected fake repo + controllable scheduler: debounce coalesces rapid changes into one write; only changed docs are written (diff); stop() cancels a pending write.
  - `src/sync/reconcile.ts` — cloud docs overwrite store state (cloud-wins), empty cloud handled.
- **Rules tests** (`@firebase/rules-unit-testing`, `// @vitest-environment node`, gated on `FIRESTORE_EMULATOR_HOST`) — the allow/deny matrix above; `npm run test:rules` live under the emulator, skips cleanly during plain `npm test`.
- **Component render tests** — `SignUpForm` (renders notice + fields, ack gating disables submit, submit calls `linkEmail` + `writeConsent`), `AccountButton` (guest vs signed-in states), `AuthProvider` anon-bootstrap — with `src/firebase/*` and/or `useAuth` mocked (existing `vi.mock` convention; mock `canvas-confetti` if transitively imported).
- **Green bar:** `npx tsc -b`, `npm run build`, full `vitest` all clean; rules suite skips without Java.

## Manual / operator steps (added to `docs/firebase-setup.md`)

1. Firebase console → **Authentication → Sign-in method → enable Anonymous** provider (Email/Password already enabled in slice 1).
2. Confirm `users/*` rule deployed (already from slice 1; redeploy if needed: `firebase deploy --only firestore:rules`).
3. Provide final **PDPA notice copy** (human/legal/school review) to replace the placeholder text in `SignUpForm`.

## Non-goals (this slice)

- ❌ Battle, friends, multiplayer (slice 4).
- ❌ Smart-merge or live two-way (`onSnapshot`) sync — cloud-always-wins + debounced push only.
- ❌ Verified guardian-email loop / parental double-opt-in (needs email infra / Blaze).
- ❌ Cloud Functions, Blaze plan, AI proxy.
- ❌ Persist version bump (no local schema change).
- ❌ Pet deletion sync.
- ❌ Polished account UI — `SignUpForm`/`AccountButton` are functional; visual polish via `impeccable` later.
- ❌ Password reset / email verification flows (deferred; not required for classroom use this slice).

## Success criteria

- A fresh visitor plays immediately as an anonymous user; their pets/coins/progress appear in `users/{uid}/profile` + `users/{uid}/pets/*` within ~2s of change (emulator-verified).
- An existing localStorage player's v9 blob is mirrored to cloud on first load post-update, with no visible change to their game.
- A guest taps "Save your pets", acknowledges the consent notice, signs up → `linkWithCredential` keeps the same uid and all progress; a `users/{uid}/consent` record is written.
- Signing in with that email on a second device overwrites local guest progress with the account's cloud save (cloud wins).
- Rules tests encode owner-allowed / non-owner-denied / unauth-denied for `profile`, `pets/*`, `consent`.
- `npx tsc -b`, `npm run build`, and the full `vitest` suite are green (rules suite skips without Java).
- Admin path and content-fetch behavior from slices 1–2 are unchanged.
