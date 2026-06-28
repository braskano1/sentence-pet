# Generational Pet Dex P4a — Dex Tracking + Evolution-Chain Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record obtained `PetDef`s in a persisted caught-set and surface them as a Dex tab in the Collection screen (caught vs silhouette), with a tile-click evolution-chain detail view.

**Architecture:** A persisted accumulating `caughtDefIds: string[]` on the game store (bump `PERSIST_VERSION` 16→17, migration seeds from owned pets, union on every pet-add). A pure `domain/dex.ts` with `addCaught` (union) and `evolutionChain` (walk `evolvesFromId`/`evolvesToId`). Collection.tsx gains a `My Pets | Dex` tab; the Dex renders a grid of all enabled defs (`DexGrid`) and a chain detail (`DexDetail`).

**Tech Stack:** TypeScript, React, Zustand (persist middleware), framer-motion, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-p4a-dex-tracking-design.md`

**Repo / branch:** `D:/ai_projects/AI_design_thinking/sentence-pet`, branch `journey-redesign` (do NOT merge to `main`).

**Global conventions (apply to every task):**
- Stage explicit files in commits — **never `git add -A`**.
- Test files: **append** new `it(...)`/`describe(...)` blocks; never overwrite an existing file's contents.
- Verify-gate before each commit: `npm test` (or the file's test), `npx tsc -b` (NOT `--noEmit`). Run `npm run build` once at the end (Task 5). Flaky Windows "Worker exited unexpectedly" → re-run, not a real failure.
- `src/content/seed.ts` is generated — do not hand-edit (not touched here).

---

## Task 1: Domain helpers — `addCaught` + `evolutionChain`

**Files:**
- Create: `src/domain/dex.ts`
- Test: `src/domain/dex.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/domain/dex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { addCaught, evolutionChain } from './dex';
import type { PetDef } from '../data/types';

/** Minimal PetDef factory for chain tests. */
function def(id: string, over: Partial<PetDef> = {}): PetDef {
  return {
    id,
    name: id,
    gen: 1,
    dexNo: 1,
    types: ['leaf'],
    element: 'leaf',
    statBands: {} as PetDef['statBands'],
    enabled: true,
    ...over,
  };
}

