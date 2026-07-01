# Lesson Images P2 — Firebase Storage Upload UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Firebase Storage upload workflow (file picker → downscale → upload → store download URL) to the Flashcard and Matching lesson editors, reusing the dex pet-sprite Storage pipeline; the P1 URL text field stays as a manual override.

**Architecture:** Extract the existing `SpriteUpload` component's upload/clear/orphan logic into a generic presentational `ImageUpload`. `SpriteUpload` (unchanged public API) and a new `LessonImageUpload` both consume it, each injecting a slot-specific `upload`/`remove` pair. A new `uploadLessonImage(itemId, slot, file)` storage helper writes to `lessonImages/{itemId}/{slot}.{ext}`; `storage.rules` gains a public-read/admin-write `lessonImages/**` match. `ItemEditor` wires a `LessonImageUpload` under each existing image-URL field.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Firebase Storage SDK, `@firebase/rules-unit-testing` (storage emulator :9199).

**Spec:** `docs/superpowers/specs/2026-07-01-lesson-images-p2-storage-upload-design.md`

**Baseline (must stay green):** `npx tsc -b` → 0 errors; `npx vitest run` → **1269 passed | 18 skipped**.

**Branch:** `lesson-images-p2` (already cut, spec committed at `2171cb3`). Work in `D:\ai_projects\AI_design_thinking\sentence-pet` — use Bash with `cd /d/ai_projects/AI_design_thinking/sentence-pet` (the PowerShell tool's cwd resolves to the wrong drive). Concurrency: stage explicit paths only, never `git add -A`.

---

## File Structure

- **Create** `src/components/admin/ImageUpload.tsx` — presentational uploader (file picker, preview, Clear, busy/err state, `downscaleSprite`, best-effort orphan delete). Injected `upload`/`remove` callbacks.
- **Create** `src/components/admin/ImageUpload.test.tsx` — unit tests for the extracted logic.
- **Create** `src/components/admin/LessonImageUpload.tsx` — thin wrapper binding `ImageUpload` to `uploadLessonImage`/`deleteByUrl`.
- **Modify** `src/firebase/storage.ts` — add `LessonImageSlot`, `uploadLessonImage`, `deleteByUrl` alias.
- **Modify** `src/firebase/storage.test.ts` — add `uploadLessonImage` + `deleteByUrl` tests.
- **Modify** `src/components/admin/petsTab/SpriteUpload.tsx` — refactor to thin wrapper over `ImageUpload` (public props unchanged).
- **Modify** `storage.rules` — add `lessonImages/{itemId}/{file=**}` match.
- **Modify** `src/firebase/storage.rules.test.ts` — add lessonImages read/write cases.
- **Modify** `src/components/admin/ItemEditor.tsx` — add `LessonImageUpload` to FlashcardForm + MatchingForm.
- **Modify** `src/components/admin/ItemEditor.test.tsx` — cover the new uploader wiring.

Task order is dependency-first: storage helper → rules → presentational component → SpriteUpload refactor (proves the extraction is behavior-preserving) → LessonImageUpload wrapper → ItemEditor wiring.

---

### Task 1: Storage helper `uploadLessonImage` + `deleteByUrl` alias

**Files:**
- Modify: `src/firebase/storage.ts`
- Test: `src/firebase/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/firebase/storage.test.ts` (the mocks + `beforeEach` at the top already cover these; just add the import and two describe blocks):

Change the import line to:
```ts
import { uploadSprite, deleteSpriteByUrl, uploadLessonImage, deleteByUrl } from './storage';
```

Append at end of file:
```ts
describe('uploadLessonImage', () => {
  it('uploads to lessonImages/{itemId}/{slot}.{ext} and returns the download URL', async () => {
    const file = new File(['x'], 'apple.png', { type: 'image/png' });
    const url = await uploadLessonImage('c0u1-fc-1', 'image', file);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'lessonImages/c0u1-fc-1/image.png');
    expect(uploadBytes).toHaveBeenCalledWith({ path: 'lessonImages/c0u1-fc-1/image.png' }, file);
    expect(url).toBe('https://download/url');
  });

  it('uses the leftImage / rightImage slots in the path', async () => {
    await uploadLessonImage('c0u1-mt-1', 'leftImage', new File(['x'], 'a.webp', { type: 'image/webp' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'lessonImages/c0u1-mt-1/leftImage.webp');
    await uploadLessonImage('c0u1-mt-1', 'rightImage', new File(['x'], 'b.jpg', { type: 'image/jpeg' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'lessonImages/c0u1-mt-1/rightImage.jpg');
  });

  it('falls back to the mime subtype, then "img", when the filename has no extension', async () => {
    await uploadLessonImage('c0u1-fc-2', 'image', new File(['x'], 'noext', { type: 'image/png' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'lessonImages/c0u1-fc-2/image.png');
    await uploadLessonImage('c0u1-fc-3', 'image', new File(['x'], 'noext', { type: '' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'lessonImages/c0u1-fc-3/image.img');
  });
});

describe('deleteByUrl', () => {
  it('is the same delete-by-download-URL helper as deleteSpriteByUrl', async () => {
    expect(deleteByUrl).toBe(deleteSpriteByUrl);
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/lessonImages%2Fc0u1-fc-1%2Fimage.png?alt=media';
    await deleteByUrl(url);
    expect(deleteObject).toHaveBeenCalledWith({ path: url });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/firebase/storage.test.ts`
Expected: FAIL — `uploadLessonImage`/`deleteByUrl` are not exported (import error / undefined).

- [ ] **Step 3: Implement in `src/firebase/storage.ts`**

Append after `deleteSpriteByUrl` (reuse the existing `extOf`, `ref`, `uploadBytes`, `getDownloadURL`, `storage`, `deleteObject`):
```ts
export type LessonImageSlot = 'image' | 'leftImage' | 'rightImage';

/** Upload a lesson image raw and return its download URL. Path: lessonImages/{itemId}/{slot}.{ext}. */
export async function uploadLessonImage(itemId: string, slot: LessonImageSlot, file: File): Promise<string> {
  const objRef = ref(storage, `lessonImages/${itemId}/${slot}.${extOf(file)}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}

