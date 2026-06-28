# Admin Pet-Def Hydration Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin Pets tab edit and save the live pet-def catalog (never the builtins-by-default), eliminating the data-loss-on-Save bug where the admin route never hydrates the registry.

**Architecture:** Seed the pet-def registry from cache on both routes in `main.tsx` (instant no-clobber baseline), and make `PetsTab` block (loading state, editor + Save gated) until a live `hydratePetDefs()` fetch resolves and re-seeds the draft. Save is unreachable until the draft reflects live data.

**Tech Stack:** React + TypeScript + Vite, Firebase, Vitest + Testing Library, Playwright (e2e smoke).

**Repo:** `D:/ai_projects/AI_design_thinking/sentence-pet`, branch `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`). **Never `git add -A`** — stage explicit files only.

**Spec:** `docs/superpowers/specs/2026-06-28-admin-petdef-hydration-fix-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/main.tsx` | App entry: seed pet-def registry from cache on BOTH routes | Modify |
| `src/components/admin/PetsTab.tsx` | Block until live load: loading gate + mount-effect live fetch + re-seed | Modify |
| `src/components/admin/PetsTab.test.tsx` | New gate/re-seed/failure tests + migrate existing tests past the loading gate | Modify |
| `e2e/p3b-sprite-upload-smoke.spec.ts` | Remove the temporary diagnostic block | Modify |
| `playwright.config.ts` | (already env-aware via SMOKE_BASE_URL — commit as-is) | Commit |

---

## Task 1: Seed the registry from cache on both routes (`main.tsx`)

The pet-def registry must have a no-clobber baseline regardless of route. Today the seed + hydrate live inside the player-only `if (!isAdmin)` block.

**Files:**
- Modify: `src/main.tsx` (the `if (!isAdmin) { … }` block, currently lines 21-27)

No unit test — `main.tsx` is the entry module (not unit-testable in isolation). Verified by `tsc -b` + `build` here and the e2e smoke in Task 3.

- [ ] **Step 1: Make the change** — replace the current block:

```ts
const isAdmin = isAdminEntry(window.location.hash)
if (!isAdmin) {
  void hydrateCourse('default') // live fetch the default course → swap + cache; failures keep fallback
  // Seed the pet-def registry from last-good cache (instant), then live-fetch → swap + cache.
  setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])
  void hydratePetDefs()
}
```

with:

```ts
const isAdmin = isAdminEntry(window.location.hash)

// Seed the pet-def registry from last-good cache on BOTH routes (instant, no-clobber baseline).
// Admin's authoritative live-fetch is owned by PetsTab so it can gate Save; the player live-hydrates here.
setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])

if (!isAdmin) {
  void hydrateCourse('default') // live fetch the default course → swap + cache; failures keep fallback
  void hydratePetDefs()         // player live-fetch; swap + cache
}
```

(The imports `cachedPetDefs`, `BUILTIN_PET_DEFS`, `setActivePetDefs`, `hydratePetDefs`, `hydrateCourse` are already present at the top of `main.tsx`.)

- [ ] **Step 2: Verify type + build gates**

Run: `npx tsc -b`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "fix(admin): seed pet-def registry from cache on both routes"
```

---

## Task 2: PetsTab blocks until live load (gate + re-seed)

`PetsTab` must live-fetch on mount, show a loading state, and gate the editor + Save until the fetch resolves and the draft is re-seeded from the live registry. This is the clobber-safety guarantee.

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

### Step-by-step

- [ ] **Step 1: Add the `hydratePetDefs` mock to the test file**

In `src/components/admin/PetsTab.test.tsx`, add this mock alongside the existing `vi.mock` calls (after the `firebase/storage` mock, before the `import { PetsTab … }` line):

```ts
const hydratePetDefs = vi.fn().mockResolvedValue(undefined);
vi.mock('../../content/load', () => ({ hydratePetDefs: () => hydratePetDefs() }));
```

And in the top-level `beforeEach`, add a reset (after the existing `uploadSprite` resets):

```ts
  hydratePetDefs.mockClear();
  hydratePetDefs.mockResolvedValue(undefined);
