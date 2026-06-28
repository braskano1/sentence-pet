# Handoff — Generational Pet Dex P3b: Firebase Storage sprite upload (+ P3a follow-ups)

**Date:** 2026-06-28
**Repo:** `sentence-pet` (Windows / PowerShell) — actual checkout at `D:/ai_projects/AI_design_thinking/sentence-pet` (NOT the H:\ Google-Drive copy, which only holds design docs).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; the whole drill-revamp + pet-authoring line promotes as one release later).
**Status:** NOT STARTED. **P3a is DONE** on `journey-redesign` (sprite-override resolver + admin URL-paste UI, NO Storage; 906 tests green, `tsc -b` + `npm run build` clean). Commits `b2a3452`→`dd05b06`.
**Predecessor:** P3a spec `docs/superpowers/specs/2026-06-28-generational-pet-dex-p3a-sprite-override-design.md` (read its "P3b follow-ups" section first) and memory `[[sentence-pet-generational-dex-p3a]]`.
**Epic spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md`.

## Goal

Replace P3a's URL-paste field with a **real Firebase Storage file upload** (admin picks an image from disk → uploads → the returned download URL is written into `PetDef.sprite.default`). Storage is greenfield: no `getStorage` exists yet. Then clear the rest of the P3a review follow-ups.

## ⚠️ Brainstorm first — open decisions

Start with `superpowers:brainstorming`. Settle these before planning:

1. **Upload UX:** keep the P3a URL-paste field as a fallback alongside the file picker, or fully replace it? (Replace is cleaner; paste-fallback is handy if Storage is flaky.)
2. **6-slot `variants` authoring UI — do it this phase or split to P3c?** The data shape, `validatePetDefs`, and `spriteSrc` ALREADY support `variants` (per stage×mood); P3a only surfaced `default`. Surfacing 6 slots is pure UI + 6 uploads. Decide scope.
3. **Storage path scheme:** e.g. `petDefs/{defId}/default.webp` (and `petDefs/{defId}/{stage}-{mood}.webp` when variants land). Confirm.
4. **Read access:** public read (sprites aren't secret, simplest) vs auth-only read. Write is admin-claim only.
5. **Image processing:** upload raw as-is, or client-resize/transcode to webp before upload? (Raw is simplest; creatures vary in size.)
6. **Orphaned-sprite cleanup:** when a sprite is cleared/replaced or a def deleted, delete the old Storage object, or leave it (cheaper, orphans accumulate)?

## What exists already (reuse — do NOT rebuild)

### From P3a (the override is fully wired — P3b only changes how the URL is obtained)
- **Data:** `PetDef.sprite?: { default?: string; variants?: Partial<Record<PetStage, Partial<Record<PetMood, string>>>> }` — `src/data/types.ts`. `default` surfaced; `variants` reserved. No migration needed to widen.
- **Validation:** `validatePetDefs` (`src/content/validate.ts`) — `isHttpUrl` rejects bad URLs, rejects `variants.egg`. Storage download URLs are https → already pass. **Keep the runtime guard** (content loads untyped from Firestore — defense-in-depth; that's why the type stays permissive).
- **Resolver:** `spriteSrc(species, stage, mood, def?)` (`src/config/sprites.ts`) — variant → default → element art; egg short-circuits. **No change needed** for P3b upload itself.
- **Render:** `PetSprite` (`src/components/PetSprite.tsx`) — `defId?` prop → `resolvePetDef` → override + `<img onError>` element-art fallback (never-blank). `defId` threaded at `PetRoom` + `DrillScreen`→`DrillPet`.
- **Admin UI:** `PetForm` Sprites `<fieldset>` in `src/components/admin/PetsTab.tsx` — currently a URL `<input>` writing `sprite.default` + thumbnail + Clear, plus exported `stripDefault`. **This is the hook point**: swap/augment the input with a file picker that uploads then calls the same `onPatch({ sprite: { ...def.sprite, default: <downloadURL> } })`. Save path (`savePetDefs` → `setActivePetDefs` + `writePetDefsCache`, registry swap AFTER save) is unchanged.

### Firebase (Storage is greenfield)
- **`firebase` dep is v12.15.0** — `firebase/storage` is available; no install needed.
- **App init:** `src/firebase/app.ts` — `initializeApp(firebaseConfig)`; `storageBucket` from `VITE_FIREBASE_STORAGE_BUCKET` (`.env.local` → `demo-sentence-pet.appspot.com`). **No `getStorage` anywhere.**
- **Emulator-connect pattern to mirror** (`src/firebase/db.ts`):
  ```ts
  export const db = getFirestore(firebaseApp);
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
    connectFirestoreEmulator(db, host, 8080);
  }
  ```
  P3b writes `src/firebase/storage.ts` the same way: `export const storage = getStorage(firebaseApp);` + `if (VITE_USE_EMULATOR==='true') connectStorageEmulator(storage, host, 9199);`
- **`firestore.rules` admin pattern to mirror** in `storage.rules`:
  ```
  function isAdmin() { return request.auth != null && request.auth.token.admin == true; }
  match /content/{doc=**} { allow read: if true; allow write: if isAdmin(); }
  ```
- **`firebase.json`** currently has NO storage block (see below).
- **No upload code exists** — `uploadBytes`/`getDownloadURL` → zero hits. P3b writes the first.

### Admin / dev harness
- `npm run dev:admin` (`scripts/seed-dev-admin.mjs`) seeds `admin@test.dev` + `{admin:true}`; `/#admin` → 🔑 Dev admin sign-in (DEV-only). Admin gate `src/auth/adminEntry.ts` + `AdminRoute.tsx`.
- `npm run emulators` = `firebase emulators:start --only auth,firestore` → **must add `,storage`**.
- Tests mock Firebase: `PetsTab.test.tsx` mocks `savePetDefs` + `writePetDefsCache` via `vi.mock`. Mock the new `uploadSprite`/storage module the same way.