/** Neutral alias — lesson code reads honestly. deleteSpriteByUrl already deletes any object by its
 *  download URL, so lesson images reuse it verbatim. Keep the sprite export for SpriteUpload. */
export const deleteByUrl = deleteSpriteByUrl;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/firebase/storage.test.ts`
Expected: PASS (all uploadSprite/deleteSpriteByUrl/uploadLessonImage/deleteByUrl green).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/firebase/storage.ts src/firebase/storage.test.ts
git commit -m "$(cat <<'EOF'
feat(lesson-images): uploadLessonImage storage helper + deleteByUrl alias

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: storage.rules — `lessonImages/**` public-read / admin-write

**Files:**
- Modify: `storage.rules`
- Test: `src/firebase/storage.rules.test.ts`

Note: the rules test suite runs only under the storage emulator (`describe.skip` otherwise), so a plain `npx vitest run` will SKIP it and stay green. Run the live check with `npm run test:rules-storage`.

- [ ] **Step 1: Write the failing rules tests**

In `src/firebase/storage.rules.test.ts`, add a lessonImages path constant under the existing `PATH`:
```ts
const LESSON_PATH = 'lessonImages/c0u1-fc-1/image.png';
```

Add these `it` blocks inside the `run('storage security rules', ...)` describe (after the existing petDefs cases, before the closing `});`):
```ts
  it('an admin can write a lessonImages file', async () => {
    const s = env.authenticatedContext('admin1', { admin: true }).storage();
    await assertSucceeds(uploadBytes(ref(s, LESSON_PATH), bytes, { contentType: 'image/png' }));
  });

  it('a non-admin authed client cannot write a lessonImages file', async () => {
    const s = env.authenticatedContext('user1', {}).storage();
    await assertFails(uploadBytes(ref(s, LESSON_PATH), bytes, { contentType: 'image/png' }));
  });

  it('anyone can read a lessonImages file', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), LESSON_PATH), bytes, { contentType: 'image/png' });
    });
    const anon = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(anon, LESSON_PATH)));
  });
```

- [ ] **Step 2: Run rules tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npm run test:rules-storage`
Expected: FAIL — admin lessonImages write is denied and anon read fails (no matching rule yet → default deny).

- [ ] **Step 3: Add the rule to `storage.rules`**

Insert a sibling match after the `petDefs` block, inside `match /b/{bucket}/o {`:
```
    match /lessonImages/{itemId}/{file=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
```

- [ ] **Step 4: Run rules tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npm run test:rules-storage`
Expected: PASS — all petDefs + lessonImages cases green (the "admin writing outside petDefs/ is denied" case still passes: `other/x.webp` matches no rule).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add storage.rules src/firebase/storage.rules.test.ts
git commit -m "$(cat <<'EOF'
feat(lesson-images): storage.rules lessonImages public-read/admin-write

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ImageUpload` presentational component

**Files:**
- Create: `src/components/admin/ImageUpload.tsx`
- Test: `src/components/admin/ImageUpload.test.tsx`

This lifts `SpriteUpload`'s upload/clear/orphan behavior verbatim, but takes injected `upload`/`remove` callbacks instead of importing `uploadSprite`/`deleteSpriteByUrl`, and owns the `downscaleSprite` call.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/ImageUpload.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// downscaleSprite passes the file through in tests (no canvas in jsdom).
vi.mock('../../firebase/imageTranscode', () => ({
  downscaleSprite: vi.fn(async (f: File) => f),
}));

import { ImageUpload } from './ImageUpload';

function setup(props: Partial<React.ComponentProps<typeof ImageUpload>> = {}) {
  const onUpload = vi.fn();
  const onClear = vi.fn();
  const upload = vi.fn(async (_f: File) => 'https://download/new.png');
  const remove = vi.fn(async (_url: string) => {});
  render(
    <ImageUpload label="upload image" value={undefined}
      onUpload={onUpload} onClear={onClear} upload={upload} remove={remove} {...props} />,
  );
  return { onUpload, onClear, upload, remove };
}

const file = () => new File(['x'], 'a.png', { type: 'image/png' });

function pickFile() {
  const input = screen.getByLabelText('upload image') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file()] } });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ImageUpload', () => {
  it('picks a file, uploads it, and reports the new url', async () => {
    const { onUpload, upload } = setup();
    pickFile();
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('https://download/new.png'));
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('deletes the prior object when replacing with a different url', async () => {
    const { remove } = setup({ value: 'https://download/old.png' });
    pickFile();
    await waitFor(() => expect(remove).toHaveBeenCalledWith('https://download/old.png'));
  });

  it('does NOT delete when the new url equals the prior url', async () => {
    const { remove } = setup({ value: 'https://download/new.png' }); // upload returns this same url
    pickFile();
    await waitFor(() => expect(remove).not.toHaveBeenCalled());
  });

  it('clears the value and best-effort deletes the prior object', async () => {
    const { onClear, remove } = setup({ value: 'https://download/old.png' });
    fireEvent.click(screen.getByRole('button', { name: 'clear upload image' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(remove).toHaveBeenCalledWith('https://download/old.png'));
  });

  it('swallows a remove() rejection (no throw escapes the component)', async () => {
    const remove = vi.fn(async () => { throw new Error('not found'); });
    const onClear = vi.fn();
    render(
      <ImageUpload label="upload image" value="https://download/old.png"
        onUpload={vi.fn()} onClear={onClear} upload={vi.fn(async () => 'https://download/new.png')} remove={remove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'clear upload image' }));
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(remove).toHaveBeenCalled()); // rejection swallowed, test does not error
  });

  it('shows an error message when upload throws', async () => {
    render(
      <ImageUpload label="upload image" value={undefined}
        onUpload={vi.fn()} onClear={vi.fn()}
        upload={vi.fn(async () => { throw new Error('upload failed'); })} remove={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText('upload image') as HTMLInputElement, { target: { files: [file()] } });
    await waitFor(() => expect(screen.getByText(/upload failed/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ImageUpload.test.tsx`
Expected: FAIL — `./ImageUpload` module does not exist.

- [ ] **Step 3: Implement `src/components/admin/ImageUpload.tsx`**

```tsx
import { useState } from 'react';
import { downscaleSprite } from '../../firebase/imageTranscode';
import { Button } from './ui';

/** Presentational image uploader: file picker → downscale → injected upload → onUpload(url),
 *  with a Clear button and best-effort orphan delete on replace/clear. Slot-specific I/O is
 *  injected via `upload`/`remove` so both sprite and lesson-image callers reuse this shell. */
