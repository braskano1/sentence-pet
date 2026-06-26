# Content Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make journey content data-driven — an admin authors the drill-item pool + journey (units → lessons referencing item ids) into Firestore; players fetch it live with a bundled snapshot fallback.

**Architecture:** A pure content layer (`src/content/`) holds a `ContentBundle` (pool of items + units with embedded lessons) plus pure accessors and a validator. A module-level zustand store holds the *active* bundle so both React components and `gameStore` actions read it synchronously. Player first-paints from a localStorage cache or the bundled `seed`, then fetches live from two aggregate Firestore docs (`content/pool`, `content/journey`), validates, and swaps. An admin two-tab UI authors the bundle and saves it back via an atomic `writeBatch`.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest 4 + Firebase v12 (Firestore) + firebase-admin (seed script). Rules tested via `@firebase/rules-unit-testing` under the emulator (JDK 21).

---

## Conventions for every task

- **Build dir (all git/node):** `D:\ai_projects\AI_design_thinking\sentence-pet`. Branch: `content-authoring` (already created).
- **Bash tool** = POSIX bash; prefix `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`. **PowerShell tool** for PS syntax; `Set-Location` first. Both reset cwd between calls.
- **Run tests:** `npm test -- <path>` (vitest). **Typecheck:** `npx tsc -b` (NOT `tsc --noEmit` — root tsconfig has `"files":[]`). **Build:** `npm run build`.
- **Rules tests:** prepend JDK to PATH then `npm run test:rules`:
  `$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`
- **Mock `canvas-confetti`** in any test that transitively imports `src/effects/celebrate.ts`. Mock `src/content/load`/`src/firebase/content`/`src/content/store` in component tests that would otherwise hit Firestore.
- Commit after each task. LF→CRLF warnings are cosmetic.

## File structure (created / modified)

**Created:**
- `src/content/model.ts` — `ContentBundle`, `Unit`, `Lesson` types + pure accessors.
- `src/content/model.test.ts`
- `src/content/validate.ts` — `validateContent`.
- `src/content/validate.test.ts`
- `src/content/seed.ts` — migrated static content as a `ContentBundle`.
- `src/content/seed.test.ts`
- `src/content/store.ts` — zustand store holding the active bundle.
- `src/content/load.ts` — cache read/write + `hydrateContent()`.
- `src/content/load.test.ts`
- `src/firebase/content.ts` — `fetchContent` / `saveContent`.
- `scripts/seed-content.mjs` — firebase-admin one-shot seeder.
- `src/components/admin/PoolTab.tsx`, `JourneyTab.tsx`, `ItemEditor.tsx` + tests.

**Modified:**
- `src/state/gameStore.ts` — read bundle from content store; `startLesson` resolves via accessors.
- `src/components/JourneyMap.tsx`, `src/components/DrillScreen.tsx`, `src/components/EggHatch.tsx` — read from bundle.
- `src/domain/journeyProgress.ts` — import `Unit`/`Lesson` from `content/model`.
- `src/App.tsx` — pass resolved items to `DrillScreen`.
- `src/main.tsx` — hydrate content on player load; lazy-load admin tree.
- `src/components/admin/AdminShell.tsx` — two-tab shell + save.
- `src/firebase/rules.test.ts` — content read/write cases.
- `docs/firebase-setup.md` — seed-script operator step.
- Retire `src/data/journey.ts`, `src/data/wordBank.ts`, `src/data/journey.test.ts`, `src/data/wordBank.test.ts` (content moves to `src/content/`).

---

## Task 1: Content model + pure accessors

**Files:**
- Create: `src/content/model.ts`, `src/content/model.test.ts`

- [ ] **Step 1: Write the failing test** — `src/content/model.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { ContentBundle } from './model';
import { orderedUnits, findLesson, itemsForLesson, itemsForDrill, tutorialItem } from './model';
import type { DrillItem } from '../data/types';

const item = (id: string, drill: DrillItem['drill'], level: number): DrillItem => ({
  id, drill, level, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'],
});

const bundle: ContentBundle = {
  pool: {
    'a': item('a', 'pattern', 1),
    'b': item('b', 'pattern', 1),
    'c': item('c', 'grammar', 1),
  },
  units: [
    { id: 'u2', title: 'Two', emoji: '🌱', order: 2, lessons: [
      { id: 'u2-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]},
    { id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a', 'b'] },
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]},
  ],
};

describe('content/model accessors', () => {
  it('orderedUnits sorts by order ascending', () => {
    expect(orderedUnits(bundle).map((u) => u.id)).toEqual(['u1', 'u2']);
  });

  it('findLesson resolves a lesson id to its unit + lesson', () => {
    const found = findLesson(bundle, 'u2-l1');
    expect(found?.unit.id).toBe('u2');
    expect(found?.lesson.id).toBe('u2-l1');
    expect(findLesson(bundle, 'nope')).toBeUndefined();
  });

  it('itemsForLesson resolves itemIds in order, skipping unknown ids', () => {
    const lesson = findLesson(bundle, 'u1-l1')!.lesson;
    expect(itemsForLesson(bundle, lesson).map((i) => i.id)).toEqual(['a', 'b']);
    expect(itemsForLesson(bundle, { id: 'x', drill: 'pattern', level: 1, itemIds: ['a', 'ghost'] }))
      .toHaveLength(1);
  });

  it('itemsForDrill filters the pool by drill + level', () => {
    expect(itemsForDrill(bundle, 'pattern', 1).map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(itemsForDrill(bundle, 'grammar', 1).map((i) => i.id)).toEqual(['c']);
    expect(itemsForDrill(bundle, 'pattern', 9)).toEqual([]);
  });

  it('tutorialItem returns the first pattern level-1 item', () => {
    expect(tutorialItem(bundle)?.drill).toBe('pattern');
    expect(tutorialItem(bundle)?.level).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/model.test.ts`
Expected: FAIL — cannot find module `./model`.

- [ ] **Step 3: Write minimal implementation** — `src/content/model.ts`