## Scope (once design is locked)

1. **Storage wiring** — new `src/firebase/storage.ts`: `getStorage(firebaseApp)` + emulator-connect (port 9199) gated on `VITE_USE_EMULATOR`. Plus an upload helper, e.g. `uploadSprite(defId, file): Promise<string>` (→ `ref(storage, path)` → `uploadBytes` → `getDownloadURL`).
2. **`firebase.json`** — add the Storage emulator block + top-level rules pointer:
   ```jsonc
   "storage": { "rules": "storage.rules" },          // top-level, sibling of "firestore"
   "emulators": { ... "storage": { "port": 9199, "host": "0.0.0.0" } }
   ```
   ⚠️ `firebase.json` is **intentionally modified-but-unstaged** locally (the `host: 0.0.0.0` additions). Adding Storage config edits an already-dirty file — handle staging **deliberately**, decide whether to finally stage it, and **never** sweep it in with `git add -A` (concurrent sessions).
3. **`storage.rules`** (new file) — admin-claim write to the sprite path, read per the locked design (public or auth):
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       function isAdmin() { return request.auth != null && request.auth.token.admin == true; }
       match /petDefs/{defId}/{file=**} {
         allow read: if true;          // or: if request.auth != null;
         allow write: if isAdmin();
       }
     }
   }
   ```
4. **`npm run emulators`** — add `,storage` so the Storage emulator boots with the others.
5. **Upload UI in `PetForm`** — file `<input type="file" accept="image/*">`: on select, `uploadSprite(def.id, file)` → write the returned URL via the existing `onPatch({ sprite: { ...def.sprite, default: url } })`; loading + error states (accessible, `aria-live`); keep thumbnail + Clear. Decide paste-fallback per brainstorm.
6. **Tests** — mock the storage module (like `savePetDefs`): upload writes the returned URL into the draft; Save persists it; error path leaves the field unchanged + surfaces an error; resolver/render already covered by P3a.
7. **(If in scope) 6-slot `variants` UI** — surface the reserved `variants` map; no data/validate/resolver change needed.

### P3a review follow-ups to fold in
- **Orphaned-`defId` → starter-sprite leakage** (real, pre-existing latent): `resolvePetDef` (`src/domain/petDef.ts:57`) falls back to the starter on an unknown id, and `deletePet`/`canDelete` (`PetsTab.tsx`) only checks enabled-count, not live `PetInstance` references. If the starter carries a `sprite.default`, an orphaned pet of another element renders the starter's custom art. Fix: **element-guard the fallback sprite** (in `PetSprite`/`spriteSrc`, ignore the override when the resolved `def.element !== pet.species`) **OR** block deleting defs referenced by live instances. Pre-P3a this already gave orphans wrong stats/name; P3a only makes it visible as wrong art.
- **Thread `defId` into `EvolutionCinematic` + `Gacha`** so custom art shows during evolution and gacha reveal (currently species-only element art — `EvolutionCinematic.tsx`, `Gacha.tsx`). Same one-prop pattern as the P3a consumer wiring.
- **One-frame element-art flicker** on `PetSprite` src re-arm (cosmetic, `useEffect`-after-render). Left as-is in P3a; revisit only if it bothers in practice.

## Landmines / heads-ups

- **Storage emulator CORS.** The Storage emulator commonly trips browser CORS when app code fetches `getDownloadURL` results. Budget time for emulator CORS config / a dev proxy — this is the single most likely time sink.
- **`firebase.json` is dirty-by-design** — edit it deliberately, stage explicit files only, **never `git add -A`**.
- **"create" vs existing files.** P3a hit a clobber: a plan step said "create `sprites.test.ts`" but it existed, and the implementer overwrote it (deleting the registry sweep tests; caught in review, restored `9c08c6b`). When a plan says "create" a file, verify it doesn't exist; instruct implementers to APPEND, not overwrite.
- **`src/content/seed.ts` is generated** (`npm run seed:export`) — builtins-only; don't hand-edit.
- **No `PERSIST_VERSION` bump.** `sprite` lives on `PetDef` (Firestore content `content/petDefs`), not the persisted game store (`PERSIST_VERSION = 16`, `src/state/gameStore.ts:109`). `PetInstance` gains nothing.
- **Never-blank invariant.** The `<img onError>` → element-art fallback must survive any UI change; a slow/404 Storage URL must never render broken.
- **Flaky test worker.** Full `npm test` on Windows occasionally throws "Worker exited unexpectedly" (worker-fork crash, non-deterministic) — re-run to confirm; not a real failure.

## Out of scope (P4+)
Gacha pool over the dex; dex tracking (seen/caught); obtainability; course/boss `rewardPetDefId`; evolution **execution** (battle/leveling firing a chain). Structure exists; nothing triggers it yet.

## Dev / test harness (reuse)
- Emulators auth :9099, firestore :8080, **add storage :9199**; `npm run dev:admin` seeds `admin@test.dev` + `{admin:true}`; one-click 🔑 Dev admin sign-in on `/#admin` (DEV-only).
- Verify: `npm test`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`), `npm run build`. Manual smoke: `/#admin` → dev sign-in → Pets tab → open a def → **upload** a sprite file → save → reload persists → the game renders the uploaded art (and falls back to element art when cleared or on a 404).

## Suggested skills for the next session
- `superpowers:brainstorming` — **required first**: lock upload UX, variants-UI scope, Storage path, read access, image processing, cleanup (see "Brainstorm first").
- `superpowers:writing-plans` → `superpowers:subagent-driven-development` — per-task, two-stage review (spec then quality) + final whole-feature review (the P2a/P2b/P3a cadence).
- `accessibility` — the file-upload control (accessible name, upload progress/error via `aria-live`, keyboard-operable, thumbnail alt).