export function ImageUpload({ label, value, onUpload, onClear, upload, remove }: {
  label: string;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
  upload: (file: File) => Promise<string>;
  remove: (url: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Best-effort: a stored-file delete failure must never block the strip/upload; the orphan
  // is harmless and cleanup is non-critical.
  async function deleteOrphan(url: string) {
    try { await remove(url); } catch { /* leave orphan; cleanup is non-critical */ }
  }
  async function pick(file: File) {
    setBusy(true);
    setErr('');
    const prior = value; // the slot's current url, before the upload replaces it
    try {
      const toUpload = await downscaleSprite(file); // shrink oversized images; within-cap passes through untouched
      const url = await upload(toUpload);
      onUpload(url);
      // Replace: if a different file backed this slot, drop the now-orphaned old object.
      // Same-url overwrite (identical path/ext) already replaced the blob — never delete it.
      if (prior && prior !== url) await deleteOrphan(prior);
    } catch (e) {
      setErr((e as Error).message || 'upload failed');
    } finally {
      setBusy(false);
    }
  }
  function clear() {
    const prior = value; // capture before the parent strips it
    onClear(); // strip the url first so the UI updates immediately…
    if (prior) void deleteOrphan(prior); // …then best-effort delete the now-orphaned object
  }
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-700">
        <span>{label}</span>
        <input type="file" accept="image/*" className="w-40 text-xs" aria-invalid={!!err || undefined}
          onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) pick(f); }} />
      </label>
      {value && (
        <>
          <img src={value} alt={`${label} preview`} className="h-10 w-10 rounded border border-slate-200 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <Button variant="danger" aria-label={`clear ${label}`} onClick={clear} className="px-2 py-0.5 text-xs">Clear</Button>
        </>
      )}
      <span aria-live="polite" className="text-xs text-slate-600">{busy ? 'uploading…' : err ? `⚠ ${err}` : ''}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ImageUpload.test.tsx`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ImageUpload.tsx src/components/admin/ImageUpload.test.tsx
git commit -m "$(cat <<'EOF'
feat(lesson-images): extract presentational ImageUpload component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Refactor `SpriteUpload` to a thin `ImageUpload` wrapper

**Files:**
- Modify: `src/components/admin/petsTab/SpriteUpload.tsx`
- Test: `src/components/admin/petsTab/PetForm.test.tsx` (existing — the consumer; must stay green, no edits expected)

Public props (`label, slot, defId, value, onUpload, onClear`) stay identical so `PetForm` is untouched. `downscaleSprite` moves out (now owned by `ImageUpload`), so `SpriteUpload` no longer imports it.

- [ ] **Step 1: Confirm the current consumer tests pass (pre-refactor baseline)**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/petsTab/PetForm.test.tsx`
Expected: PASS (record the count; refactor must not change it).