```ts
import type { DrillItem, DrillType } from '../data/types';

/** One node on the journey: references explicit pool item ids.
 *  isCheckpoint marks the unit's final node (the future B-3 boss seam). */
export interface Lesson {
  id: string;
  drill: DrillType;
  level: number;
  itemIds: string[];
  isCheckpoint?: boolean;
  title?: string;
}

/** A themed cluster of lessons. Cleared checkpoint unlocks the next unit. */
export interface Unit {
  id: string;
  title: string;
  emoji: string;
  order: number;
  lessons: Lesson[];
}

/** Everything the player and admin operate on: a shared item pool + the journey. */
export interface ContentBundle {
  pool: Record<string, DrillItem>;
  units: Unit[];
}

/** Units sorted by order ascending (defensive copy). */
export function orderedUnits(bundle: ContentBundle): Unit[] {
  return [...bundle.units].sort((a, b) => a.order - b.order);
}

/** Resolve a lesson id to its unit + lesson, or undefined. */
export function findLesson(bundle: ContentBundle, id: string): { unit: Unit; lesson: Lesson } | undefined {
  for (const unit of bundle.units) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return undefined;
}

/** Resolve a lesson's itemIds to pool items, in order; unknown ids are skipped. */
export function itemsForLesson(bundle: ContentBundle, lesson: Lesson): DrillItem[] {
  return lesson.itemIds.map((id) => bundle.pool[id]).filter((i): i is DrillItem => i !== undefined);
}

/** Free-practice fallback: all pool items of a given drill + level. */
export function itemsForDrill(bundle: ContentBundle, drill: DrillType, level: number): DrillItem[] {
  return Object.values(bundle.pool).filter((i) => i.drill === drill && i.level === level);
}

/** The egg-hatch tutorial item: first pattern level-1 item in the pool. */
export function tutorialItem(bundle: ContentBundle): DrillItem | undefined {
  return Object.values(bundle.pool).find((i) => i.drill === 'pattern' && i.level === 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/model.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/content/model.ts src/content/model.test.ts && git commit -m "feat(content): ContentBundle model + pure accessors"
```

---

## Task 2: Content validator

**Files:**
- Create: `src/content/validate.ts`, `src/content/validate.test.ts`

- [ ] **Step 1: Write the failing test** — `src/content/validate.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { ContentBundle } from './model';
import { validateContent } from './validate';
import type { DrillItem } from '../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function good(): ContentBundle {
  return {
    pool: { a: item('a'), b: item('b') },
    units: [
      { id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      ]},
    ],
  };
}

describe('validateContent', () => {
  it('accepts a well-formed bundle', () => {
    expect(validateContent(good())).toEqual({ ok: true, errors: [] });
  });

  it('rejects a unit with no lessons', () => {
    const b = good(); b.units[0].lessons = [];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a unit whose checkpoint is not last', () => {
    const b = good();
    b.units[0].lessons = [
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
    ];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a unit with zero or multiple checkpoints', () => {
    const b = good(); b.units[0].lessons[1].isCheckpoint = false;
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects duplicate lesson ids across the journey', () => {
    const b = good();
    b.units.push({ id: 'u2', title: 'Two', emoji: '🌱', order: 2, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]});
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an empty itemIds list', () => {
    const b = good(); b.units[0].lessons[0].itemIds = [];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an itemId that does not resolve in the pool', () => {
    const b = good(); b.units[0].lessons[0].itemIds = ['ghost'];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an item whose answer length != slots length', () => {
    const b = good(); b.pool.a = { ...b.pool.a, answer: ['I'] };
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a trap slot index out of range', () => {
    const b = good();
    b.pool.a = { ...b.pool.a, traps: [{ slot: 5, word: 'runs', tip: 't' }] };
    expect(validateContent(b).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/validate.test.ts`
Expected: FAIL — cannot find module `./validate`.

- [ ] **Step 3: Write minimal implementation** — `src/content/validate.ts`

```ts
import type { ContentBundle } from './model';

/** Validate a bundle's structural invariants. Used at author-save (block writes)
 *  and on live fetch (reject an invalid live doc → keep the current bundle). */
export function validateContent(bundle: ContentBundle): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  if (bundle.units.length === 0) push('journey has no units');

  const unitIds = bundle.units.map((u) => u.id);
  if (new Set(unitIds).size !== unitIds.length) push('duplicate unit ids');

  const lessonIds: string[] = [];
  for (const unit of bundle.units) {
    if (unit.lessons.length === 0) { push(`unit ${unit.id} has no lessons`); continue; }

    const checkpoints = unit.lessons.filter((l) => l.isCheckpoint);
    if (checkpoints.length !== 1) push(`unit ${unit.id} must have exactly one checkpoint`);
    if (!unit.lessons[unit.lessons.length - 1].isCheckpoint) push(`unit ${unit.id} checkpoint must be last`);

    for (const lesson of unit.lessons) {
      lessonIds.push(lesson.id);
      if (lesson.itemIds.length === 0) push(`lesson ${lesson.id} has no items`);
      for (const itemId of lesson.itemIds) {
        const item = bundle.pool[itemId];
        if (!item) { push(`lesson ${lesson.id} references unknown item ${itemId}`); continue; }
        if (item.answer.length !== item.slots.length) push(`item ${itemId} answer/slots length mismatch`);
        for (const trap of item.traps ?? []) {
          if (trap.slot < 0 || trap.slot >= item.slots.length) push(`item ${itemId} trap slot out of range`);
        }
      }
    }
  }

  if (new Set(lessonIds).size !== lessonIds.length) push('duplicate lesson ids across journey');

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/validate.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/content/validate.ts src/content/validate.test.ts && git commit -m "feat(content): validateContent invariants"
```

---

## Task 3: Seed bundle (migrate static content)

**Files:**
- Create: `src/content/seed.ts`, `src/content/seed.test.ts`
- Read (do not modify yet): `src/data/journey.ts`, `src/data/wordBank.ts`

**Approach:** Transform the existing `WORD_BANK` (all current items) into `SEED.pool` keyed by item id, and the existing `JOURNEY` into `SEED.units` where each lesson's `itemIds` = the ids of all current items matching that lesson's `(drill, level)`. This preserves today's gameplay exactly (parity test below).

