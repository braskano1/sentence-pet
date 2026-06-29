# Generational Pet Dex P3a — per-`PetDef` sprite override (URL-paste) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin attach a pasted image-URL sprite to a single `PetDef` that overrides the element-based built-in art, with element-art fallback and never-blank rendering.

**Architecture:** A new optional `sprite` field on `PetDef` (`{ default?, variants? }`, future-proofed for a 6-slot set but only `default` surfaced now). `spriteSrc` gains an optional `def` arg and resolves `variants[stage][mood] → default → element art`. `PetSprite` takes an optional `defId`, resolves the def via `resolvePetDef`, and falls back to element art on image `onError`. The admin `PetForm` gets a Sprites fieldset with one URL input + thumbnail + clear. No Firebase Storage (deferred to P3b).

**Tech Stack:** TypeScript, React, framer-motion, Vitest + @testing-library/react, Vite.

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-p3a-sprite-override-design.md`

**Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`). **Stage explicit files only — never `git add -A`** (concurrent sessions; `firebase.json` is dirty-by-design and must stay untouched this phase).

**Verify gates (project conventions):** `npm test`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`), `npm run build`.

---

## File map

- `src/data/types.ts` — add optional `sprite` field to `PetDef` (Task 1).
- `src/content/validate.ts` — add `isHttpUrl` + sprite-URL/`variants.egg` rules in `validatePetDefs` (Task 1).
- `src/config/sprites.ts` — add optional `def` param to `spriteSrc` (Task 2).
- `src/components/PetSprite.tsx` — add optional `defId` prop + `onError` element-art fallback (Task 3).
- `src/components/PetRoom.tsx` — pass `defId={activePet.defId}` (Task 4).
- `src/components/DrillScreen.tsx` + `src/components/drill/DrillPet.tsx` — thread `defId` through (Task 4).
- `src/components/admin/PetsTab.tsx` — add `stripDefault` helper + Sprites fieldset in `PetForm` (Task 5).
- Tests: `src/config/sprites.test.ts` (new), `src/components/PetSprite.test.tsx`, `src/components/admin/PetsTab.test.tsx`.

---

## Task 1: `PetDef.sprite` field + validation

**Files:**
- Modify: `src/data/types.ts` (PetDef interface, ~line 118-131)
- Modify: `src/content/validate.ts` (add `isHttpUrl`; extend `validatePetDefs`, the per-def loop ~line 139-169)
- Test: `src/content/validate.test.ts` (existing — append cases)

- [ ] **Step 1: Write the failing tests**

Append to `src/content/validate.test.ts`. Build a valid base def from the builtins so only the `sprite` field is under test:

```ts
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import { validatePetDefs } from './validate';
import type { PetDef } from '../data/types';

function baseDefs(): PetDef[] {
  return BUILTIN_PET_DEFS.map((d) => ({ ...d }));
}