- [ ] **Step 2: Rewrite `src/components/admin/petsTab/SpriteUpload.tsx`**

```tsx
import { uploadSprite, deleteSpriteByUrl, type SpriteSlot } from '../../../firebase/storage';
import { ImageUpload } from '../ImageUpload';

/** Thin wrapper: binds the generic ImageUpload to the pet-sprite storage slots. */
export function SpriteUpload({ label, slot, defId, value, onUpload, onClear }: {
  label: string;
  slot: SpriteSlot;
  defId: string;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  return (
    <ImageUpload
      label={label}
      value={value}
      onUpload={onUpload}
      onClear={onClear}
      upload={(file) => uploadSprite(defId, slot, file)}
      remove={deleteSpriteByUrl}
    />
  );
}
```

- [ ] **Step 3: Run the consumer + type check to verify behavior preserved**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx vitest run src/components/admin/petsTab/PetForm.test.tsx`
Expected: PASS, same count as Step 1; 0 type errors. (`imageTranscode` import removed from SpriteUpload — no dangling reference.)

- [ ] **Step 4: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/petsTab/SpriteUpload.tsx
git commit -m "$(cat <<'EOF'
refactor(admin): SpriteUpload becomes a thin ImageUpload wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `LessonImageUpload` thin wrapper

**Files:**
- Create: `src/components/admin/LessonImageUpload.tsx`
- Test: `src/components/admin/LessonImageUpload.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/LessonImageUpload.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../firebase/imageTranscode', () => ({ downscaleSprite: vi.fn(async (f: File) => f) }));
const uploadLessonImage = vi.fn(async (_id: string, _slot: string, _f: File) => 'https://download/lesson.png');
const deleteByUrl = vi.fn(async (_url: string) => {});
vi.mock('../../firebase/storage', () => ({
  uploadLessonImage: (...a: unknown[]) => uploadLessonImage(...(a as [string, string, File])),
  deleteByUrl: (...a: unknown[]) => deleteByUrl(...(a as [string])),
}));