describe('addCaught', () => {
  it('adds a new defId', () => {
    expect(addCaught(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('is a no-op for a defId already present', () => {
    expect(addCaught(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
  it('adds to an empty set', () => {
    expect(addCaught([], 'a')).toEqual(['a']);
  });
});

describe('evolutionChain', () => {
  it('returns a lone def when it has no links', () => {
    const a = def('a');
    expect(evolutionChain(a, [a]).map((d) => d.id)).toEqual(['a']);
  });

  it('walks a linear 3-stage chain from the root', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(evolutionChain(a, [a, b, c]).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('assembles the full chain when starting from the middle', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(evolutionChain(b, [a, b, c]).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not infinite-loop on a cyclic chain (defensive)', () => {
    const a = def('a', { evolvesToId: 'b', evolvesFromId: 'b' });
    const b = def('b', { evolvesToId: 'a', evolvesFromId: 'a' });
    const chain = evolutionChain(a, [a, b]);
    expect(chain.length).toBeLessThanOrEqual(2);
  });

  it('stops at a dangling forward ref', () => {
    const a = def('a', { evolvesToId: 'missing' });
    expect(evolutionChain(a, [a]).map((d) => d.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/dex.test.ts`
Expected: FAIL — `Cannot find module './dex'` / `addCaught is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/dex.ts`:

```ts
import type { PetDef } from '../data/types';

/** Union `defId` into the caught set, preserving order and avoiding duplicates. */
export function addCaught(caught: readonly string[], defId: string): string[] {
  return caught.includes(defId) ? [...caught] : [...caught, defId];
}

/**
 * The ordered evolution chain (def-chain / Axis 2) containing `def`: walk
 * `evolvesFromId` back to the root, then `evolvesToId` forward. Cycle-guarded.
 * A def with no links returns `[def]`. Dangling refs simply terminate the walk.
 */
export function evolutionChain(def: PetDef, defs: readonly PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, d]));

  // Walk back to the root.
  let root = def;
  const seenBack = new Set<string>([root.id]);
  while (root.evolvesFromId) {
    const prev = byId.get(root.evolvesFromId);
    if (!prev || seenBack.has(prev.id)) break; // dangling or cycle
    seenBack.add(prev.id);
    root = prev;
  }

  // Walk forward from the root.
  const chain: PetDef[] = [root];
  const seenFwd = new Set<string>([root.id]);
  let cur = root;
  while (cur.evolvesToId) {
    const next = byId.get(cur.evolvesToId);
    if (!next || seenFwd.has(next.id)) break; // dangling or cycle
    seenFwd.add(next.id);
    chain.push(next);
    cur = next;
  }
  return chain;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/dex.test.ts`
Expected: PASS (all 8).

- [ ] **Step 5: Commit**

```bash
git add src/domain/dex.ts src/domain/dex.test.ts
git commit -m "feat(dex): addCaught + evolutionChain pure helpers"
```

---

## Task 2: Persisted caught-set in the game store

**Files:**
- Modify: `src/state/gameStore.ts` (interface, persisted projection, freshState, version bump, migration, pull/reward union)
- Test: `src/state/gameStore.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/state/gameStore.test.ts` (inside the file, a new `describe`):

```ts
import { addCaught } from '../domain/dex'; // add to existing imports if not present
import { PERSIST_VERSION, selectCaughtSet, useGameStore } from './gameStore'; // merge with existing import

describe('caught dex set', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('freshState seeds the starter as caught', () => {
    const s = useGameStore.getState();
    // starter pet defId is def-leaf
    expect(selectCaughtSet(s).has('def-leaf')).toBe(true);
  });

  it('a gacha pull unions the pulled defId into caughtDefIds', () => {
    useGameStore.getState().addCoinsForTest(1000);
    const before = useGameStore.getState().caughtDefIds.length;
    useGameStore.getState().pullEgg();
    const after = useGameStore.getState();
    // the pulled pet's defId is now caught
    expect(after.caughtDefIds).toContain(after.lastPull!.defId);
    expect(after.caughtDefIds.length).toBeGreaterThanOrEqual(before);
  });

  it('PERSIST_VERSION is 17', () => {
    expect(PERSIST_VERSION).toBe(17);
  });
});
```

> NOTE: if `gameStore.test.ts` already imports `useGameStore`/`PERSIST_VERSION`, merge these names into the existing import line rather than adding a duplicate import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: FAIL — `selectCaughtSet is not exported` / `caughtDefIds` undefined / `PERSIST_VERSION` is 16.

- [ ] **Step 3a: Add the field to `GameState`**

In `src/state/gameStore.ts`, in the `GameState` interface, after the `coins` line (`coins: number; // account-level wallet`) add:

```ts
  /** Def-chain dex: defIds the player has ever obtained. Accumulates; never shrinks. */
  caughtDefIds: string[];
```

- [ ] **Step 3b: Import `addCaught`**

Add to the imports at the top of `gameStore.ts`:

```ts
import { addCaught } from '../domain/dex';
```

- [ ] **Step 3c: Persist the field**

In the `PersistedState` `Pick<...>` union (currently ending `... | 'journey' | 'audio' | 'l1Mode'`), add `| 'caughtDefIds'`.

In `selectPersisted`, add inside the returned object:

```ts
    caughtDefIds: s.caughtDefIds,
```

- [ ] **Step 3d: Seed it in `freshState`**

In `freshState()`'s returned object, after `owned: [] as string[],` add:

```ts
    caughtDefIds: [starterDef().id],
```

(`starterDef` is already imported — `freshPet` uses it.)

- [ ] **Step 3e: Bump the version**

Change `export const PERSIST_VERSION = 16;` to `export const PERSIST_VERSION = 17;`.

- [ ] **Step 3f: Add the selector**

Near the other selectors (e.g. after `selectActivePet`), add:

```ts
/** The caught-dex as a Set for O(1) membership in the UI. */
export const selectCaughtSet = (s: { caughtDefIds: string[] }): Set<string> =>
  new Set(s.caughtDefIds);
```

- [ ] **Step 3g: Migration v16→v17**

In `migrate`, extend the `st` type object with `caughtDefIds?: string[];`. Then, **after** the v15→v16 defId backfill block (the `if (Array.isArray(base.pets)) { base.pets = base.pets.map(... defId ...) }` ending near line 573) and **before** the trailing `delete (base as ...).pet;`, add:

```ts
        // v16->v17: seed the caught-dex from owned pets (key off each pet's defId).
        if (!(base as { caughtDefIds?: string[] }).caughtDefIds) {
          const ids = Array.isArray(base.pets)
            ? (base.pets as PetInstance[]).map((p) => p.defId)
            : [];
          (base as { caughtDefIds?: string[] }).caughtDefIds = Array.from(new Set(ids));
        }
```

Also add a comment line to the version-history block near the other `// vNN->vNN` comments:

```ts
      // v16->v17: seed caughtDefIds (the def-chain dex) from owned pets' defIds.
```

- [ ] **Step 3h: Union on gacha pull**

In `pullEgg`, change the success return (currently
`return { pets: [...s.pets, res.pet], coins: res.coins, lastPull: res.pet };`) to:

```ts
          return {
            pets: [...s.pets, res.pet],
            coins: res.coins,
            lastPull: res.pet,
            caughtDefIds: addCaught(s.caughtDefIds, res.pet.defId),
          };
```

- [ ] **Step 3i: Union on reward egg**

In `finishBoss`'s win branch, the reward-egg block creates `egg` and does `pets = [...pets, egg]; lastPull = egg;` (inside `if (firstClear)`). Add a caught accumulator:

Just before `let lastLevelUp` (near `let pets = s.pets; let lastPull = s.lastPull;`), add:

```ts
          let caughtDefIds = s.caughtDefIds;
```

Inside the `if (firstClear)` block, right after `lastPull = egg;`, add:

```ts
            caughtDefIds = addCaught(caughtDefIds, egg.defId);
```

Then in that branch's returned object (the one with `pets, coins, lastPull, lastLevelUp, ...`), add:

```ts
            caughtDefIds,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: PASS (new 3 + all existing).

Run: `npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(dex): persisted caughtDefIds set, migration v16->v17, union on pull/reward"
```

---

## Task 3: `DexDetail` — evolution-chain detail view

**Files:**
- Create: `src/components/DexDetail.tsx`
- Test: `src/components/DexDetail.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/DexDetail.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

function def(id: string, over: Partial<PetDef> = {}): PetDef {
  return {
    id, name: id, gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, ...over,
  };
}

describe('DexDetail', () => {
  it('renders each def in the chain; caught shows name, uncaught shows ???', () => {
    const a = def('a', { name: 'Alpha', dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { name: 'Beta', dexNo: 2, evolvesFromId: 'a' });
    render(<DexDetail def={a} defs={[a, b]} caught={new Set(['a'])} onClose={() => {}} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument(); // caught
    expect(screen.getAllByText('???').length).toBeGreaterThan(0); // uncaught Beta
  });

  it('calls onClose when the close button is clicked', () => {
    const a = def('a', { name: 'Alpha' });
    let closed = false;
    render(<DexDetail def={a} defs={[a]} caught={new Set(['a'])} onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DexDetail.test.tsx`
Expected: FAIL — `Cannot find module './DexDetail'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/DexDetail.tsx`:

```tsx
import type { PetDef } from '../data/types';
import { evolutionChain } from '../domain/dex';
import { spriteSrc } from '../config/sprites';
import { ELEMENT_EMOJI, PET_NAME } from '../config/petDisplay';
import { PressButton } from './PressButton';

const dexNo = (n: number) => `#${String(n).padStart(3, '0')}`;

/** One chain node: full art + name if caught, silhouette + ??? if not. */
function ChainNode({ def, caught }: { def: PetDef; caught: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={spriteSrc(def.element, 'adult', 'happy', def)}
        alt={caught ? def.name : 'Undiscovered'}
        className="h-16 w-16 object-contain"
        style={caught ? undefined : { filter: 'brightness(0)' }}
      />
      <span className="text-[10px] font-bold text-amber-900/60">{dexNo(def.dexNo)}</span>
      <span className="text-xs font-extrabold text-amber-950">{caught ? def.name : '???'}</span>
    </div>
  );
}

/** Detail overlay for one dex entry: shows its full evolution chain (def-chain). */
export function DexDetail({
  def, defs, caught, onClose,
}: {
  def: PetDef;
  defs: readonly PetDef[];
  caught: Set<string>;
  onClose: () => void;
}) {
  const chain = evolutionChain(def, defs);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-amber-50 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-amber-950">Evolution</h3>
          <PressButton
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-amber-900/15 px-3 py-1 text-sm font-bold text-amber-950"
          >
            ✕
          </PressButton>
        </div>
        <div className="flex items-center justify-center gap-1">
          {chain.map((d, i) => (
            <div key={d.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-amber-900/40">→</span>}
              <ChainNode def={d} caught={caught.has(d.id)} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-amber-900/70">
          {ELEMENT_EMOJI[def.element]} {PET_NAME[def.element]} · {def.types.join(', ')} · {dexNo(def.dexNo)}
        </p>
      </div>
    </div>
  );
}
```

> If `ELEMENT_EMOJI` / `PET_NAME` are not exported from `src/config/petDisplay.ts`, confirm their names there (Collection.tsx imports both) and match exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DexDetail.test.tsx`
Expected: PASS (2).

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/DexDetail.tsx src/components/DexDetail.test.tsx
git commit -m "feat(dex): DexDetail evolution-chain overlay"
```

---

## Task 4: `DexGrid` — caught/silhouette catalog grid

**Files:**
- Create: `src/components/DexGrid.tsx`
- Test: `src/components/DexGrid.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/DexGrid.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DexGrid } from './DexGrid';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('DexGrid', () => {
  it('shows a caught/total count and renders a tile per enabled def', () => {
    render(<DexGrid />);
    // built-in catalog has 4 enabled defs; starter (def-leaf) is caught
    expect(screen.getByText(/caught\s*1\s*\/\s*4/i)).toBeInTheDocument();
  });

  it('shows full art for caught defs and ??? for undiscovered ones', () => {
    render(<DexGrid />);
    // starter caught -> its name visible; others are ??? silhouettes
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(3);
  });

  it('opens the chain detail when a tile is clicked', () => {
    render(<DexGrid />);
    fireEvent.click(screen.getByRole('button', { name: /leaflet/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

> NOTE: built-in def names come from `petDef.ts` `ELEMENT_NAME` — leaf = `Leaflet`. If the seed/catalog has been changed, adjust the expected names to match `getActivePetDefs()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DexGrid.test.tsx`
Expected: FAIL — `Cannot find module './DexGrid'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/DexGrid.tsx`:

```tsx
import { useState } from 'react';
import { useGameStore, selectCaughtSet } from '../state/gameStore';
import { getActivePetDefs } from '../domain/petDef';
import { spriteSrc } from '../config/sprites';
import { PressButton } from './PressButton';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

const dexNo = (n: number) => `#${String(n).padStart(3, '0')}`;

/** The dex catalog: every enabled PetDef as caught (full art) or undiscovered (silhouette). */
export function DexGrid() {
  const caught = useGameStore(selectCaughtSet);
  const [selected, setSelected] = useState<PetDef | null>(null);

  const defs = getActivePetDefs()
    .filter((d) => d.enabled)
    .slice()
    .sort((a, b) => a.gen - b.gen || a.dexNo - b.dexNo);
  const caughtCount = defs.filter((d) => caught.has(d.id)).length;

  return (
    <div className="relative">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-900/60">
        Caught {caughtCount} / {defs.length}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {defs.map((d) => {
          const isCaught = caught.has(d.id);
          return (
            <PressButton
              key={d.id}
              onClick={() => setSelected(d)}
              aria-label={isCaught ? d.name : `Undiscovered ${dexNo(d.dexNo)}`}
              className="flex flex-col items-center rounded-xl bg-white/70 p-2"
            >
              <img
                src={spriteSrc(d.element, 'adult', 'happy', d)}
                alt=""
                aria-hidden
                className="h-14 w-14 object-contain"
                style={isCaught ? undefined : { filter: 'brightness(0)' }}
              />
              <span className="mt-0.5 text-[10px] font-bold text-amber-900/60">{dexNo(d.dexNo)}</span>
              <span className="text-[11px] font-extrabold text-amber-950">{isCaught ? d.name : '???'}</span>
            </PressButton>
          );
        })}
      </div>
      {selected && (
        <DexDetail def={selected} defs={defs} caught={caught} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DexGrid.test.tsx`
Expected: PASS (3).

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/DexGrid.tsx src/components/DexGrid.test.tsx
git commit -m "feat(dex): DexGrid caught/silhouette catalog grid"
```

---

## Task 5: Collection tab — `My Pets | Dex`

**Files:**
- Modify: `src/components/Collection.tsx` (add tab state + toggle + Dex branch)
- Test: `src/components/Collection.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/components/Collection.test.tsx` (new `describe`):

```ts
import { DexGrid } from './DexGrid'; // not strictly needed; can omit if unused

describe('Collection dex tab', () => {
  it('switches to the Dex tab and shows the caught count', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /^dex$/i }));
    expect(screen.getByText(/caught\s*\d+\s*\/\s*\d+/i)).toBeInTheDocument();
  });

  it('keeps the My Pets roster on the default tab', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    expect(screen.getByText(/my pets/i)).toBeInTheDocument();
  });
});
```

> If `Collection.test.tsx` already imports everything used here, do not duplicate imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Collection.test.tsx`
Expected: FAIL — no `Dex` button found.

- [ ] **Step 3: Implement the tab**

In `src/components/Collection.tsx`:

3a. Add the import:

```tsx
import { DexGrid } from './DexGrid';
```

3b. Add tab state inside `Collection()` (with the other `useState` hooks):

```tsx
  const [tab, setTab] = useState<'pets' | 'dex'>('pets');
```

3c. In the header `<div className="flex items-center gap-2">` (the one holding the Room button + SettingsButton), add a tab toggle **before** the Room button:

```tsx
          <div className="flex rounded-xl bg-amber-900/10 p-0.5 text-sm font-bold">
            <PressButton
              onClick={() => setTab('pets')}
              className={`rounded-lg px-2.5 py-1 ${tab === 'pets' ? 'bg-amber-200 text-amber-950' : 'text-amber-900/60'}`}
            >
              My Pets
            </PressButton>
            <PressButton
              onClick={() => setTab('dex')}
              className={`rounded-lg px-2.5 py-1 ${tab === 'dex' ? 'bg-amber-200 text-amber-950' : 'text-amber-900/60'}`}
            >
              Dex
            </PressButton>
          </div>
```

3d. Wrap the existing scroll body so the Dex replaces the roster. The current body is:

```tsx
      <div className="flex-1 overflow-y-auto p-5">
        {/* ── detail: active pet ... ── */}
        ...
        {/* ── roster ... ── */}
        ...
      </div>
```

Change the opening of that body to branch on `tab`:

```tsx
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'dex' ? (
          <DexGrid />
        ) : (
          <>
            {/* existing active-pet detail + roster JSX goes here unchanged */}
          </>
        )}
      </div>
```

Move the existing detail `motion.div` and roster block inside the `<>...</>` (the `pets` branch). Do not alter that JSX otherwise.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Collection.test.tsx`
Expected: PASS (new 2 + all existing).

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 5: Full verify gate + commit**

```bash
npx vitest run
npx tsc -b
npm run build
git add src/components/Collection.tsx src/components/Collection.test.tsx
git commit -m "feat(dex): Collection My Pets | Dex tab"
```

Expected: all tests pass, `tsc -b` clean, build clean.

---

## Final verification (whole-feature)

- [ ] `npx vitest run` — all green (≈929 existing + new dex tests).
- [ ] `npx tsc -b` — clean.
- [ ] `npm run build` — clean.
- [ ] Manual smoke (optional but recommended): `npm run dev`, open the game, hatch, go Collection → tap **Dex**: starter shows full art + name, other three are `???` silhouettes, header reads `Caught 1 / 4`. Tap a tile → evolution overlay opens; Close dismisses it. Pull a gacha egg of a new element → its def becomes caught in the Dex.
- [ ] Request code review (`superpowers:requesting-code-review`) before considering the slice done.

## Spec coverage map

- Persisted caught set + bump + migration + freshState seed → Task 2.
- `addCaught` union at pet-add sites → Task 2 (3h, 3i).
- `evolutionChain` pure helper → Task 1.
- Collection tabs → Task 5.
- DexGrid (enabled defs, sorted, caught/silhouette, count, click) → Task 4.
- DexDetail (chain, caught/uncaught, element/types/dexNo, close) → Task 3.
- Tests (domain, store/migration, grid, detail, collection tab) → Tasks 1–5.
- Never-blank invariant (spriteSrc fallback) → preserved (Tasks 3,4 use `spriteSrc`).
