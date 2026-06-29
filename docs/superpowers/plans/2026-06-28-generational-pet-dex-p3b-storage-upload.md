# Generational Pet Dex P3b — Storage Sprite Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the P3a URL-paste field with real Firebase Storage file uploads for all 7 PetDef sprite slots (1 default + 6 variants), and fix the orphaned-defId sprite-leak bug.

**Architecture:** New `src/firebase/storage.ts` (mirrors `db.ts`) exposes `storage` + an `uploadSprite(defId, slot, file)` helper that uploads raw to `petDefs/{defId}/{slot}.{ext}` and returns the download URL. The admin `PetForm` Sprites fieldset becomes 7 file-picker controls that call `uploadSprite` then write the returned URL into `PetDef.sprite` via the unchanged save path. A central guard in `spriteSrc` ignores an override when the def's element doesn't match the pet's species (fixes the orphan leak). Storage rules grant public read / admin write.

**Tech Stack:** React + TypeScript + Vite, Firebase v12.15.0 (`firebase/storage`), Vitest + Testing Library, Firebase emulators (auth/firestore/storage).

**Repo:** `D:/ai_projects/AI_design_thinking/sentence-pet`, branch `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`). **Never `git add -A`** — stage explicit files only (concurrent-session hazard).

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-p3b-storage-upload-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/firebase/storage.ts` | Storage singleton + emulator connect + `uploadSprite` helper + `SpriteSlot` type | Create |
| `src/firebase/storage.test.ts` | Unit tests for `uploadSprite` (mocked `firebase/storage`) | Create |
| `storage.rules` | Public-read / admin-write rules for `petDefs/**` | Create |
| `firebase.json` | Add top-level `storage` block + storage emulator | Modify (already dirty) |
| `package.json` | Add `storage` to the `emulators` script `--only` list | Modify |
| `src/config/sprites.ts` | Element-guard the override in `spriteSrc` | Modify |
| `src/config/sprites.test.ts` | Element-mismatch guard test | Modify (append) |
| `src/components/admin/PetsTab.tsx` | `setVariant`/`clearVariant` helpers + Sprites fieldset rewrite (`SpriteUpload` control) | Modify |
| `src/components/admin/PetsTab.test.tsx` | helper tests + replace the URL-field tests with upload tests | Modify |

---

## Task 1: Storage module + `uploadSprite` helper

**Files:**
- Create: `src/firebase/storage.ts`
- Test: `src/firebase/storage.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/firebase/storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ref = vi.fn((_s: unknown, path: string) => ({ path }));
const uploadBytes = vi.fn().mockResolvedValue(undefined);
const getDownloadURL = vi.fn().mockResolvedValue('https://download/url');
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  connectStorageEmulator: vi.fn(),
  ref: (s: unknown, p: string) => ref(s, p),
  uploadBytes: (...a: unknown[]) => uploadBytes(...a),
  getDownloadURL: (...a: unknown[]) => getDownloadURL(...a),
}));
vi.mock('./app', () => ({ firebaseApp: {} }));

import { uploadSprite } from './storage';

beforeEach(() => { ref.mockClear(); uploadBytes.mockClear(); getDownloadURL.mockClear(); });

describe('uploadSprite', () => {
  it('uploads the default slot to petDefs/{defId}/default.{ext} and returns the download URL', async () => {
    const file = new File(['x'], 'leaf.webp', { type: 'image/webp' });
    const url = await uploadSprite('def-leaf', 'default', file);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-leaf/default.webp');
    expect(uploadBytes).toHaveBeenCalledWith({ path: 'petDefs/def-leaf/default.webp' }, file);
    expect(url).toBe('https://download/url');
  });

  it('uses the stage-mood slot in the path for a variant', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await uploadSprite('def-fire', 'baby-happy', file);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-fire/baby-happy.png');
  });

  it('falls back to the mime subtype, then "img", when the filename has no extension', async () => {
    await uploadSprite('def-x', 'default', new File(['x'], 'noext', { type: 'image/webp' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-x/default.webp');
    await uploadSprite('def-y', 'default', new File(['x'], 'noext', { type: '' }));
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'petDefs/def-y/default.img');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/firebase/storage.test.ts`
Expected: FAIL — `uploadSprite` not exported / module not found.

- [ ] **Step 3: Write minimal implementation** — create `src/firebase/storage.ts`:

```ts
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { PetMood, PetStage } from '../data/types';
import { firebaseApp } from './app';

export const storage = getStorage(firebaseApp);

// Point at the local Storage emulator when explicitly enabled (mirrors db.ts).
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';
  connectStorageEmulator(storage, host, 9199);
}

// Egg is never overridable, so it is never an upload slot.
type SpriteStage = Exclude<PetStage, 'egg'>;
export type SpriteSlot = 'default' | `${SpriteStage}-${PetMood}`;

/** Extension for the object name: filename ext → mime subtype → "img". Cosmetic only (download URL is opaque). */
function extOf(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (fromName) return fromName;
  const fromType = file.type.split('/')[1];
  return fromType || 'img';
}