import { LessonImageUpload } from './LessonImageUpload';

beforeEach(() => { vi.clearAllMocks(); });

describe('LessonImageUpload', () => {
  it('uploads via uploadLessonImage(itemId, slot, file) and reports the url', async () => {
    const onUpload = vi.fn();
    render(<LessonImageUpload label="upload image" itemId="c0u1-fc-1" slot="image"
      value={undefined} onUpload={onUpload} onClear={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('upload image') as HTMLInputElement,
      { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('https://download/lesson.png'));
    expect(uploadLessonImage).toHaveBeenCalledWith('c0u1-fc-1', 'image', expect.any(File));
  });

  it('clears via deleteByUrl for the leftImage slot', async () => {
    const onClear = vi.fn();
    render(<LessonImageUpload label="upload left" itemId="c0u1-mt-1" slot="leftImage"
      value="https://download/old.png" onUpload={vi.fn()} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'clear upload left' }));
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(deleteByUrl).toHaveBeenCalledWith('https://download/old.png'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/LessonImageUpload.test.tsx`
Expected: FAIL — `./LessonImageUpload` does not exist.

- [ ] **Step 3: Implement `src/components/admin/LessonImageUpload.tsx`**

```tsx
import { uploadLessonImage, deleteByUrl, type LessonImageSlot } from '../../firebase/storage';
import { ImageUpload } from './ImageUpload';

/** Thin wrapper: binds the generic ImageUpload to the lesson-image storage slots
 *  (lessonImages/{itemId}/{slot}.{ext}). */
export function LessonImageUpload({ label, itemId, slot, value, onUpload, onClear }: {
  label: string;
  itemId: string;
  slot: LessonImageSlot;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  return (
    <ImageUpload
      label={label}
      value={value}
      onUpload={onUpload}
      onClear={onClear}
      upload={(file) => uploadLessonImage(itemId, slot, file)}
      remove={deleteByUrl}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/LessonImageUpload.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/LessonImageUpload.tsx src/components/admin/LessonImageUpload.test.tsx
git commit -m "$(cat <<'EOF'
feat(lesson-images): LessonImageUpload wrapper over ImageUpload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire `LessonImageUpload` into `ItemEditor` (Flashcard + Matching)

**Files:**
- Modify: `src/components/admin/ItemEditor.tsx`
- Test: `src/components/admin/ItemEditor.test.tsx`

The P1 URL `TextInput` + caption `Checkbox` stay exactly as-is; the uploader writes into the same field via the same setter. `item.id` is in scope in each form (passed as `item`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/admin/ItemEditor.test.tsx`. Mock the uploader so the test asserts wiring, not Storage. Add near the top of the file (with the other imports/mocks):
```tsx
// Stub the Storage-backed uploader; assert ItemEditor wires item.id + slot + setter into it.
vi.mock('./LessonImageUpload', () => ({
  LessonImageUpload: ({ label, itemId, slot, onUpload }: {
    label: string; itemId: string; slot: string; onUpload: (url: string) => void;
  }) => (
    <button type="button" aria-label={`${label} ${itemId} ${slot}`}
      onClick={() => onUpload(`https://uploaded/${slot}.png`)} />
  ),
}));
```
(If the test file has no `vi` import yet, add `import { vi } from 'vitest';`.)

Add these test cases (adapt the render helper to the file's existing pattern — it renders `<ItemEditor item={...} onChange={onChange} />`):
```tsx
it('wires the flashcard image uploader to item.id + slot "image", storing the returned url', () => {
  const onChange = vi.fn();
  const item = { id: 'c0u1-fc-1', kind: 'flashcard', level: 1, front: 'A', back: 'apple' } as const;
  render(<ItemEditor item={item} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'upload image c0u1-fc-1 image' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://uploaded/image.png' }));
});

it('wires the matching left/right uploaders to item.id + leftImage/rightImage slots', () => {
  const onChange = vi.fn();
  const item = {
    id: 'c0u1-mt-1', kind: 'matching', level: 1,
    pairs: [{ left: 'A', right: 'apple' }],
  } as const;
  render(<ItemEditor item={item} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'upload left image c0u1-mt-1 leftImage' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    pairs: [expect.objectContaining({ leftImage: 'https://uploaded/leftImage.png' })],
  }));
  fireEvent.click(screen.getByRole('button', { name: 'upload right image c0u1-mt-1 rightImage' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    pairs: [expect.objectContaining({ rightImage: 'https://uploaded/rightImage.png' })],
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ItemEditor.test.tsx`
Expected: FAIL — no `LessonImageUpload` rendered (buttons not found).

- [ ] **Step 3: Wire into `src/components/admin/ItemEditor.tsx`**

Add the import at the top (after the `ui` import):
```tsx
import { LessonImageUpload } from './LessonImageUpload';
```

In `FlashcardForm`, directly after the `image caption` `<Checkbox …/>` (the P1 field block), add:
```tsx
      <LessonImageUpload label="upload image" itemId={item.id} slot="image"
        value={item.image} onUpload={(url) => set({ image: url })}
        onClear={() => set({ image: undefined })} />
```

In `MatchingForm`, inside the per-pair second `<div className="flex items-end gap-2">`, after the `right cap` `<Checkbox …/>` (still inside that div), add both uploaders:
```tsx
              <LessonImageUpload label="upload left image" itemId={item.id} slot="leftImage"
                value={p.leftImage} onUpload={(url) => setPair(i, { leftImage: url })}
                onClear={() => setPair(i, { leftImage: undefined })} />
              <LessonImageUpload label="upload right image" itemId={item.id} slot="rightImage"
                value={p.rightImage} onUpload={(url) => setPair(i, { rightImage: url })}
                onClear={() => setPair(i, { rightImage: undefined })} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ItemEditor.test.tsx`
Expected: PASS (new wiring cases + all existing ItemEditor cases green).

- [ ] **Step 5: Full type check + suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx vitest run`
Expected: 0 type errors; **≥ 1269 + new tests passed | 18 skipped** — no regressions.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ItemEditor.tsx src/components/admin/ItemEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(lesson-images): image upload UI in flashcard & matching editors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification (after all tasks)

- [ ] `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b` → 0 errors.
- [ ] `npx vitest run` → all green (baseline 1269 + ~17 new; 18 skipped).
- [ ] `npm run test:rules-storage` → lessonImages rules pass (needs storage emulator).
- [ ] Manual smoke: `npm run emulators` + `npm run dev:admin` / `npm run set-admin`; open the admin lesson editor, pick a real image for a flashcard/matching field → confirm it uploads, previews, and the download URL lands in the field; reload → persists; Clear → removes it.
- [ ] Whole-branch review (`superpowers:requesting-code-review`) before merge.

## Out of scope (P3, later)

- xlsx import columns for images (Flashcard + Matching adapters), downloadable templates, round-trip drift guard.
- Item-id-rename orphan sweeping; def-delete cascade for lesson images.
</content>
</invoke>
