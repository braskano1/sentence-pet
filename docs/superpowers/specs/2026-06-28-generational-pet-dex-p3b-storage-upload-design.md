# Spec — Generational Pet Dex P3b: Firebase Storage sprite upload

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout at `D:/ai_projects/AI_design_thinking/sentence-pet` (the `H:\` Google-Drive copy holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`).
**Predecessor:** P3a (sprite-override resolver + admin URL-paste UI). Spec `docs/superpowers/specs/2026-06-28-generational-pet-dex-p3a-sprite-override-design.md`; handoff `docs/superpowers/plans/2026-06-28-generational-pet-dex-p3b-storage-upload-handoff.md`.
**Epic spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md`.

## Goal

Replace P3a's URL-paste field with a real Firebase Storage file upload: admin picks an image from disk → uploads → the returned download URL is written into the `PetDef.sprite` override. Surface all 7 sprite slots (1 `default` + 6 `variants`). Firebase Storage is greenfield — no `getStorage` exists yet. Fold in the one P3a review follow-up that is a real latent bug (orphaned-defId sprite leak).

## Locked decisions (from brainstorm)

1. **Upload UX** — fully replace the URL-paste field with a file picker. No paste fallback.
2. **Variants UI** — in scope this phase. Surface all 6 `variants` slots (baby/young/adult × happy/sad) plus `default` = 7 upload controls. Data/validate/resolver already support `variants`; this is UI + uploads only.
3. **Read access** — public read (`allow read: if true`). Sprites aren't secret; `<img>` fetch needs no auth. Write stays admin-claim only.
4. **Image processing** — upload raw, as-is. No client resize/transcode.
5. **Storage path** — `petDefs/{defId}/default.{ext}` and `petDefs/{defId}/{stage}-{mood}.{ext}`. Per-def folder; rules match `petDefs/{defId}/{file=**}`.
6. **Orphan cleanup** — leave orphans. Don't delete old objects on clear/replace/delete. Storage is cheap; orphans are harmless.
7. **P3a follow-ups** — fold in the **element-guard fallback** only. Defer Evo/Gacha `defId` threading and the one-frame flicker.

## Components

### 1. `src/firebase/storage.ts` (NEW)
Mirror `src/firebase/db.ts` exactly:
```ts
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { firebaseApp } from './app';

export const storage = getStorage(firebaseApp);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  connectStorageEmulator(storage, host, 9199);
}
```
`firebase` dep is v12.15.0 — `firebase/storage` is available, no install. `storageBucket` comes from `VITE_FIREBASE_STORAGE_BUCKET` (already in `app.ts`). Port 9199 hardcoded, matching the firestore-8080 convention.

Upload helper (same module):
```ts
// SpriteStage = Exclude<PetStage, 'egg'> (egg is never overridable) — reuse from sprites.ts.
export type SpriteSlot = 'default' | `${SpriteStage}-${PetMood}`;