- [ ] **Step 1: Write the failing test** — `src/content/seed.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { SEED } from './seed';
import { validateContent } from './validate';
import { findLesson, itemsForLesson } from './model';
import { JOURNEY } from '../data/journey';
import { itemsFor } from '../data/wordBank';

describe('SEED content bundle', () => {
  it('passes validation', () => {
    expect(validateContent(SEED)).toEqual({ ok: true, errors: [] });
  });

  it('preserves every lesson id from the static JOURNEY', () => {
    const staticIds = JOURNEY.flatMap((u) => u.lessons.map((l) => l.id)).sort();
    const seedIds = SEED.units.flatMap((u) => u.lessons.map((l) => l.id)).sort();
    expect(seedIds).toEqual(staticIds);
  });

  it('migration parity: each lesson resolves to the same items as the old itemsFor(drill, level)', () => {
    for (const unit of SEED.units) {
      for (const lesson of unit.lessons) {
        const expected = itemsFor(lesson.drill, lesson.level).map((i) => i.id).sort();
        const got = itemsForLesson(SEED, lesson).map((i) => i.id).sort();
        expect(got).toEqual(expected);
        expect(got.length).toBeGreaterThan(0);
      }
    }
  });

  it('findLesson works against the seed', () => {
    const first = SEED.units[0].lessons[0];
    expect(findLesson(SEED, first.id)?.lesson.id).toBe(first.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/seed.test.ts`
Expected: FAIL — cannot find module `./seed`.

- [ ] **Step 3: Write minimal implementation** — `src/content/seed.ts`

Build the bundle *from* the existing static modules so it stays a faithful migration (these imports are removed in Task 9 when the static modules retire — at that point inline the data).

```ts
import type { ContentBundle, Unit } from './model';
import type { DrillItem } from '../data/types';
import { WORD_BANK, itemsFor } from '../data/wordBank';
import { JOURNEY } from '../data/journey';

const pool: Record<string, DrillItem> = Object.fromEntries(WORD_BANK.map((i) => [i.id, i]));

const units: Unit[] = JOURNEY.map((u) => ({
  id: u.id,
  title: u.title,
  emoji: u.emoji,
  order: u.order,
  lessons: u.lessons.map((l) => ({
    id: l.id,
    drill: l.drill,
    level: l.level,
    isCheckpoint: l.isCheckpoint,
    itemIds: itemsFor(l.drill, l.level).map((i) => i.id),
  })),
}));

/** The migrated static content. Bundled fallback for first paint AND the seed-script source. */
export const SEED: ContentBundle = { pool, units };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/seed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/content/seed.ts src/content/seed.test.ts && git commit -m "feat(content): SEED bundle migrated from static journey/wordBank"
```

---

## Task 4: Firestore content repo

**Files:**
- Create: `src/firebase/content.ts`
- Reference: `src/firebase/db.ts` (exports `db`)

**Note:** No unit test (thin Firestore wrapper; covered by rules tests in Task 6 + manual seed in Task 8). Verify by typecheck.

- [ ] **Step 1: Write implementation** — `src/firebase/content.ts`

```ts
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './db';
import type { ContentBundle, Unit } from '../content/model';
import type { DrillItem } from '../data/types';

const POOL_DOC = doc(db, 'content', 'pool');
const JOURNEY_DOC = doc(db, 'content', 'journey');

/** Read both aggregate docs and assemble a ContentBundle. */
export async function fetchContent(): Promise<ContentBundle> {
  const [poolSnap, journeySnap] = await Promise.all([getDoc(POOL_DOC), getDoc(JOURNEY_DOC)]);
  const pool = (poolSnap.data()?.items ?? {}) as Record<string, DrillItem>;
  const units = (journeySnap.data()?.units ?? []) as Unit[];
  return { pool, units };
}

/** Atomically write both aggregate docs (admin-only, enforced by rules). */
export async function saveContent(bundle: ContentBundle): Promise<void> {
  const batch = writeBatch(db);
  batch.set(POOL_DOC, { items: bundle.pool });
  batch.set(JOURNEY_DOC, { units: bundle.units });
  await batch.commit();
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/firebase/content.ts && git commit -m "feat(firebase): content repo (fetchContent/saveContent)"
```

---

## Task 5: Content store + load (cache, hydrate, swap)

**Files:**
- Create: `src/content/store.ts`, `src/content/load.ts`, `src/content/load.test.ts`

- [ ] **Step 1: Write the store** — `src/content/store.ts`

```ts
import { create } from 'zustand';
import type { ContentBundle } from './model';
import { SEED } from './seed';
import { cachedBundle } from './load';

export type ContentStatus = 'fallback' | 'live';

interface ContentState {
  bundle: ContentBundle;
  status: ContentStatus;
  setBundle: (bundle: ContentBundle, status: ContentStatus) => void;
}

/** Module-level store so both React components and gameStore actions read the
 *  active bundle synchronously. First paint = cached last-good ?? bundled SEED. */
export const useContentStore = create<ContentState>((set) => ({
  bundle: cachedBundle() ?? SEED,
  status: 'fallback',
  setBundle: (bundle, status) => set({ bundle, status }),
}));
```

- [ ] **Step 2: Write the failing test** — `src/content/load.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ContentBundle } from './model';
import type { DrillItem } from '../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

const liveBundle: ContentBundle = {
  pool: { a: item('a') },
  units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
    { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
    { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true },
  ]}],
};

const fetchContent = vi.fn();
vi.mock('../firebase/content', () => ({ fetchContent: () => fetchContent() }));

import { cachedBundle, writeCache, hydrateContent, CACHE_KEY } from './load';
import { useContentStore } from './store';

describe('content load', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchContent.mockReset();
    useContentStore.setState({ status: 'fallback' });
  });

  it('writeCache then cachedBundle round-trips a valid bundle', () => {
    writeCache(liveBundle);
    expect(cachedBundle()?.units[0].id).toBe('u1');
  });

  it('cachedBundle returns null for absent or invalid cache', () => {
    expect(cachedBundle()).toBeNull();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pool: {}, units: [] })); // invalid (no units)
    expect(cachedBundle()).toBeNull();
  });

  it('hydrateContent swaps to a valid live bundle and caches it', async () => {
    fetchContent.mockResolvedValue(liveBundle);
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('live');
    expect(useContentStore.getState().bundle.units[0].id).toBe('u1');
    expect(cachedBundle()?.units[0].id).toBe('u1');
  });

  it('hydrateContent keeps the current bundle when the live doc is invalid', async () => {
    fetchContent.mockResolvedValue({ pool: {}, units: [] }); // invalid
    const before = useContentStore.getState().bundle;
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('fallback');
    expect(useContentStore.getState().bundle).toBe(before);
  });

  it('hydrateContent swallows fetch errors and keeps the current bundle', async () => {
    fetchContent.mockRejectedValue(new Error('offline'));
    await hydrateContent();
    expect(useContentStore.getState().status).toBe('fallback');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/load.test.ts`