```

- [ ] **Step 2: Write the failing gate/re-seed tests**

Append a new describe block to `src/components/admin/PetsTab.test.tsx`. (`render`, `screen`, `fireEvent`, `waitFor` are already imported; `BUILTIN_PET_DEFS`, `setActivePetDefs` already imported; add `act` to the `@testing-library/react` import if not present.)

```ts
describe('PetsTab — block until live load', () => {
  it('shows a loading state and no editor until hydratePetDefs resolves', async () => {
    let resolve!: () => void;
    hydratePetDefs.mockReturnValueOnce(new Promise<void>((r) => { resolve = () => r(); }));
    render(<PetsTab />);
    // gated: loading shown, no Add/Save/list yet
    expect(screen.getByText(/loading pets/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add pet/i })).not.toBeInTheDocument();
    resolve();
    expect(await screen.findByRole('button', { name: /add pet/i })).toBeInTheDocument();
  });

  it('calls hydratePetDefs on mount and re-seeds the draft from the live registry', async () => {
    // Live catalog has an extra authored pet absent from the builtins.
    const live = [
      ...BUILTIN_PET_DEFS,
      { ...BUILTIN_PET_DEFS[1], id: 'def-custom', name: 'Custom Mon', dexNo: 5,
        sprite: { default: 'https://cdn.test/custom.webp' } },
    ];
    hydratePetDefs.mockImplementationOnce(async () => { setActivePetDefs(live); });
    render(<PetsTab />);
    expect(hydratePetDefs).toHaveBeenCalledTimes(1);
    // the live-only pet appears once the fetch resolves + re-seeds
    expect(await screen.findByText(/Custom Mon/)).toBeInTheDocument();
  });

  it('still unblocks when hydratePetDefs rejects (offline) — editor renders from the current registry', async () => {
    hydratePetDefs.mockRejectedValueOnce(new Error('offline'));
    render(<PetsTab />);
    // builtins are the current registry; editor renders, Save reachable
    expect(await screen.findByRole('button', { name: /add pet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "block until live load"`
Expected: FAIL — no "loading pets" text; `hydratePetDefs` never called.

- [ ] **Step 4: Implement the gate in `PetsTab.tsx`**

(a) Update the React import to include `useEffect`:
```ts
import { useEffect, useMemo, useState } from 'react';
```

(b) Add the `hydratePetDefs` import near the other content imports:
```ts
import { hydratePetDefs } from '../../content/load';
```
(`getActivePetDefs` is already imported from `../../domain/petDef`.)

(c) Inside `PetsTab`, add the `loaded` state next to the other `useState` calls (after `const [editingId, setEditingId] = useState<string | null>(null);`):
```ts
  const [loaded, setLoaded] = useState(false);
```

(d) Add the mount effect AFTER all existing hooks (after the `validation` useMemo, before the `save` function — effects and other hooks must run unconditionally, before any early return):
```ts
  // Live-fetch the catalog on mount, re-seed the draft, then unblock. Blocking until the
  // fetch resolves means a stale draft can never be saved over the live Firestore catalog.
  useEffect(() => {
    let cancelled = false;
    void hydratePetDefs().finally(() => {
      if (cancelled) return;
      setDraft([...getActivePetDefs()]);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
```

(e) Add the early return AFTER all hooks but BEFORE the main `return (` of the component:
```ts
  if (!loaded) return <p className="p-4 text-sm">loading pets…</p>;
```
Place it immediately before the existing `return (` JSX. All `useState`/`useMemo`/`useEffect` calls must remain above this line so hook order is stable.

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx -t "block until live load"`
Expected: PASS (3 tests).

- [ ] **Step 6: Migrate the existing PetsTab tests past the gate**

Every existing test renders `<PetsTab />` and queries synchronously; the loading gate now defers the editor by one resolved promise, so those queries must wait for it. The `hydratePetDefs` mock (Step 1) resolves immediately, so the gate opens after a microtask.

Apply this mechanical transform to ALL existing tests/helpers in the file that render `<PetsTab />` (the `list + save`, `add / delete / filter`, `edit form`, `evolution UI + validate gate`, and `sprite upload` describe blocks):

- Make every render helper async and await the editor before any further interaction. Representative conversion:

  Before:
  ```ts
  function openFirstEditor() {
    render(<PetsTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /^edit /i })[0]);
  }
  ```
  After:
  ```ts
  async function openFirstEditor() {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i }); // wait past the loading gate
    fireEvent.click(screen.getAllByRole('button', { name: /^edit /i })[0]);
  }
  ```
  Callers: `await openFirstEditor();`.

- For tests that render inline and immediately query, await a stable element first. Representative conversion:

  Before:
  ```ts
  it('lists every active def by name (seeded from getActivePetDefs)', () => {
    render(<PetsTab />);
    for (const d of active()) { /* … */ }
  });
  ```
  After:
  ```ts
  it('lists every active def by name (seeded from getActivePetDefs)', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    for (const d of active()) { /* … */ }
  });
  ```

- The `sprite upload` block's `openLeaflet()` helper: make it async and `await screen.findByRole('button', { name: /add pet/i })` after `render`, before clicking edit.

- Tests that assert Save behavior already use `await waitFor(...)`; just ensure the render is awaited past the gate first.

Rule of thumb: after each `render(<PetsTab />)`, the next line must be `await screen.findByRole('button', { name: /add pet/i });` (or `await screen.findByText(...)` of a known def) before any synchronous `getBy…`. Convert the enclosing `it(...)` callbacks to `async` as needed.

- [ ] **Step 7: Run the FULL PetsTab test file**

Run: `npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: ALL pass (existing migrated + 3 new). If any synchronous-query test still fails with "Unable to find…", it was missed in Step 6 — add the `await screen.findByRole('button', { name: /add pet/i })` after its render.

- [ ] **Step 8: Type gate**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "fix(admin): PetsTab blocks until live pet-def fetch resolves (clobber-safe)"
```

---

## Task 3: Commit the smoke harness + full verification

Clean up the diagnostic, commit the e2e smoke + config, run the full gates, and re-run the live smoke to confirm the bug is fixed.

**Files:**
- Modify: `e2e/p3b-sprite-upload-smoke.spec.ts` (remove the diagnostic block)
- Commit: `playwright.config.ts` (env-aware `SMOKE_BASE_URL`)

- [ ] **Step 1: Remove the diagnostic block** from `e2e/p3b-sprite-upload-smoke.spec.ts` — delete the block between the `// ── DIAGNOSTIC ──` and `// ── END DIAGNOSTIC ──` markers (the `page.evaluate` dump and the three `console.log`s), leaving the `await openLeafletInPets(page);` line and the following `const persisted = …` line intact.

- [ ] **Step 2: Full unit suite**

Run: `npm test`
Expected: all green. If "Worker exited unexpectedly" appears (flaky Windows worker-fork crash, non-deterministic), re-run once to confirm — not a real failure.

- [ ] **Step 3: Type + build gates**

Run: `npx tsc -b`
Expected: no errors.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Re-run the live sprite-upload smoke (the regression that proves the fix)**

Preconditions (all from the earlier smoke run; restart if down):
- Emulators up incl. storage: `npm run emulators` (auth 9099, firestore 8080, storage 9199).
- Admin seeded: `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/p3b-smoke-setup.mjs`.
- Dev server in emulator mode: `VITE_EMULATOR_HOST=127.0.0.1 npm run dev` (note the actual port; use it below).

Run (PowerShell; substitute the dev port, e.g. 5178):
```
$env:RUN_SPRITE_SMOKE='1'; $env:SMOKE_BASE_URL='http://localhost:5178'; npx playwright test e2e/p3b-sprite-upload-smoke.spec.ts
```
Expected: **1 passed**. Step 5 of the spec (reload → re-open admin → default + variant previews persist) now passes — previously it failed because the admin never hydrated the catalog. Watch for the Storage-emulator CORS landmine; previews loaded fine in the prior run.

- [ ] **Step 5: Commit the smoke harness**

```bash
git add e2e/p3b-sprite-upload-smoke.spec.ts playwright.config.ts
git commit -m "test(e2e): P3b sprite-upload smoke + env-aware base URL"
```

---

## Self-review notes (carried)
- **Never `git add -A`** — stage explicit files per step.
- **Hook order:** in `PetsTab`, every `useState`/`useMemo`/`useEffect` must stay above the `if (!loaded) return …` early return.
- **No `PERSIST_VERSION` bump** — registry/cache only, no persisted-store schema change.
- **Out of scope:** course-route admin live hydration (works via store self-seed); moving pet-defs into a reactive store; the pre-existing non-functional `setDraft` in `patch()`.
