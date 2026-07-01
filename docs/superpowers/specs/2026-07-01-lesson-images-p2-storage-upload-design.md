# Lesson Images P2 — Firebase Storage upload UI (design)

Date: 2026-07-01
Branch: `lesson-images-p2` (off main `fee24a4`)
Predecessor: P1 (merged `fee24a4`) — optional images on `FlashcardItem` / `MatchingPair`, admin **URL text fields**, display on flashcard back + matching tiles/slots with `<img onError>` text fallback, `validate.ts` empty-string guard. Display-only; grading untouched.

## Mission

Add a real **Firebase Storage upload** workflow (file picker → downscale → upload → store download URL) to the Flashcard and Matching lesson editors, reusing the dex pet-sprite Storage pipeline. The P1 URL text field stays as a manual override/fallback.

## Decisions (locked in brainstorming)

1. **Extract a shared base.** Refactor the existing `SpriteUpload` into a generic, presentational `ImageUpload`. `SpriteUpload` and the new `LessonImageUpload` both consume it. DRY; sprite behavior must stay identical.
2. **Storage path:** `lessonImages/{itemId}/{slot}.{ext}`, where `slot ∈ { image, leftImage, rightImage }`. Item ids already carry a course+unit prefix (`c0u1-fc-1`), so collisions are unlikely and no course/unit threading into `ItemEditor` is needed.
3. **Keep the P1 URL field** alongside the uploader as a manual override.
4. Display + grading untouched (P1 already ships display). No xlsx import (that is P3).

## Components

### `src/components/admin/ImageUpload.tsx` (new, presentational)

Owns: file picker, preview `<img onError>`, Clear button, `busy`/`err` state, the `downscaleSprite` call, and best-effort orphan delete on replace/clear.

Props:

```ts
{
  label: string;
  value?: string;                       // current download URL, if any
  onUpload: (url: string) => void;      // parent stores the new URL
  onClear: () => void;                  // parent strips the URL
  upload: (file: File) => Promise<string>;   // slot-specific upload → download URL
  remove: (url: string) => Promise<void>;    // slot-specific delete (throws; component swallows)
}
```

Behavior (lifted verbatim from `SpriteUpload`):
- `pick(file)`: `busy=true` → `downscaleSprite(file)` → `upload(...)` → `onUpload(url)`; if `prior && prior !== url` best-effort `remove(prior)`. On throw, set `err`.
- `clear()`: capture `prior`, `onClear()` first (immediate UI), then best-effort `remove(prior)`.
- `deleteOrphan(url)`: `try { await remove(url) } catch {}` — a stored-file delete failure never blocks the strip/upload.

### `src/components/admin/petsTab/SpriteUpload.tsx` (refactor → thin wrapper)

Becomes:
```ts
<ImageUpload
  label={label} value={value} onUpload={onUpload} onClear={onClear}
  upload={(file) => uploadSprite(defId, slot, file)}
  remove={deleteSpriteByUrl}
/>
```
Same public props/signature as today (`label, slot, defId, value, onUpload, onClear`) so PetForm consumers are untouched. `downscaleSprite` moves into `ImageUpload`, so SpriteUpload no longer imports it.

### `src/components/admin/LessonImageUpload.tsx` (new, thin wrapper)

```ts
export function LessonImageUpload({ label, itemId, slot, value, onUpload, onClear }: {
  label: string; itemId: string; slot: LessonImageSlot;
  value?: string; onUpload: (url: string) => void; onClear: () => void;
}) {
  return <ImageUpload label={label} value={value} onUpload={onUpload} onClear={onClear}
    upload={(file) => uploadLessonImage(itemId, slot, file)} remove={deleteByUrl} />;
}
```

## Storage layer (`src/firebase/storage.ts`)

Add:
```ts
export type LessonImageSlot = 'image' | 'leftImage' | 'rightImage';

/** Upload a lesson image raw and return its download URL. Path: lessonImages/{itemId}/{slot}.{ext}. */
export async function uploadLessonImage(itemId: string, slot: LessonImageSlot, file: File): Promise<string> {
  const objRef = ref(storage, `lessonImages/${itemId}/${slot}.${extOf(file)}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}