Expected: FAIL — cannot find module `./load`.

- [ ] **Step 4: Write implementation** — `src/content/load.ts`

```ts
import type { ContentBundle } from './model';
import { validateContent } from './validate';
import { fetchContent } from '../firebase/content';
import { useContentStore } from './store';

export const CACHE_KEY = 'sentence-pet-content';

/** Last-good bundle from localStorage, or null if absent/corrupt/invalid. */
export function cachedBundle(): ContentBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentBundle;
    return validateContent(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a known-good bundle as the last-good cache. */
export function writeCache(bundle: ContentBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // quota / disabled storage — non-fatal
  }
}

/** Fetch live content; swap + cache only if valid. Errors/invalid → keep current bundle. */
export async function hydrateContent(): Promise<void> {
  try {
    const live = await fetchContent();
    if (validateContent(live).ok) {
      useContentStore.getState().setBundle(live, 'live');
      writeCache(live);
    }
  } catch {
    // offline / permission — keep fallback, never blank the game
  }
}
```

Note: `store.ts` imports `cachedBundle` from `load.ts`, and `load.ts` imports `useContentStore` from `store.ts`. This cycle is safe because each only *calls* the other at runtime (not at module-eval top level except `store`'s initializer, which runs after both modules finish loading). If the bundler warns, move `cachedBundle` into a third file `cache.ts` imported by both. Verify no runtime error in Step 5.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/content/load.test.ts`
Expected: PASS (5 tests). If a circular-import runtime error appears, extract `cachedBundle`/`writeCache`/`CACHE_KEY` to `src/content/cache.ts` and re-point imports, then re-run.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/content/store.ts src/content/load.ts src/content/load.test.ts && git commit -m "feat(content): active-bundle store + cache/hydrate"
```

---

## Task 6: Rules tests for content docs

**Files:**
- Modify: `src/firebase/rules.test.ts` (rules already permit `content/{doc=**}` public-read / admin-write — this adds explicit coverage for the two real doc paths)

- [ ] **Step 1: Add test cases** — insert after the existing `'an admin can write content'` test (around line 58):

```ts
  it('anyone can read content/pool and content/journey', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'content/pool')));
    await assertSucceeds(getDoc(doc(anon, 'content/journey')));
  });

  it('only an admin can write content/pool and content/journey', async () => {
    const user = env.authenticatedContext('user1', {}).firestore();
    await assertFails(setDoc(doc(user, 'content/pool'), { items: {} }));
    await assertFails(setDoc(doc(user, 'content/journey'), { units: [] }));
    const admin = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(admin, 'content/pool'), { items: {} }));
    await assertSucceeds(setDoc(doc(admin, 'content/journey'), { units: [] }));
  });
```

- [ ] **Step 2: Run plain test suite (rules tests skip without emulator)**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/firebase/rules.test.ts`
Expected: the `run` block is `describe.skip` offline → tests reported as skipped, suite green.

- [ ] **Step 3: Run rules tests under the emulator** (PowerShell tool)

Run: `$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`
Expected: all rules tests PASS (now 11 cases). Requires `dangerouslyDisableSandbox: true` (boots emulator + downloads jar if needed) — main thread runs this.

- [ ] **Step 4: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/firebase/rules.test.ts && git commit -m "test(rules): content/pool + content/journey read/write coverage"
```

---

## Task 7: Wire player consumers to the active bundle

This task swaps the four static consumers to read from `useContentStore`. Do all sub-steps before committing (they cross-reference). After it, `src/data/journey.ts`/`wordBank.ts` are still imported only by `seed.ts` (retired in Task 9).

**Files:**
- Modify: `src/state/gameStore.ts`, `src/components/JourneyMap.tsx`, `src/components/DrillScreen.tsx`, `src/components/EggHatch.tsx`, `src/App.tsx`, `src/domain/journeyProgress.ts`

- [ ] **Step 1: Write/adjust failing tests**

In `src/state/gameStore.test.ts`, the existing tests that call `startLesson` must still pass against the seed bundle. Add at the top of that file (after imports):

```ts
import { useContentStore } from '../content/store';
import { SEED } from '../content/seed';
// Ensure the content store holds the seed bundle for store tests.
useContentStore.setState({ bundle: SEED, status: 'fallback' });
```

Update any `journeyProgress.test.ts` / `JourneyMap` imports of `Unit`/`Lesson` to come from `../content/model` (type-only import — no behavior change).

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/state/gameStore.test.ts src/domain/journeyProgress.test.ts`
Expected: FAIL once you start editing imports (or still green now) — the point is the suite must be green at Step 4.

- [ ] **Step 2: Edit `src/domain/journeyProgress.ts`** — change line 1:

```ts
import type { Unit, Lesson } from '../content/model';
```

- [ ] **Step 3: Edit `src/state/gameStore.ts`**

Replace the import on line 14:

```ts
import { findLesson, itemsForLesson } from '../content/model';
import { useContentStore } from '../content/store';
```

Replace `startLesson` (lines 141-146) with a version that resolves against the active bundle:

```ts
      startLesson: (lessonId) => {
        const bundle = useContentStore.getState().bundle;
        const found = findLesson(bundle, lessonId);
        if (!found) return; // unknown id — defensive no-op
        get().startDrill(found.lesson.drill, found.lesson.level);
        set({ currentLessonId: lessonId });
      },
```

(`finishRound` is unchanged — it already takes `drill`/`level` from the round result.)