describe('validatePetDefs — sprite override', () => {
  it('accepts an absent sprite field', () => {
    expect(validatePetDefs(baseDefs()).ok).toBe(true);
  });

  it('accepts a valid https default sprite url', () => {
    const defs = baseDefs();
    defs[0] = { ...defs[0], sprite: { default: 'https://cdn.test/leaf.webp' } };
    expect(validatePetDefs(defs).ok).toBe(true);
  });

  it('rejects a malformed sprite url', () => {
    const defs = baseDefs();
    defs[0] = { ...defs[0], sprite: { default: 'not-a-url' } };
    const res = validatePetDefs(defs);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /valid http/i.test(e))).toBe(true);
  });

  it('rejects an empty-string sprite url', () => {
    const defs = baseDefs();
    defs[0] = { ...defs[0], sprite: { default: '' } };
    expect(validatePetDefs(defs).ok).toBe(false);
  });

  it('rejects variants.egg (egg is never overridable)', () => {
    const defs = baseDefs();
    defs[0] = { ...defs[0], sprite: { variants: { egg: { happy: 'https://cdn.test/e.webp' } } } as PetDef['sprite'] };
    const res = validatePetDefs(defs);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /egg/i.test(e))).toBe(true);
  });

  it('accepts a valid variants entry for a non-egg stage', () => {
    const defs = baseDefs();
    defs[0] = { ...defs[0], sprite: { variants: { adult: { happy: 'https://cdn.test/a.webp' } } } };
    expect(validatePetDefs(defs).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content/validate.test.ts -t "sprite override"`
Expected: FAIL — `sprite` is not a known property of `PetDef` (tsc/type error) and/or the validation rules do not exist.

- [ ] **Step 3: Add the `sprite` field to `PetDef`**

In `src/data/types.ts`, inside `interface PetDef`, after the `enabled: boolean;` line, add:

```ts
  /**
   * Optional custom-art override (P3a). `default` covers ALL stage×mood; `variants`
   * (P3b) overrides per stage×mood, each falling back to `default` then element art.
   * The egg is never overridable. Absent → element art.
   */
  sprite?: {
    default?: string;
    variants?: Partial<Record<PetStage, Partial<Record<PetMood, string>>>>;
  };
```

(`PetStage` and `PetMood` are declared in this same module — forward references within a module are fine.)

- [ ] **Step 4: Add `isHttpUrl` + the sprite rules to `validatePetDefs`**

In `src/content/validate.ts`, add this helper just above `validatePetDefs` (after the `PETDEF_STAT_KEYS` const, ~line 126):

```ts
/** True only for a non-empty, parseable http(s) URL string. */
function isHttpUrl(s: unknown): boolean {
  if (typeof s !== 'string' || s.trim() === '') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
```

Then, inside the `for (const d of defs)` loop, just before the closing `}` of that loop (after the `evolutionStage` check at ~line 168), add:

```ts
    if (d.sprite) {
      const urls: string[] = [];
      if (d.sprite.default !== undefined) urls.push(d.sprite.default);
      if (d.sprite.variants) {
        if ('egg' in d.sprite.variants) push(`pet-def ${d.id} sprite.variants.egg is not allowed (egg is never overridable)`);
        for (const [stage, byMood] of Object.entries(d.sprite.variants)) {
          if (stage === 'egg') continue; // already reported above
          for (const url of Object.values(byMood ?? {})) if (url !== undefined) urls.push(url as string);
        }
      }
      for (const u of urls) if (!isHttpUrl(u)) push(`pet-def ${d.id} sprite url is not a valid http(s) URL: ${String(u)}`);
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/content/validate.test.ts -t "sprite override"`
Expected: PASS (6 tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(petdef): add optional sprite override field + validation"
```

---

## Task 2: Resolver override in `spriteSrc`

**Files:**
- Modify: `src/config/sprites.ts:67-69`
- Test: `src/config/sprites.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/config/sprites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spriteSrc, SPRITES, EGG_SPRITE } from './sprites';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import type { PetDef } from '../data/types';

const leafDef = BUILTIN_PET_DEFS.find((d) => d.element === 'leaf')!;

describe('spriteSrc — override resolution', () => {
  it('returns element art when no def is passed', () => {
    expect(spriteSrc('leaf', 'adult', 'happy')).toBe(SPRITES.leaf.adult.happy);
  });

  it('returns element art when def has no sprite override', () => {
    expect(spriteSrc('leaf', 'adult', 'happy', leafDef)).toBe(SPRITES.leaf.adult.happy);
  });

  it('uses sprite.default for every non-egg stage/mood', () => {
    const def: PetDef = { ...leafDef, sprite: { default: 'https://cdn.test/d.webp' } };
    expect(spriteSrc('leaf', 'baby', 'happy', def)).toBe('https://cdn.test/d.webp');
    expect(spriteSrc('leaf', 'adult', 'sad', def)).toBe('https://cdn.test/d.webp');
  });

  it('prefers a matching variant over default', () => {
    const def: PetDef = {
      ...leafDef,
      sprite: { default: 'https://cdn.test/d.webp', variants: { adult: { happy: 'https://cdn.test/ah.webp' } } },
    };
    expect(spriteSrc('leaf', 'adult', 'happy', def)).toBe('https://cdn.test/ah.webp');
    // a stage/mood without a variant still falls to default
    expect(spriteSrc('leaf', 'baby', 'happy', def)).toBe('https://cdn.test/d.webp');
  });

  it('always returns the generic egg, ignoring any override', () => {
    const def: PetDef = { ...leafDef, sprite: { default: 'https://cdn.test/d.webp' } };
    expect(spriteSrc('leaf', 'egg', 'happy', def)).toBe(EGG_SPRITE);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/config/sprites.test.ts`
Expected: FAIL — `spriteSrc` does not accept a 4th argument / ignores the override.

- [ ] **Step 3: Add the `def` param to `spriteSrc`**

In `src/config/sprites.ts`, replace the `spriteSrc` function (lines 66-69) with:

```ts
import type { PetDef } from '../data/types';
// ^ add PetDef to the existing top-of-file type import line:
//   import type { PetMood, PetStage, Species } from '../data/types';
// becomes:
//   import type { PetDef, PetMood, PetStage, Species } from '../data/types';

/** Single source of truth for resolving a pet's artwork. Egg is generic and never
 *  overridable. With a `def`, a sprite override resolves variant → default → element art. */
export function spriteSrc(species: Species, stage: PetStage, mood: PetMood, def?: PetDef): string {
  if (stage === 'egg') return EGG_SPRITE;
  return def?.sprite?.variants?.[stage]?.[mood] ?? def?.sprite?.default ?? SPRITES[species][stage][mood];
}
```

(Apply the import change to the existing line 1, do not add a duplicate import.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config/sprites.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/sprites.ts src/config/sprites.test.ts
git commit -m "feat(sprites): spriteSrc resolves PetDef sprite override with element fallback"
```

---

## Task 3: `PetSprite` `defId` prop + runtime `onError` fallback

**Files:**
- Modify: `src/components/PetSprite.tsx`
- Test: `src/components/PetSprite.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/components/PetSprite.test.tsx` (top-of-file imports may need `setActivePetDefs`, `BUILTIN_PET_DEFS`, `fireEvent`, `SPRITES` — add any missing):

```ts
import { fireEvent } from '@testing-library/react';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';
import { SPRITES } from '../config/sprites';
import type { PetDef } from '../data/types';

describe('PetSprite — sprite override', () => {
  afterEach(() => setActivePetDefs([...BUILTIN_PET_DEFS]));

  it('renders the override sprite when defId resolves to a def with sprite.default', () => {
    const def: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/x.webp' } };
    setActivePetDefs([def, ...BUILTIN_PET_DEFS.slice(1)]);
    render(<PetSprite stage="adult" species="leaf" happiness={80} defId={def.id} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/x.webp');
  });

  it('falls back to element art when the override image errors', () => {
    const def: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/broken.webp' } };
    setActivePetDefs([def, ...BUILTIN_PET_DEFS.slice(1)]);
    render(<PetSprite stage="adult" species="leaf" happiness={80} defId={def.id} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', SPRITES.leaf.adult.happy);
  });

  it('renders element art when no defId is given (unchanged behavior)', () => {
    render(<PetSprite stage="adult" species="leaf" happiness={80} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', SPRITES.leaf.adult.happy);
  });
});
```

(If `afterEach` isn't already imported from `vitest` in this file, add it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/PetSprite.test.tsx -t "sprite override"`
Expected: FAIL — `PetSprite` has no `defId` prop and no error fallback.

- [ ] **Step 3: Implement the prop + fallback**

Edit `src/components/PetSprite.tsx`:

1. Update the React import to include `useState`:
```ts
import { useEffect, useRef, useState } from 'react';
```
2. Add imports:
```ts
import { resolvePetDef } from '../domain/petDef';
```
3. Add `defId` to the prop type and destructuring:
```ts
export function PetSprite({
  stage,
  species,
  happiness,
  feedTrigger = 0,
  defId,
}: {
  stage: PetStage;
  species: Species;
  happiness: number;
  feedTrigger?: number;
  defId?: string;
}) {
```
4. Replace the mood/src derivation block (the current lines 45-48) with:
```ts
  const mood = moodFor(happiness, GAME_CONFIG.happiness.max);
  const isEgg = stage === 'egg';
  const def = defId ? resolvePetDef(defId) : undefined;
  const primary = spriteSrc(species, stage, mood, def);
  const elementArt = spriteSrc(species, stage, mood); // override-free fallback
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [primary]); // re-arm when the chosen src changes
  const src = errored ? elementArt : primary;
  const alt = isEgg ? 'pet-egg' : `pet-${species}-${stage}-${mood}`;
```
5. Add `onError` to the `<motion.img>`:
```tsx
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        onError={() => setErrored(true)}
        className="h-[clamp(6rem,26vh,12rem)] w-auto object-contain"
        animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/PetSprite.test.tsx`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/PetSprite.tsx src/components/PetSprite.test.tsx
git commit -m "feat(PetSprite): defId-driven sprite override with onError element fallback"
```

---

## Task 4: Thread `defId` through live consumers

**Files:**
- Modify: `src/components/PetRoom.tsx:109`
- Modify: `src/components/drill/DrillPet.tsx` (props + PetSprite call)
- Modify: `src/components/DrillScreen.tsx:176`

No new test file — existing `PetRoom`/`DrillPet`/`DrillScreen` tests must keep passing; this wires the already-tested prop.

- [ ] **Step 1: Wire `PetRoom`**

In `src/components/PetRoom.tsx`, the `<PetSprite>` at line 109 — add `defId={activePet.defId}`:

```tsx
            <PetSprite stage={stage} species={activePet.species} happiness={activePet.happiness} feedTrigger={feedTrigger} defId={activePet.defId} />
```

- [ ] **Step 2: Add `defId` passthrough to `DrillPet`**

In `src/components/drill/DrillPet.tsx`, add `defId` to the props type and the `<PetSprite>` call:

```tsx
export function DrillPet({
  species, stage, happiness, reaction, line, defId,
}: {
  species: Species; stage: PetStage; happiness: number; reaction: PetReaction; line: string; defId?: string;
}) {
```
and:
```tsx
        <PetSprite species={species} stage={stage} happiness={happiness} feedTrigger={bounce} defId={defId} />
```

- [ ] **Step 3: Wire `DrillScreen`**

In `src/components/DrillScreen.tsx`, the `<DrillPet>` at line 176 — add `defId={pet.defId}`:

```tsx
        <DrillPet species={pet.species} stage={stage} happiness={pet.happiness} reaction={reaction} line={line} defId={pet.defId} />
```

- [ ] **Step 4: Run the affected suites + type-check**

Run: `npx vitest run src/components/PetRoom.test.tsx src/components/drill/DrillPet.test.tsx src/components/DrillScreen.test.tsx && npx tsc -b`
Expected: PASS / clean. (If a named test file does not exist, run `npx vitest run src/components` and confirm green.)

- [ ] **Step 5: Commit**

```bash
git add src/components/PetRoom.tsx src/components/drill/DrillPet.tsx src/components/DrillScreen.tsx
git commit -m "feat: thread PetInstance defId into PetSprite at live call sites"
```

---

## Task 5: Sprites fieldset in admin `PetForm` (URL paste + thumbnail + clear)

**Files:**
- Modify: `src/components/admin/PetsTab.tsx` (add `stripDefault` helper; add a fieldset in `PetForm`, after the evolution fieldset ~line 253)
- Test: `src/components/admin/PetsTab.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/components/admin/PetsTab.test.tsx`. The leaf builtin is named `Leaflet` (so its Edit button is `edit Leaflet`):

```ts
describe('PetsTab — sprite override field', () => {
  it('typing a URL shows a preview, and Clear removes the override', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
    const input = screen.getByLabelText(/image url/i);
    fireEvent.change(input, { target: { value: 'https://cdn.test/leaf.webp' } });
    expect(screen.getByAltText(/custom sprite preview/i)).toHaveAttribute('src', 'https://cdn.test/leaf.webp');
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(screen.queryByAltText(/custom sprite preview/i)).not.toBeInTheDocument();
  });

  it('a malformed sprite URL disables Save', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: 'not-a-url' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('a valid sprite URL persists through Save', async () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: 'https://cdn.test/leaf.webp' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.sprite?.default).toBe('https://cdn.test/leaf.webp');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "sprite override field"`
Expected: FAIL — no image URL input / preview / clear button exists yet.

- [ ] **Step 3: Add the `stripDefault` helper**

In `src/components/admin/PetsTab.tsx`, add near the other module-level helpers (after `setRarityBand`, ~line 18):

```ts
/** Remove `default` from a sprite override; collapse to undefined when nothing remains. */
export function stripDefault(sprite: PetDef['sprite']): PetDef['sprite'] {
  if (!sprite) return undefined;
  const { default: _omit, ...rest } = sprite;
  return rest.variants ? rest : undefined;
}
```

- [ ] **Step 4: Add the Sprites fieldset to `PetForm`**

In `PetForm`, after the evolution `</fieldset>` (~line 253) and before the closing `</div>`, add:

```tsx
      <fieldset className="border p-2 flex flex-col gap-1"><legend>sprite (custom art override)</legend>
        <label>image URL
          <input className="border px-1 ml-1 w-full" value={def.sprite?.default ?? ''}
            placeholder="https://… (overrides element art; leave blank to use element art)"
            onChange={(e) => {
              const v = e.target.value.trim();
              onPatch({ sprite: v ? { ...def.sprite, default: v } : stripDefault(def.sprite) });
            }} />
        </label>
        {def.sprite?.default && (
          <div className="flex items-center gap-2">
            <img src={def.sprite.default} alt={`${def.name} custom sprite preview`}
              className="h-12 w-12 object-contain border"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
            <button type="button" onClick={() => onPatch({ sprite: stripDefault(def.sprite) })}
              className="text-red-600">Clear</button>
          </div>
        )}
      </fieldset>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "sprite override field"`
Expected: PASS (3 tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetForm sprite URL-paste field with preview + clear"
```

---

## Task 6: Whole-feature verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green (existing suite + the new sprite tests).

- [ ] **Step 2: Type gate**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (emulator)**

Start the dev-admin harness (`npm run dev:admin`), then in the browser:
1. `/#admin` → 🔑 Dev admin sign-in → Pets tab.
2. Edit a def → paste an image URL into **image URL** → confirm the thumbnail shows → Save (`saved ✓`).
3. Reload → re-open the def → the URL persisted.
4. Play the game with that creature active (PetRoom + a drill) → the pasted art renders.
5. Clear the URL → Save → the game falls back to element art.
6. Paste a deliberately broken URL (e.g. `https://cdn.test/404.webp`) → Save → in-game the sprite falls back to element art (never blank).

- [ ] **Step 5: Confirm `firebase.json` was never staged**

Run: `git status -s`
Expected: `firebase.json` may still show ` M` (dirty-by-design) — it must NOT appear in any commit from this plan. No `git add -A` was used.

---

## Self-review notes

- **Spec coverage:** data shape (T1) ✓; validation incl. `variants.egg` reject (T1) ✓; resolver override+fallback (T2) ✓; `PetSprite` defId + onError never-blank (T3) ✓; consumer threading (T4) ✓; URL-paste UI + thumbnail + clear + Save-gate (T5) ✓; tests across all (T1-5) ✓; verify gates (T6) ✓. Storage / 6-slot variants UI = explicitly out of scope (P3b).
- **Type consistency:** `sprite?: { default?: string; variants?: Partial<Record<PetStage, Partial<Record<PetMood, string>>>> }` used identically in types, validate, resolver, and `stripDefault`. `spriteSrc(species, stage, mood, def?)` signature matches all call sites (3-arg legacy calls remain valid). `defId?: string` prop name consistent across `PetSprite`, `DrillPet`, and both call sites.
- **No placeholders:** every code step shows complete code; every run step gives a command + expected result.