/** Upload a sprite image and return its download URL. Path: petDefs/{defId}/{slot}.{ext}. */
export async function uploadSprite(defId: string, slot: SpriteSlot, file: File): Promise<string> {
  const ext = extOf(file);                       // from file.name, fallback file.type, fallback 'img'
  const objRef = ref(storage, `petDefs/${defId}/${slot}.${ext}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}
```
`slot` is `'default'` for the catch-all, or `` `${stage}-${mood}` `` (e.g. `baby-happy`) for a variant. Egg is never a slot (never overridable). The download URL is opaque; ext is for object-name readability only. Re-uploading the same slot+ext overwrites; a different ext leaves an orphan (acceptable per decision 6).

### 2. `storage.rules` (NEW)
Mirror `firestore.rules` isAdmin pattern:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() { return request.auth != null && request.auth.token.admin == true; }
    match /petDefs/{defId}/{file=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

### 3. `firebase.json`
Add a top-level `"storage"` block (sibling of `"firestore"`) and a `storage` emulator entry. The file is **intentionally modified-but-unstaged** (the `host: 0.0.0.0` additions). Edit deliberately and stage `firebase.json` **explicitly** — never `git add -A` (concurrent-session contamination hazard). New emulator entry uses `host: 0.0.0.0` to match the existing ones.
```jsonc
{
  "firestore": { "rules": "firestore.rules" },
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "auth": { "port": 9099, "host": "0.0.0.0" },
    "firestore": { "port": 8080, "host": "0.0.0.0" },
    "storage": { "port": 9199, "host": "0.0.0.0" },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

### 4. `package.json`
`emulators` script: `firebase emulators:start --only auth,firestore` → `--only auth,firestore,storage`.

### 5. PetForm Sprites fieldset (rewrite in `src/components/admin/PetsTab.tsx`)
Replace the single URL `<input>` with 7 file-upload controls: 1 `default` + a 6-cell grid of variants (rows baby/young/adult × cols happy/sad).

Each control:
- `<input type="file" accept="image/*">` (labelled, keyboard-operable).
- On select: set per-slot `uploading` state → `await uploadSprite(def.id, slot, file)` → on success write the URL via `onPatch`; on failure set a per-slot error.
- Thumbnail (`<img>` with `onError` hide, alt text) + **Clear** button when the slot has a value.
- Status surfaced via `aria-live="polite"` (uploading… / error message).

Patch wiring (immutable):
- `default` → `onPatch({ sprite: { ...def.sprite, default: url } })`.
- variant → `onPatch({ sprite: setVariant(def.sprite, stage, mood, url) })`.
- clear default → `onPatch({ sprite: stripDefault(def.sprite) })` (existing helper).
- clear variant → `onPatch({ sprite: clearVariant(def.sprite, stage, mood) })`.

New exported pure helpers in `PetsTab.tsx`:
- `setVariant(sprite, stage, mood, url)` — immutably set `variants[stage][mood]`.
- `clearVariant(sprite, stage, mood)` — remove that cell; drop an emptied stage map; collapse `variants`→undefined when empty; collapse whole `sprite`→undefined when neither `default` nor `variants` remain (same collapse contract as `stripDefault`).

`def.id` keys the upload path. Renaming a def after upload orphans the old objects (acceptable). Uploads use the current draft `def.id`; the value persists through the unchanged Save path (`savePetDefs` → `setActivePetDefs` + `writePetDefsCache`, registry swap after save).

### 6. Element-guard fallback (P3a follow-up — real latent bug)
`resolvePetDef` falls back to the **starter** def on an unknown `defId`. If the starter carries a `sprite` override, an orphaned pet of a *different* element renders the starter's custom art (and pre-P3a already showed wrong name/stats). Fix centrally in `spriteSrc` (`src/config/sprites.ts`), the shared source of truth, so every consumer (PetRoom, Drill, and future Evo/Gacha) is covered by one guard:

```ts
export function spriteSrc(species, stage, mood, def?) {
  if (stage === 'egg') return EGG_SPRITE;
  const override = def && def.element === species
    ? def.sprite?.variants?.[stage]?.[mood] ?? def.sprite?.default
    : undefined;
  return override ?? SPRITES[species][stage][mood];
}
```
When `def.element !== species` the override is ignored and element art for the pet's actual species renders. Egg short-circuit unchanged. `PetSprite` keeps passing the resolved `def`; no consumer change needed.

## Validation / types
No type change. `PetDef.sprite` already permits `default` + `variants` (`src/data/types.ts:136`). Keep the `validatePetDefs` runtime guard (`isHttpUrl`, rejects `variants.egg`) — content loads untyped from Firestore; Storage download URLs are https and already pass.

## Testing
Mock the storage module the way `PetsTab.test.tsx` mocks `savePetDefs`/`writePetDefsCache` (`vi.mock`). New/extended tests:
- **Upload (default):** selecting a file calls `uploadSprite(def.id, 'default', file)`; the resolved URL is written into the draft's `sprite.default`.
- **Upload (variant):** selecting a file for a variant cell writes `sprite.variants[stage][mood]` via `setVariant`.
- **Save persists:** Save calls `savePetDefs` with the uploaded URL present.
- **Error path:** a rejected upload leaves the slot value unchanged and surfaces an error (aria-live).
- **Clear collapse:** `clearVariant` removes a cell, drops an emptied stage, collapses `variants`→undefined, collapses `sprite`→undefined when nothing remains. Pure-function unit tests.
- **Element guard:** `spriteSrc('fire', 'baby', 'happy', leafDefWithSprite)` returns fire element art (override ignored on element mismatch); matching element still returns the override.

Resolver/render override behavior for the matching-element case is already covered by P3a tests.

Watch the **flaky Windows test worker** ("Worker exited unexpectedly") — non-deterministic worker-fork crash, re-run to confirm; not a real failure.

## Verification gate
- `npm test` (re-run on a worker-crash).
- `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`).
- `npm run build`.
- Manual smoke: `npm run emulators` (now includes storage) → `npm run dev:admin` → `/#admin` → 🔑 Dev admin sign-in → Pets tab → open a def → upload a `default` sprite and a variant → Save → reload (persists) → game renders the uploaded art → clearing or a 404 URL falls back to element art (never-blank invariant holds).

## Landmines
- **Storage emulator CORS** — the single most likely time sink. The emulator commonly trips browser CORS on `getDownloadURL` fetches. Budget time for emulator CORS config / dev proxy.
- **`firebase.json` dirty-by-design** — stage explicit files only; never `git add -A`.
- **"create" vs existing** — `storage.ts` and `storage.rules` are new; verify they don't exist before writing. When editing `PetsTab.tsx`/`PetsTab.test.tsx`, APPEND/modify — never overwrite (P3a clobbered a test file this way).
- **`src/content/seed.ts` is generated** (`npm run seed:export`) — don't hand-edit.
- **No `PERSIST_VERSION` bump** — `sprite` lives on `PetDef` (Firestore `content/petDefs`), not the persisted game store. `PetInstance` gains nothing.
- **Never-blank invariant** — the `<img onError>` → element-art fallback must survive the UI rewrite; a slow/404 Storage URL must never render broken.

## Out of scope
- Orphaned-object deletion (leave orphans).
- Evo/Gacha `defId` threading (custom art during evolution/reveal) — deferred follow-up.
- One-frame element-art flicker on `PetSprite` src re-arm (cosmetic).
- Automated storage-rules test. Mirror the `firestore.rules` admin pattern for correctness; the existing `test:rules` (`src/firebase/rules.test.ts`, firestore via `emulators:exec`) is the template if added later. Manual verify for now.
- P4+: gacha pool over the dex, dex tracking, obtainability, course/boss `rewardPetDefId`, evolution execution.