- [ ] **Step 4: Edit `src/components/JourneyMap.tsx`**

Replace lines 3-4:

```ts
import { orderedUnits } from '../content/model';
import type { Unit, Lesson } from '../content/model';
import { useContentStore } from '../content/store';
```

Replace line 38 (`const units = orderedUnits();`):

```ts
  const bundle = useContentStore((s) => s.bundle);
  const units = orderedUnits(bundle);
```

- [ ] **Step 5: Edit `src/components/DrillScreen.tsx`**

Change the signature to receive resolved items, and resolve in the parent. Replace line 16-17 imports:

```ts
import { trayWords } from '../data/wordBank';
import type { DrillItem, DrillType } from '../data/types';
```

Replace the component signature + `items` line (lines 26-27):

```ts
export function DrillScreen({ items, drill, level }: { items: DrillItem[]; drill: DrillType; level: number }) {
```

Delete the old `const items = useMemo(() => itemsFor(drill, level), [drill, level]);` line. All other references to `items` already work (they index `items[...]`/`items.length`). `trayWords` import stays (used in `loadItem`).

- [ ] **Step 6: Edit `src/App.tsx`** to resolve items and pass them in

Add imports:

```ts
import { useContentStore } from './content/store';
import { findLesson, itemsForLesson, itemsForDrill } from './content/model';
import type { DrillItem } from './data/types';
```

Change `screenKeyAndNode` to take `items` and pass to `DrillScreen`:

```ts
function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType, level: number, items: DrillItem[]) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickDrill': return { key: 'pickDrill', node: <JourneyMap /> };
    case 'drill': return { key: 'drill', node: <DrillScreen items={items} drill={drill} level={level} /> };
    // ...rest unchanged
  }
}
```

In `CurrentScreen`, resolve items from the active bundle + current lesson (fall back to free-practice items):

```ts
  const bundle = useContentStore((s) => s.bundle);
  const currentLessonId = useGameStore((s) => s.currentLessonId);
  const lesson = currentLessonId ? findLesson(bundle, currentLessonId)?.lesson : undefined;
  const items = lesson ? itemsForLesson(bundle, lesson) : itemsForDrill(bundle, drill, level);
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level, items);
```

- [ ] **Step 7: Edit `src/components/EggHatch.tsx`**

Replace line 16 import + line 27:

```ts
import { useContentStore } from '../content/store';
import { tutorialItem } from '../content/model';
```

```ts
  const bundle = useContentStore((s) => s.bundle);
  const item = useMemo(() => tutorialItem(bundle)!, [bundle]);
```

- [ ] **Step 8: Update component tests that render DrillScreen**

Any test rendering `<DrillScreen .../>` must pass `items`. In those tests import `itemsForDrill` + `SEED`:

```ts
import { SEED } from '../content/seed';
import { itemsForDrill } from '../content/model';
// ...
render(<DrillScreen items={itemsForDrill(SEED, 'pattern', 1)} drill="pattern" level={1} />);
```

(Find them with: `grep -rl "DrillScreen" src/**/*.test.tsx`.)

- [ ] **Step 9: Run the full suite + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test && npx tsc -b`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 10: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "refactor: player consumers read content from the active bundle"
```

---

## Task 8: Seed script + operator docs

**Files:**
- Create: `scripts/seed-content.mjs`
- Modify: `docs/firebase-setup.md`

**Note:** firebase-admin can't import the TS `SEED` directly. The script reads the bundle from a JSON file emitted by a tiny export step, OR re-declares the transform. Simplest + DRY: add an npm script that writes `SEED` to `dist-seed/content.json`, which `seed-content.mjs` reads.

- [ ] **Step 1: Add a seed-export module** — `scripts/export-seed.mjs` is not possible (TS). Instead add to `package.json` scripts:

```json
    "seed:export": "vite-node scripts/export-seed.ts",
    "seed:push": "node scripts/seed-content.mjs"
```

Create `scripts/export-seed.ts`:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { SEED } from '../src/content/seed';

mkdirSync('dist-seed', { recursive: true });
writeFileSync('dist-seed/content.json', JSON.stringify(SEED, null, 2));
console.log(`wrote dist-seed/content.json (${SEED.units.length} units, ${Object.keys(SEED.pool).length} items)`);
```

(If `vite-node` is not installed, add it: `npm i -D vite-node`.)

- [ ] **Step 2: Create `scripts/seed-content.mjs`**

```js
// One-shot: push the migrated content bundle to Firestore (content/pool + content/journey).
// Requires GOOGLE_APPLICATION_CREDENTIALS (service account) and dist-seed/content.json
// (run `npm run seed:export` first). Usage: npm run seed:push
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const bundle = JSON.parse(readFileSync('dist-seed/content.json', 'utf8'));

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const batch = db.batch();
batch.set(db.collection('content').doc('pool'), { items: bundle.pool });
batch.set(db.collection('content').doc('journey'), { units: bundle.units });
await batch.commit();

console.log(`seeded content: ${bundle.units.length} units, ${Object.keys(bundle.pool).length} items.`);
process.exit(0);
```

- [ ] **Step 3: Document the operator step** — append to `docs/firebase-setup.md`:

```markdown
## Seeding content (one-time / after content model changes)

The player ships with a bundled content snapshot, but Firestore must be seeded so the
admin tool and live fetch have data:

1. `npm run seed:export`  — writes `dist-seed/content.json` from `src/content/seed.ts`.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to your service-account key (see admin-claim setup).
3. `npm run seed:push`    — writes `content/pool` + `content/journey` atomically.