```
(Reuse the existing `extOf`, `ref`, `uploadBytes`, `getDownloadURL`, `storage`.)

`deleteSpriteByUrl` already deletes any object by its download URL (`deleteObject(ref(storage, url))`). Add a neutral alias `export const deleteByUrl = deleteSpriteByUrl;` (or rename with a back-compat re-export) so lesson code reads honestly. Keep the `deleteSpriteByUrl` export — SpriteUpload still uses it.

## storage.rules

Add a sibling match mirroring `petDefs`:
```
match /lessonImages/{itemId}/{file=**} {
  allow read: if true;
  allow write: if isAdmin();
}
```
Extend `src/firebase/storage.rules.test.ts`: an anon read of a `lessonImages/**` path succeeds; a non-admin write is denied; an admin write is allowed. Runs via `npm run test:rules-storage` (storage emulator on :9199).

## ItemEditor wiring (`src/components/admin/ItemEditor.tsx`)

`ItemEditor` already receives the item, so `item.id` is in scope in each form.

- **FlashcardForm** — under the existing `image (url)` `TextInput`, add:
  ```tsx
  <LessonImageUpload label="upload image" itemId={item.id} slot="image"
    value={item.image} onUpload={(url) => set({ image: url })}
    onClear={() => set({ image: undefined })} />
  ```
- **MatchingForm** — per pair, under each existing `left image (url)` / `right image (url)` `TextInput`, add a `LessonImageUpload` with `slot="leftImage"` / `slot="rightImage"`, `itemId={item.id}`, wired to `setPair(i, { leftImage: url })` etc. On clear → `setPair(i, { leftImage: undefined })`.

The P1 URL `TextInput` and caption `Checkbox` stay exactly as they are. Upload just writes into the same field via the same setter.

Note on itemId edits: the slot path is derived from `item.id` at upload time. If an admin renames an item id after uploading, old objects orphan under the previous id — acceptable (best-effort cleanup only fires on replace/clear of the same field). Not worth guarding this phase.

## CORS landmine

- Displaying a Storage **download URL** in an `<img>` needs no CORS.
- The uploader uses the SDK `uploadBytes` (XHR to the Storage REST endpoint) — no CORS config needed against the emulator, and the SDK handles it for the real bucket.
- CORS only bites if we later `fetch()`/canvas-read a stored blob cross-origin. We do not in this phase.
- Emulator: requires `VITE_USE_EMULATOR=true` so `storage.ts` calls `connectStorageEmulator(...:9199)`. Real bucket would need a one-time `gsutil cors set` only for future fetch-reading — out of scope; documented here so P3+ knows.

## Testing

Unit (vitest), keep baseline **1269 passed | 18 skipped** green, add:
- `storage.test.ts` (or existing): `uploadLessonImage` builds path `lessonImages/{itemId}/{slot}.{ext}` and returns the download URL — mock `ref/uploadBytes/getDownloadURL` as the sprite tests do.
- `ImageUpload.test.tsx`: upload → `onUpload(url)` called; clear → `onClear()` + `remove(prior)`; replace with different url → `remove(prior)`; same url → `remove` NOT called; `remove` throw is swallowed (no throw out of the component).
- `storage.rules.test.ts`: lessonImages read (anon ok) + write (admin ok, non-admin denied).

Rules test: `npm run test:rules-storage` (needs storage emulator).
Type + full suite: `npx tsc -b` (0 errors), `npx vitest run`.

Manual smoke: `npm run emulators` (+ `npm run dev:admin` / `set-admin` for the admin claim), open the admin lesson editor, pick a real image for a flashcard/matching field, confirm it uploads, previews, and the download URL lands in the field; reload and confirm persistence; Clear removes it.

## Out of scope (later)

- P3: xlsx import columns for images (Flashcard + Matching adapters), downloadable templates, round-trip drift guard.
- Item-id-rename orphan sweeping; def-delete cascade for lesson images.

## House rules

- Commit only when asked; stage explicit paths (never `git add -A` — concurrent sessions share the tree). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Subagent-driven within a phase: fresh implementer per task + spec-review + quality-review; main runs `tsc` + `vitest` between tasks.