/** Upload a sprite image raw and return its download URL. Path: petDefs/{defId}/{slot}.{ext}. */
export async function uploadSprite(defId: string, slot: SpriteSlot, file: File): Promise<string> {
  const objRef = ref(storage, `petDefs/${defId}/${slot}.${extOf(file)}`);
  await uploadBytes(objRef, file);
  return getDownloadURL(objRef);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/firebase/storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/firebase/storage.ts src/firebase/storage.test.ts
git commit -m "feat(storage): Firebase Storage module + uploadSprite helper"
```

---

## Task 2: Storage rules + emulator config

**Files:**
- Create: `storage.rules`
- Modify: `firebase.json` (already modified-but-unstaged — the `host: 0.0.0.0` edits)
- Modify: `package.json`

No unit test (config). Verified by `tsc -b` + `build` staying green and the manual emulator smoke in Task 6.

- [ ] **Step 1: Create `storage.rules`** (mirrors the `firestore.rules` isAdmin pattern):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }
    match /petDefs/{defId}/{file=**} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Modify `firebase.json`** — add the top-level `storage` block (sibling of `firestore`) and the `storage` emulator. Final file:

```jsonc
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": { "port": 9099, "host": "0.0.0.0" },
    "firestore": { "port": 8080, "host": "0.0.0.0" },
    "storage": { "port": 9199, "host": "0.0.0.0" },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

(The `host: 0.0.0.0` on auth/firestore is the pre-existing local edit; this commit finalizes it along with the new storage config.)

- [ ] **Step 3: Modify `package.json`** — the `emulators` script. Change:

```json
"emulators": "firebase emulators:start --only auth,firestore",
```
to:
```json
"emulators": "firebase emulators:start --only auth,firestore,storage",
```

- [ ] **Step 4: Verify the type + build gates are unaffected**

Run: `npx tsc -b`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit** (explicit files only — `firebase.json` is staged deliberately, never `git add -A`)

```bash
git add storage.rules firebase.json package.json
git commit -m "chore(storage): add storage.rules + storage emulator config"
```

---

## Task 3: Element-guard the sprite override (orphan-leak fix)

`resolvePetDef` falls back to the starter on an unknown defId; if the starter has a sprite override, an orphaned pet of another element renders the starter's art. Guard centrally in `spriteSrc` so every consumer is covered.

**Files:**
- Modify: `src/config/sprites.ts:68-71` (the `spriteSrc` function)
- Test: `src/config/sprites.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append to `src/config/sprites.test.ts`:

```ts
describe('spriteSrc — element guard (orphaned-defId leak)', () => {
  it('ignores the override when the def element does not match the pet species', () => {
    const leafWithSprite = { ...leafDef, sprite: { default: 'https://cdn.test/leaf-override.webp' } };
    // a fire pet wrongly resolved to a leaf def must still render fire element art
    expect(spriteSrc('fire', 'adult', 'happy', leafWithSprite)).toBe(SPRITES.fire.adult.happy);
  });

  it('still applies the override when the def element matches the species', () => {
    const leafWithSprite = { ...leafDef, sprite: { default: 'https://cdn.test/leaf-override.webp' } };
    expect(spriteSrc('leaf', 'adult', 'happy', leafWithSprite)).toBe('https://cdn.test/leaf-override.webp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/sprites.test.ts -t "element guard"`
Expected: FAIL — first test returns the override URL instead of fire element art.

- [ ] **Step 3: Implement** — replace `spriteSrc` in `src/config/sprites.ts`:

```ts
export function spriteSrc(species: Species, stage: PetStage, mood: PetMood, def?: PetDef): string {
  if (stage === 'egg') return EGG_SPRITE;
  // Element guard: a def resolved for a different element (e.g. an orphaned defId falling
  // back to the starter) must NOT leak its custom art onto a pet of another species.
  const override = def && def.element === species
    ? def.sprite?.variants?.[stage]?.[mood] ?? def.sprite?.default
    : undefined;
  return override ?? SPRITES[species][stage][mood];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/sprites.test.ts`
Expected: PASS — new guard tests pass and all existing override tests still pass (their defs match the species).

- [ ] **Step 5: Commit**

```bash
git add src/config/sprites.ts src/config/sprites.test.ts
git commit -m "fix(sprites): element-guard override to stop orphaned-defId art leak"
```

---

## Task 4: `setVariant` / `clearVariant` helpers

Pure immutable helpers for the variants map, mirroring the existing `stripDefault` collapse contract.

**Files:**
- Modify: `src/components/admin/PetsTab.tsx` (add the two exported helpers near `stripDefault`)
- Test: `src/components/admin/PetsTab.test.tsx` (append a describe block)

- [ ] **Step 1: Write the failing test** — append to `src/components/admin/PetsTab.test.tsx` (and add `setVariant, clearVariant` to the existing `import { PetsTab, ... } from './PetsTab'` line):

```ts
describe('setVariant / clearVariant', () => {
  it('setVariant creates the variants map and stage cell on an empty sprite', () => {
    expect(setVariant(undefined, 'baby', 'happy', 'https://cdn.test/bh.webp'))
      .toEqual({ variants: { baby: { happy: 'https://cdn.test/bh.webp' } } });
  });

  it('setVariant preserves default and other cells', () => {
    const sprite = { default: 'https://cdn.test/d.webp', variants: { baby: { happy: 'https://cdn.test/bh.webp' } } };
    expect(setVariant(sprite, 'baby', 'sad', 'https://cdn.test/bs.webp')).toEqual({
      default: 'https://cdn.test/d.webp',
      variants: { baby: { happy: 'https://cdn.test/bh.webp', sad: 'https://cdn.test/bs.webp' } },
    });
  });

  it('clearVariant removes the cell and drops an emptied stage', () => {
    const sprite = { variants: { baby: { happy: 'https://cdn.test/bh.webp' }, adult: { sad: 'https://cdn.test/as.webp' } } };
    expect(clearVariant(sprite, 'baby', 'happy'))
      .toEqual({ variants: { adult: { sad: 'https://cdn.test/as.webp' } } });
  });

  it('clearVariant collapses to undefined when nothing remains', () => {
    expect(clearVariant({ variants: { baby: { happy: 'https://cdn.test/bh.webp' } } }, 'baby', 'happy')).toBeUndefined();
  });

  it('clearVariant keeps default when the last variant is removed', () => {
    const sprite = { default: 'https://cdn.test/d.webp', variants: { baby: { happy: 'https://cdn.test/bh.webp' } } };
    expect(clearVariant(sprite, 'baby', 'happy')).toEqual({ default: 'https://cdn.test/d.webp' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "setVariant / clearVariant"`
Expected: FAIL — `setVariant`/`clearVariant` not exported.

- [ ] **Step 3: Implement** — add to `src/components/admin/PetsTab.tsx` directly after `stripDefault` (around line 26):

```ts
type VariantStage = Exclude<PetStage, 'egg'>;

/** Immutably set variants[stage][mood] = url, preserving default and other cells. */
export function setVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood, url: string): PetDef['sprite'] {
  const variants = { ...(sprite?.variants ?? {}) };
  variants[stage] = { ...(variants[stage] ?? {}), [mood]: url };
  return { ...sprite, variants };
}

/** Immutably remove variants[stage][mood]; drop an emptied stage; collapse empties (matches stripDefault). */
export function clearVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood): PetDef['sprite'] {
  if (!sprite?.variants) return sprite;
  const variants = { ...sprite.variants };
  const stageMap = { ...(variants[stage] ?? {}) };
  delete stageMap[mood];
  if (Object.keys(stageMap).length) variants[stage] = stageMap;
  else delete variants[stage];
  const next: NonNullable<PetDef['sprite']> = { ...sprite };
  if (Object.keys(variants).length) next.variants = variants;
  else delete next.variants;
  if (!next.default && !next.variants) return undefined;
  return next;
}
```

Add `PetMood, PetStage` to the existing type import at the top of the file:
```ts
import type { BattleStats, PetDef, PetMood, PetStage, Rarity, Species, StatRange } from '../../data/types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "setVariant / clearVariant"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): setVariant/clearVariant immutable sprite-variant helpers"
```

---

## Task 5: Sprites fieldset rewrite — file-upload controls

Replace the single URL `<input>` with a reusable `SpriteUpload` control: 1 `default` + a 6-cell variants grid. Upload via `uploadSprite`, write the URL via the existing `onPatch`.

**Files:**
- Modify: `src/components/admin/PetsTab.tsx` (the Sprites `<fieldset>` ~lines 262-280; add a `SpriteUpload` component + slot constants)
- Test: `src/components/admin/PetsTab.test.tsx` (replace the `'PetsTab — sprite override field'` describe block)

- [ ] **Step 1: Replace the failing test** — in `src/components/admin/PetsTab.test.tsx`, add the storage mock at the top with the other mocks (after the `content/cache` mock, before the `import { PetsTab ... }` line):

```ts
const uploadSprite = vi.fn().mockResolvedValue('https://download/leaf.webp');
vi.mock('../../firebase/storage', () => ({ uploadSprite: (...a: unknown[]) => uploadSprite(...a) }));
```

Add `uploadSprite.mockClear();` and reset its default resolve inside the top-level `beforeEach`:
```ts
  uploadSprite.mockClear();
  uploadSprite.mockResolvedValue('https://download/leaf.webp');
```

Then DELETE the entire `describe('PetsTab — sprite override field', ...)` block (lines ~187-214) and replace it with:

```ts
describe('PetsTab — sprite upload', () => {
  function openLeaflet() {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
  }
  const webp = () => new File(['x'], 'leaf.webp', { type: 'image/webp' });

  it('uploading a default sprite calls uploadSprite(defId, "default", file) and shows a preview', async () => {
    openLeaflet();
    const input = screen.getByLabelText(/^default sprite$/i);
    fireEvent.change(input, { target: { files: [webp()] } });
    await waitFor(() => expect(uploadSprite).toHaveBeenCalledWith('def-leaf', 'default', expect.any(File)));
    expect(await screen.findByAltText(/default sprite preview/i)).toHaveAttribute('src', 'https://download/leaf.webp');
  });

  it('an uploaded default sprite persists through Save', async () => {
    openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await screen.findByAltText(/default sprite preview/i);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.sprite?.default).toBe('https://download/leaf.webp');
  });

  it('uploading a variant writes sprite.variants[stage][mood]', async () => {
    openLeaflet();
    fireEvent.change(screen.getByLabelText(/^baby happy sprite$/i), { target: { files: [webp()] } });
    await waitFor(() => expect(uploadSprite).toHaveBeenCalledWith('def-leaf', 'baby-happy', expect.any(File)));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.sprite?.variants?.baby?.happy).toBe('https://download/leaf.webp');
  });

  it('a failed upload surfaces an error and leaves the sprite unset', async () => {
    uploadSprite.mockRejectedValueOnce(new Error('network down'));
    openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument();
  });

  it('Clear removes an uploaded default sprite', async () => {
    openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await screen.findByAltText(/default sprite preview/i);
    fireEvent.click(screen.getByRole('button', { name: /clear default sprite/i }));
    expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "sprite upload"`
Expected: FAIL — no `default sprite` file input (still the old URL field).

- [ ] **Step 3: Implement** — in `src/components/admin/PetsTab.tsx`:

(a) Add the import for the upload helper + slot type near the top imports:
```ts
import { uploadSprite, type SpriteSlot } from '../../firebase/storage';
```

(b) Add slot constants near the top (after the existing `STAT_KEYS` const):
```ts
const VARIANT_STAGES: readonly VariantStage[] = ['baby', 'young', 'adult'];
const MOODS: readonly PetMood[] = ['happy', 'sad'];
```

(c) Add the `SpriteUpload` control component (place it just above `function PetForm`):
```tsx
function SpriteUpload({ label, slot, defId, value, onUpload, onClear }: {
  label: string;
  slot: SpriteSlot;
  defId: string;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(file: File) {
    setBusy(true);
    setErr('');
    try {
      onUpload(await uploadSprite(defId, slot, file));
    } catch (e) {
      setErr((e as Error).message || 'upload failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs">{label}
        <input type="file" accept="image/*" className="ml-1 w-40"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
      </label>
      {value && (
        <>
          <img src={value} alt={`${label} preview`} className="h-10 w-10 object-contain border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <button type="button" aria-label={`clear ${label}`} onClick={onClear} className="text-red-600 text-xs">Clear</button>
        </>
      )}
      <span aria-live="polite" className="text-xs text-slate-600">{busy ? 'uploading…' : err ? `⚠ ${err}` : ''}</span>
    </div>
  );
}
```

(d) Replace the entire Sprites `<fieldset>` (the one with legend `sprite (custom art override)`, ~lines 262-280) with:
```tsx
      <fieldset className="border p-2 flex flex-col gap-1"><legend>sprite (custom art override — upload images)</legend>
        <SpriteUpload label="default sprite" slot="default" defId={def.id} value={def.sprite?.default}
          onUpload={(url) => onPatch({ sprite: { ...def.sprite, default: url } })}
          onClear={() => onPatch({ sprite: stripDefault(def.sprite) })} />
        <div className="grid grid-cols-2 gap-x-4">
          {VARIANT_STAGES.map((stage) => MOODS.map((mood) => (
            <SpriteUpload key={`${stage}-${mood}`} label={`${stage} ${mood} sprite`}
              slot={`${stage}-${mood}` as SpriteSlot} defId={def.id}
              value={def.sprite?.variants?.[stage]?.[mood]}
              onUpload={(url) => onPatch({ sprite: setVariant(def.sprite, stage, mood, url) })}
              onClear={() => onPatch({ sprite: clearVariant(def.sprite, stage, mood) })} />
          )))}
        </div>
      </fieldset>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS — the new `sprite upload` block passes and the rest of the file is unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): replace sprite URL field with Storage file-upload controls (default + 6 variants)"
```

---

## Task 6: Full verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green. If "Worker exited unexpectedly" appears (flaky Windows worker-fork crash, non-deterministic), re-run once to confirm — it is not a real failure.

- [ ] **Step 2: Type gate**

Run: `npx tsc -b`
Expected: no errors. (Type gate is `tsc -b`, NOT `--noEmit`.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual emulator smoke**

Run (separate terminals):
- `npm run emulators` (now boots auth + firestore + **storage** on :9199)
- `npm run dev:admin` (seeds `admin@test.dev` + `{admin:true}`)
- `npm run dev`

Then in the browser: `/#admin` → 🔑 Dev admin sign-in → Pets tab → open a def →
- Upload a **default** sprite → preview shows → upload a **baby happy** variant → preview shows.
- Save → reload the page → both uploads persist (preview re-renders from the stored URL).
- The game (PetRoom / Drill) renders the uploaded art for that def's pet.
- Clear the default, or point at a 404 → the sprite falls back to element art (never-blank invariant holds).

⚠️ **Storage emulator CORS:** if `getDownloadURL` images fail to load in the browser with a CORS error, this is the expected emulator landmine — configure emulator CORS / a dev proxy before concluding upload is broken.

- [ ] **Step 5: Whole-feature review** — request a final review of the complete P3b diff (the P2a/P2b/P3a cadence): confirm the never-blank invariant survives the rewrite, the element guard covers every consumer, no `git add -A` crept in, and `firebase.json` staging was deliberate.

---

## Notes / landmines (carried from spec)
- **Never `git add -A`** — `firebase.json` is dirty-by-design; stage explicit files only.
- **`storage.ts` / `storage.rules` are new** — they don't exist; safe to create. For `PetsTab.tsx` / `PetsTab.test.tsx` / `sprites.test.ts`, MODIFY/APPEND — never overwrite (P3a clobbered a test file this way).
- **`src/content/seed.ts` is generated** — don't hand-edit.
- **No `PERSIST_VERSION` bump** — `sprite` lives on `PetDef` (Firestore `content/petDefs`), not the persisted game store.
- **Out of scope:** orphan-object deletion, Evo/Gacha `defId` threading, flicker fix, automated storage-rules test, all P4+ items.