Re-runnable; overwrites both docs. After this, edit content live via the admin tool (`#admin`).
```

- [ ] **Step 4: Verify export runs**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm run seed:export`
Expected: prints `wrote dist-seed/content.json (2 units, 30 items)` (counts may differ). Add `dist-seed/` to `.gitignore`.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add scripts/export-seed.ts scripts/seed-content.mjs package.json docs/firebase-setup.md .gitignore && git commit -m "feat(content): seed export + firebase-admin push script + docs"
```

---

## Task 9: Retire static modules + hydrate on player load + lazy admin

**Files:**
- Modify: `src/content/seed.ts` (inline the data; drop `data/*` imports), `src/main.tsx`
- Delete: `src/data/journey.ts`, `src/data/journey.test.ts`, `src/data/wordBank.ts`, `src/data/wordBank.test.ts`

- [ ] **Step 1: Inline the migrated data into `seed.ts`**

Run `npm run seed:export` (Task 8) to get `dist-seed/content.json`, then replace `seed.ts` body with a literal bundle (paste the JSON as a typed const) so it no longer imports `../data/*`:

```ts
import type { ContentBundle } from './model';

export const SEED: ContentBundle = /* paste dist-seed/content.json here, typed */ { pool: { /* … */ }, units: [ /* … */ ] };
```

Keep `seed.test.ts` parity assertions by temporarily retaining `data/wordBank` + `data/journey` imports in the **test** until Step 3; OR (cleaner) change `seed.test.ts` to assert `validateContent(SEED).ok` + non-empty `itemsForLesson` per lesson, dropping the now-deleted `itemsFor`/`JOURNEY` references. Do the latter.

- [ ] **Step 2: Trim `seed.test.ts`** to not reference deleted modules

Replace the `itemsFor`/`JOURNEY` parity cases with:

```ts
  it('every lesson resolves to at least one pool item', () => {
    for (const u of SEED.units) for (const l of u.lessons) {
      expect(itemsForLesson(SEED, l).length).toBeGreaterThan(0);
    }
  });
```

(Keep the `validateContent(SEED)` + `findLesson` tests.)

- [ ] **Step 3: Delete the static modules**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git rm src/data/journey.ts src/data/journey.test.ts src/data/wordBank.ts src/data/wordBank.test.ts
```

Then `grep -rn "data/journey\|data/wordBank" src` → fix any stragglers (should be none after Task 7; `trayWords` lives in `wordBank.ts` — **move it** to `src/content/model.ts` and re-point `DrillScreen.tsx`'s import to `../content/model`).

- [ ] **Step 4: Hydrate content on player load + lazy-load admin** — `src/main.tsx`

```ts
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './state/gameStore'
import { isAdminEntry } from './auth/adminEntry'
import { hydrateContent } from './content/load'

const AdminApp = lazy(() => import('./admin-entry'))

if (import.meta.env.DEV) {
  (window as unknown as { store: typeof useGameStore }).store = useGameStore
}

const isAdmin = isAdminEntry(window.location.hash)
if (!isAdmin) {
  void hydrateContent() // live fetch → swap + cache; failures keep the bundled fallback
}

const root = isAdmin
  ? <Suspense fallback={null}><AdminApp /></Suspense>
  : <App />

createRoot(document.getElementById('root')!).render(<StrictMode>{root}</StrictMode>)
```

Create `src/admin-entry.tsx` (the lazy chunk — pulls AuthProvider/AdminRoute/AdminShell out of the player bundle):

```tsx
import { AuthProvider } from './auth/AuthProvider'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminShell } from './components/admin/AdminShell'

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminRoute>
        <AdminShell />
      </AdminRoute>
    </AuthProvider>
  )
}
```

- [ ] **Step 5: Full verify**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test && npx tsc -b && npm run build`
Expected: all tests PASS, typecheck clean, build succeeds. Confirm the build output shows the admin code split into a separate chunk (firebase/admin no longer in the main player chunk beyond the Firestore client used by live fetch).

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "refactor(content): inline seed, retire static data modules, hydrate + lazy admin"
```

---

## Task 10: Admin — Item editor + Pool tab

**Files:**
- Create: `src/components/admin/ItemEditor.tsx`, `src/components/admin/PoolTab.tsx`, `src/components/admin/PoolTab.test.tsx`

The admin tabs operate on a **draft bundle** held in local React state in `AdminShell` (Task 12), passed down with `onChange`. Pool tab edits `bundle.pool`.

- [ ] **Step 1: Write the failing test** — `src/components/admin/PoolTab.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoolTab } from './PoolTab';
import type { ContentBundle } from '../../content/model';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function bundle(): ContentBundle {
  return { pool: { a: item('a') }, units: [] };
}

describe('PoolTab', () => {
  it('lists pool items by id', () => {
    render(<PoolTab bundle={bundle()} onChange={() => {}} />);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('adding a new item calls onChange with the item in the pool', () => {
    const onChange = vi.fn();
    render(<PoolTab bundle={bundle()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ContentBundle;
    expect(Object.keys(next.pool).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/PoolTab.test.tsx`
Expected: FAIL — cannot find module `./PoolTab`.

- [ ] **Step 3: Implement `ItemEditor.tsx`** (controlled editor for one `DrillItem`)

```tsx
import type { DrillItem, PosLabel } from '../../data/types';

const POS: PosLabel[] = ['Pronoun', 'Verb', 'Object'];

export function ItemEditor({ item, onChange }: { item: DrillItem; onChange: (i: DrillItem) => void }) {
  const set = (patch: Partial<DrillItem>) => onChange({ ...item, ...patch });
  const csv = (s: string) => s.split(',').map((w) => w.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      <label>id <input className="border px-1" value={item.id}
        onChange={(e) => set({ id: e.target.value })} /></label>
      <label>drill
        <select className="border px-1" value={item.drill}
          onChange={(e) => set({ drill: e.target.value as DrillItem['drill'] })}>
          {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label>level <input type="number" className="w-16 border px-1" value={item.level}
        onChange={(e) => set({ level: Number(e.target.value) })} /></label>
      <label>thaiHint <input className="border px-1" value={item.thaiHint}
        onChange={(e) => set({ thaiHint: e.target.value })} /></label>
      <label>slots (csv) <input className="border px-1" value={item.slots.join(',')}
        onChange={(e) => set({ slots: csv(e.target.value) as PosLabel[] })} /></label>
      <label>answer (csv) <input className="border px-1" value={item.answer.join(',')}
        onChange={(e) => set({ answer: csv(e.target.value) })} /></label>
      <label>distractors (csv) <input className="border px-1" value={(item.distractors ?? []).join(',')}
        onChange={(e) => set({ distractors: csv(e.target.value) })} /></label>
      <p className="text-xs text-slate-400">POS options: {POS.join(', ')}. Traps edited as JSON later.</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `PoolTab.tsx`**

```tsx
import { useState } from 'react';
import type { ContentBundle } from '../../content/model';
import type { DrillItem } from '../../data/types';
import { ItemEditor } from './ItemEditor';

export function PoolTab({ bundle, onChange }: { bundle: ContentBundle; onChange: (b: ContentBundle) => void }) {
  const ids = Object.keys(bundle.pool);
  const [selected, setSelected] = useState<string | null>(ids[0] ?? null);

  function addItem() {
    const id = `item-${ids.length + 1}`;
    const fresh: DrillItem = { id, drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun', 'Verb'], answer: ['', ''] };
    onChange({ ...bundle, pool: { ...bundle.pool, [id]: fresh } });
    setSelected(id);
  }

  function updateItem(next: DrillItem) {
    const pool = { ...bundle.pool };
    delete pool[selected!];
    pool[next.id] = next;
    onChange({ ...bundle, pool });
    setSelected(next.id);
  }

  function removeItem(id: string) {
    const pool = { ...bundle.pool };
    delete pool[id];
    onChange({ ...bundle, pool });
    setSelected(Object.keys(pool)[0] ?? null);
  }

  return (
    <div className="flex gap-4">
      <div className="flex w-48 flex-col gap-1">
        <button type="button" onClick={addItem} className="rounded bg-slate-800 px-2 py-1 text-white">+ New item</button>
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => setSelected(id)}
            className={`flex justify-between rounded px-2 py-1 text-left text-sm ${id === selected ? 'bg-indigo-100' : ''}`}>
            <span>{id}</span>
            <span className="text-xs text-slate-400">{bundle.pool[id].drill}·{bundle.pool[id].level}</span>
          </button>
        ))}
      </div>
      <div className="flex-1">
        {selected && bundle.pool[selected] && (
          <>
            <ItemEditor item={bundle.pool[selected]} onChange={updateItem} />
            <button type="button" onClick={() => removeItem(selected)} className="mt-2 text-sm text-red-600">Delete item</button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/PoolTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/admin/ItemEditor.tsx src/components/admin/PoolTab.tsx src/components/admin/PoolTab.test.tsx && git commit -m "feat(admin): pool tab + item editor"
```

---

## Task 11: Admin — Journey tab (units + lessons + itemId picker)

**Files:**
- Create: `src/components/admin/JourneyTab.tsx`, `src/components/admin/JourneyTab.test.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/admin/JourneyTab.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyTab } from './JourneyTab';
import type { ContentBundle } from '../../content/model';
import type { DrillItem } from '../../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function bundle(): ContentBundle {
  return {
    pool: { a: item('a'), b: item('b') },
    units: [{ id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true },
    ]}],
  };
}

describe('JourneyTab', () => {
  it('renders units and their lessons', () => {
    render(<JourneyTab bundle={bundle()} onChange={() => {}} />);
    expect(screen.getByDisplayValue('One')).toBeInTheDocument();
    expect(screen.getByText('u1-l1')).toBeInTheDocument();
  });

  it('toggling an item id in the selected lesson calls onChange', () => {
    const onChange = vi.fn();
    render(<JourneyTab bundle={bundle()} onChange={onChange} />);
    fireEvent.click(screen.getByText('u1-l1'));
    fireEvent.click(screen.getByRole('checkbox', { name: /item b/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ContentBundle;
    expect(next.units[0].lessons[0].itemIds).toContain('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/JourneyTab.test.tsx`
Expected: FAIL — cannot find module `./JourneyTab`.

- [ ] **Step 3: Implement `JourneyTab.tsx`**

```tsx
import { useState } from 'react';
import type { ContentBundle, Lesson, Unit } from '../../content/model';

export function JourneyTab({ bundle, onChange }: { bundle: ContentBundle; onChange: (b: ContentBundle) => void }) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    bundle.units[0]?.lessons[0]?.id ?? null,
  );
  const poolIds = Object.keys(bundle.pool);

  function setUnits(units: Unit[]) { onChange({ ...bundle, units }); }

  function patchUnit(unitId: string, patch: Partial<Unit>) {
    setUnits(bundle.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  }

  function patchLesson(unitId: string, lessonId: string, patch: Partial<Lesson>) {
    setUnits(bundle.units.map((u) => u.id !== unitId ? u : {
      ...u, lessons: u.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    }));
  }

  function toggleItem(unitId: string, lesson: Lesson, itemId: string) {
    const itemIds = lesson.itemIds.includes(itemId)
      ? lesson.itemIds.filter((id) => id !== itemId)
      : [...lesson.itemIds, itemId];
    patchLesson(unitId, lesson.id, { itemIds });
  }

  const selected = bundle.units.flatMap((u) => u.lessons.map((l) => ({ u, l })))
    .find(({ l }) => l.id === selectedLessonId);

  return (
    <div className="flex gap-4 text-sm">
      <div className="w-56 flex-col gap-2">
        {bundle.units.map((unit) => (
          <div key={unit.id} className="mb-3 rounded border p-2">
            <input className="w-full border px-1 font-semibold" value={unit.title}
              onChange={(e) => patchUnit(unit.id, { title: e.target.value })} />
            <input className="mt-1 w-16 border px-1" value={unit.emoji}
              onChange={(e) => patchUnit(unit.id, { emoji: e.target.value })} aria-label="emoji" />
            <div className="mt-1 flex flex-col">
              {unit.lessons.map((l) => (
                <button key={l.id} type="button" onClick={() => setSelectedLessonId(l.id)}
                  className={`rounded px-1 text-left ${l.id === selectedLessonId ? 'bg-indigo-100' : ''}`}>
                  {l.id}{l.isCheckpoint ? ' ★' : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {selected && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">{selected.l.id}</p>
            <label>drill
              <select className="border px-1" value={selected.l.drill}
                onChange={(e) => patchLesson(selected.u.id, selected.l.id, { drill: e.target.value as Lesson['drill'] })}>
                {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>level <input type="number" className="w-16 border px-1" value={selected.l.level}
              onChange={(e) => patchLesson(selected.u.id, selected.l.id, { level: Number(e.target.value) })} /></label>
            <label><input type="checkbox" checked={!!selected.l.isCheckpoint}
              onChange={(e) => patchLesson(selected.u.id, selected.l.id, { isCheckpoint: e.target.checked })} /> checkpoint</label>
            <p className="mt-2 font-semibold">Items in lesson</p>
            <div className="flex flex-col">
              {poolIds.map((id) => (
                <label key={id}>
                  <input type="checkbox" aria-label={`item ${id}`} checked={selected.l.itemIds.includes(id)}
                    onChange={() => toggleItem(selected.u.id, selected.l, id)} /> {id} <span className="text-xs text-slate-400">({bundle.pool[id].drill}·{bundle.pool[id].level})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/JourneyTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/admin/JourneyTab.tsx src/components/admin/JourneyTab.test.tsx && git commit -m "feat(admin): journey tab (units, lessons, itemId picker)"
```

---

## Task 12: Admin shell — tabs, draft state, validation banner, save

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`, `src/components/admin/AdminShell.test.tsx`

- [ ] **Step 1: Update the failing test** — `src/components/admin/AdminShell.test.tsx`

Mock `useAuth`, `src/firebase/content`, and `src/content/store`. Add:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'a@b.c', uid: 'admin1' }, signOut: vi.fn() }) }));
const saveContent = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({ saveContent: (b: unknown) => saveContent(b), fetchContent: vi.fn() }));

import { AdminShell } from './AdminShell';
import { useContentStore } from '../../content/store';
import { SEED } from '../../content/seed';

beforeEach(() => { saveContent.mockClear(); useContentStore.setState({ bundle: SEED, status: 'fallback' }); });

describe('AdminShell', () => {
  it('shows Pool and Journey tabs and switches between them', () => {
    render(<AdminShell />);
    expect(screen.getByRole('button', { name: /pool/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /journey/i }));
    expect(screen.getByText(/u1-/i)).toBeInTheDocument();
  });

  it('Save calls saveContent with the draft bundle when valid', async () => {
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() => expect(saveContent).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/AdminShell.test.tsx`
Expected: FAIL — tabs/Save not present.

- [ ] **Step 3: Rewrite `AdminShell.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateContent } from '../../content/validate';
import { saveContent } from '../../firebase/content';
import type { ContentBundle } from '../../content/model';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveBundle = useContentStore((s) => s.bundle);
  const setBundle = useContentStore((s) => s.setBundle);
  const [draft, setDraft] = useState<ContentBundle>(liveBundle);
  const [tab, setTab] = useState<'pool' | 'journey'>('pool');
  const [status, setStatus] = useState('');

  const validation = validateContent(draft);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveContent(draft);
      setBundle(draft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mx-auto mt-6 flex max-w-4xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Sentence Pet — Content</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>{user?.email} · admin ✓</span>
          <button type="button" onClick={() => signOut()} className="rounded border px-2 py-1">Sign out</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab('pool')}
          className={`rounded px-3 py-1 ${tab === 'pool' ? 'bg-indigo-600 text-white' : 'border'}`}>Pool</button>
        <button type="button" onClick={() => setTab('journey')}
          className={`rounded px-3 py-1 ${tab === 'journey' ? 'bg-indigo-600 text-white' : 'border'}`}>Journey</button>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono text-sm">{status}</span>}
      </div>

      {!validation.ok && (
        <ul className="rounded bg-red-50 p-2 text-sm text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {tab === 'pool'
        ? <PoolTab bundle={draft} onChange={setDraft} />
        : <JourneyTab bundle={draft} onChange={setDraft} />}
    </div>
  );
}
```

Remove the now-unused `ping` imports/usage. (The `ping.ts` tracer can be deleted in a follow-up; not required here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- src/components/admin/AdminShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Full verify**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test && npx tsc -b && npm run build`
Expected: all PASS, typecheck clean, build OK.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx && git commit -m "feat(admin): two-tab content shell with validation gate + save"
```

---

## Task 13: Whole-branch verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run everything**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test && npx tsc -b && npm run build`
Expected: all green.

- [ ] **Step 2: Rules suite under emulator** (PowerShell, main thread, `dangerouslyDisableSandbox: true`)

Run: `$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`
Expected: all rules tests PASS.

- [ ] **Step 3: Manual player smoke (puppeteer-core driving installed Chrome)**

Seed `localStorage['sentence-pet']` for a hatched pet, load the app, confirm the journey renders from the bundled `SEED` (offline path) and a drill round runs. Throwaway script; clean up after. Confirm no console errors and the journey/lessons match pre-migration behavior.

- [ ] **Step 4: Manual admin smoke**

With the emulator running + `VITE_USE_EMULATOR=true`, open `#admin`, sign in as the admin user, edit an item + a lesson's itemIds, observe the validation gate (break a lesson → Save disabled), Save, reload player and confirm live content swaps in.

- [ ] **Step 5: Final opus review + finish the branch**

Use `superpowers:requesting-code-review` (opus, whole branch), then `superpowers:finishing-a-development-branch` → PR → merge → `git checkout main && git pull --prune`.

---

## Self-review notes (already reconciled)

- **Spec coverage:** model/accessors (T1), validator (T2), seed+migration parity (T3), Firestore repo (T4), store+cache+hydrate (T5), rules (T6), player consumer refactor (T7), seed script+docs (T8), retire static + lazy admin (T9), Pool tab (T10), Journey tab (T11), shell+save+validation gate (T12), verification (T13). All spec sections mapped.
- **Type consistency:** `ContentBundle { pool: Record<string, DrillItem>; units: Unit[] }`, `Lesson { id, drill, level, itemIds, isCheckpoint?, title? }`, accessors `orderedUnits/findLesson/itemsForLesson/itemsForDrill/tutorialItem`, `validateContent(bundle) → {ok, errors}`, `fetchContent()/saveContent(bundle)`, `useContentStore {bundle,status,setBundle}`, `hydrateContent()/cachedBundle()/writeCache()/CACHE_KEY` — used identically across tasks.
- **No persist bump:** content lives in its own store/cache; player `lessonStars` keyed by lesson id (preserved by migration). gameStore persist `version` unchanged.
