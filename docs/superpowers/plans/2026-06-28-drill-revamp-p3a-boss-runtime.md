# Drill Revamp P3a — Boss Tiers Runtime + Course Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players walk **gated bosses** (review 2–3 prior units via sampled+pinned content, gate progression) and a **final boss** (reviews the course, completes it, unlocks the next course) — entirely reusing the existing boss-battle feature.

**Architecture:** Gated/final bosses already live on `Course.gates[]` / `Course.finalBoss` (typed in P1) but are invisible at runtime because `activeBundle(course)` strips them. We add a pure **journey resolver** (`resolveCourseBundle`) that expands a `Course` into a `ContentBundle` whose `units` include the real units **plus synthetic single-checkpoint "boss units"**: each gated boss is spliced in after its `afterUnitId` (fractional `order`), the final boss is appended last. Each synthetic boss lesson carries `isCheckpoint:true`, `boss: node.boss`, `onClear` (final only), and `itemIds` produced by a pure **review sampler** (pinned ids first, then dragdrop items sampled from `reviewsUnitIds`). Pointing `useContentStore.bundle` at the resolver makes the existing runtime — `findLesson`, `JourneyMap`, `journeyProgress` unlock gating, `startBoss` → `BossPrepScreen` → `BattleScreen` → `finishBoss` — see and drive these bosses **with no changes to those files**. Course completion adds a persisted `courseComplete` map (PERSIST_VERSION 14→15) set when a boss lesson carrying `onClear:'completeCourse'` is cleared; `CourseSelect` locks a course until its predecessor is complete.

**Tech Stack:** React 19, Zustand (+ persist middleware), TypeScript, Vitest + @testing-library/react, @dnd-kit (battle engine, unchanged).

---

## Scope & boundaries

**In P3a (this plan):**
1. Pure review sampler (`sampleReviewItems`).
2. Pure journey resolver (`resolveCourseBundle`) + `onClear` on `Lesson`.
3. Example gated + final bosses on a Course-shaped fallback (`SEED_COURSE`) so the runtime is playable/testable today.
4. Store wiring: fallback = `SEED_COURSE`, `bundle` = `resolveCourseBundle`.
5. Persisted `courseComplete` (v14→v15, full multi-point change).
6. `finishBoss` course-completion wiring.
7. `CourseSelect` predecessor-complete locking.
8. **Non-breaking** structural gate/final validation (placement, scope, reviews present, reviewCount sane).

**Explicitly NOT in P3a (deferred to P3b):**
- **`finalBoss`-present enforcement** in `validateCourse`. `validateCourse` is a load/cache gate (`load.ts:34`, `cache.ts:37`); enforcing it would reject every course lacking a final boss (incl. the migrated default course) and break loading. Handoff #5 says "add the check once P3 authors final bosses." P3b adds it after admin authoring + seed regen guarantee a final boss everywhere. The existing `validateCourse` test `base` (no `finalBoss`) asserts `.ok===true` — keep it green.
- Admin boss-config forms, Excel bulk import, `seed.ts` regen via export. (P3b.)
- Non-dragdrop boss content. The battle engine is dragdrop-only (`BossPrepScreen.tsx:21`, `BattleScreen.tsx:33` filter `isDragDrop`); the sampler returns dragdrop ids only.

## Landmines (carried from handoff — read before starting)
- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged — never stage/commit it.
- Branch is `journey-redesign` (an integration branch ~95 commits ahead of `main`); commit here, do NOT merge to main.
- `src/content/seed.ts` is generated — do not hand-edit it. P3a's example bosses go in a **new** `seedCourse.ts`, not `seed.ts`. (P3b regenerates `seed.ts`.)
- Per-user persisted state changes need ALL of: GameState, freshState, action, PersistedState Pick, selectPersisted, partialize (already covers via `...rest`), migrate backfill, PERSIST_VERSION bump, AND cloud-sync fixtures. `l1Mode` (v14) is the reference pattern — mirror it exactly.
- Reuse the boss-battle flow; do not rebuild it. The resolver feeds the existing flow; touch `model.ts`, `store.ts`, `gameStore.ts`, `CourseSelect.tsx`, `validate.ts` only.

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/content/review.ts` | Create | Pure `sampleReviewItems(course, node, rng)` + local rng shuffle. |
| `src/content/review.test.ts` | Create | Sampler unit tests. |
| `src/content/journey.ts` | Create | Pure `resolveCourseBundle(course, rng)` → ContentBundle with synthetic boss units. |
| `src/content/journey.test.ts` | Create | Resolver unit tests. |
| `src/content/model.ts` | Modify (Lesson) | Add `onClear?: 'completeCourse'` to `Lesson`. |
| `src/content/seedCourse.ts` | Create | `SEED_COURSE: Course` = default course + example gated/final bosses. |
| `src/content/seedCourse.test.ts` | Create | Asserts `SEED_COURSE` is valid + resolves to extra boss units. |
| `src/content/store.ts` | Modify | Fallback = `SEED_COURSE`; `bundle` via `resolveCourseBundle`. |
| `src/state/gameStore.ts` | Modify | Persisted `courseComplete` (v15) + `finishBoss` completion wiring. |
| `src/state/gameStore.test.ts` | Modify/Create | `finishBoss` sets `courseComplete` on final-boss clear. |
| `src/sync/mapping.test.ts` | Modify | Add `courseComplete` to the PersistedState fixture. |
| `src/components/courseLock.ts` | Create | Pure `isCourseLocked(index, i, complete)`. |
| `src/components/courseLock.test.ts` | Create | Lock helper tests. |
| `src/components/CourseSelect.tsx` | Modify | Compute `locked` from `courseComplete` + index order. |
| `src/content/validate.ts` | Modify | Non-breaking structural gate/final checks. |
| `src/content/validate.test.ts` | Modify | New structural-check tests. |

---

## Task 1: Review sampler (`sampleReviewItems`)

Pulls the dragdrop items a gated/final boss battles: pinned ids first (filtered to dragdrop that exist), then fill from the union of `reviewsUnitIds` units' lesson itemIds (dragdrop, deduped, minus pinned), shuffled by an injected RNG, up to `reviewCount`. Dragdrop-only because the battle engine is dragdrop-only.

**Files:**
- Create: `src/content/review.ts`
- Test: `src/content/review.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/review.test.ts
import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import type { BossNode } from './course';
import type { DragDropItem, FlashcardItem } from '../data/types';
import { sampleReviewItems } from './review';

const dd = (id: string): DragDropItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, slots: ['Pronoun'], answer: ['I'] });
const fc = (id: string): FlashcardItem =>
  ({ id, kind: 'flashcard', level: 1, front: 'a', back: 'b' });

function course(): Course {
  return {
    id: 'c', title: 'C',
    pool: { a: dd('a'), b: dd('b'), c: dd('c'), d: dd('d'), f: fc('f') },
    units: [
      { id: 'u1', title: 'U1', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l', drill: 'pattern', level: 1, itemIds: ['a', 'b', 'f'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['c'], isCheckpoint: true },
      ] },
      { id: 'u2', title: 'U2', emoji: '🌱', order: 2, lessons: [
        { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['d'], isCheckpoint: true },
      ] },
    ],
    gates: [],
  };
}

// Deterministic RNG: always 0 → shuffle keeps stable order.
const zero = () => 0;

describe('sampleReviewItems', () => {
  it('samples dragdrop ids from reviewsUnitIds, excluding non-dragdrop', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1'], reviewCount: 2,
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got).toHaveLength(2);
    expect(got).not.toContain('f'); // flashcard excluded
    got.forEach((id) => expect(['a', 'b', 'c']).toContain(id));
  });

  it('always includes pinned ids first, then fills the remainder', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1', 'u2'], reviewCount: 3, pinnedItemIds: ['d'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got[0]).toBe('d');             // pinned first
    expect(got).toHaveLength(3);
    expect(new Set(got).size).toBe(3);    // no duplicates (d not re-sampled)
  });

  it('returns all available when reviewCount is unset', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1', 'u2'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(new Set(got)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('drops pinned ids that are missing or non-dragdrop', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1'], reviewCount: 1, pinnedItemIds: ['ghost', 'f'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got).not.toContain('ghost');
    expect(got).not.toContain('f');
    expect(got).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/review.test.ts`
Expected: FAIL — `Cannot find module './review'` / `sampleReviewItems is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/content/review.ts
import type { Course, BossNode } from './course';
import { isDragDrop } from '../data/types';

/** Fisher–Yates using an injected RNG (deterministic in tests). Pure: copies input. */
function shuffleWith<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** True iff `id` resolves in the pool AND is a dragdrop item (the only kind the
 *  battle engine renders). Guards undefined before the isDragDrop type guard. */
function isReviewable(course: Course, id: string): boolean {
  const item = course.pool[id];
  return !!item && isDragDrop(item);
}

/**
 * Resolve the dragdrop item ids a gated/final boss battles.
 * Pinned ids (existing + dragdrop) come first and are always included; the
 * remainder is sampled from the union of `reviewsUnitIds` units' lesson itemIds
 * (dragdrop, deduped, minus pinned), shuffled by `rng`, capped at `reviewCount`.
 * With no `reviewCount`, every reviewable item is returned.
 */
export function sampleReviewItems(course: Course, node: BossNode, rng: () => number): string[] {
  const pinned = (node.pinnedItemIds ?? []).filter((id) => isReviewable(course, id));
  const pinnedSet = new Set(pinned);

  const reviewUnits = new Set(node.reviewsUnitIds ?? []);
  const candidates = [
    ...new Set(
      course.units
        .filter((u) => reviewUnits.has(u.id))
        .flatMap((u) => u.lessons.flatMap((l) => l.itemIds))
        .filter((id) => isReviewable(course, id) && !pinnedSet.has(id)),
    ),
  ];

  const want = node.reviewCount ?? pinned.length + candidates.length;
  const fill = shuffleWith(candidates, rng).slice(0, Math.max(0, want - pinned.length));
  return [...pinned, ...fill];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/review.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/review.ts src/content/review.test.ts
git commit -m "feat(content): pure review sampler for gated/final bosses"
```

---

## Task 2: Journey resolver (`resolveCourseBundle`) + `Lesson.onClear`

Expands a `Course` into a `ContentBundle` whose `units` include the real units plus synthetic single-checkpoint boss units: gated bosses spliced after their `afterUnitId` (order = that unit's order + 0.5), the final boss appended last (order = max + 1). Because everything downstream reads `ContentBundle` sorted by `order`, the existing unlock/placement/battle code drives these bosses unchanged.

**Files:**
- Modify: `src/content/model.ts` (add `onClear?` to `Lesson`, around line 22)
- Create: `src/content/journey.ts`
- Test: `src/content/journey.test.ts`

- [ ] **Step 1: Add `onClear` to the `Lesson` interface**

In `src/content/model.ts`, change the `Lesson` interface (currently lines 14–23) to add one field after `boss?`:

```ts
export interface Lesson {
  id: string;
  kind?: ContentKind;         // which activity screen renders + which pool items are valid
  drill: DrillType;           // dragdrop variant; only meaningful when kind === 'dragdrop' (validated in P2)
  level: number;
  itemIds: string[];
  isCheckpoint?: boolean;
  title?: string;
  boss?: CheckpointBoss;
  onClear?: 'completeCourse'; // set only on a synthetic final-boss lesson (see content/journey.ts)
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/content/journey.test.ts
import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import type { DragDropItem } from '../data/types';
import { resolveCourseBundle } from './journey';
import { orderedUnits, findLesson } from './model';

const dd = (id: string): DragDropItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, slots: ['Pronoun'], answer: ['I'] });

function course(): Course {
  return {
    id: 'c', title: 'C',
    pool: { a: dd('a'), b: dd('b'), c: dd('c') },
    units: [
      { id: 'u1', title: 'U1', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l', drill: 'pattern', level: 1, itemIds: ['a'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      ] },
      { id: 'u2', title: 'U2', emoji: '🌱', order: 2, lessons: [
        { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['c'], isCheckpoint: true },
      ] },
    ],
    gates: [
      { id: 'gate-1', title: 'Review 1', scope: 'gated', afterUnitId: 'u1',
        reviewsUnitIds: ['u1'], reviewCount: 1,
        boss: { tierId: 't1', element: 'water', name: 'Gate', rivalSprite: { species: 'water', stage: 'young' } } },
    ],
    finalBoss: { id: 'final-1', title: 'Final', scope: 'final', onClear: 'completeCourse',
      reviewsUnitIds: ['u1', 'u2'], reviewCount: 2,
      boss: { tierId: 't3', element: 'leaf', name: 'Final', rivalSprite: { species: 'leaf', stage: 'adult' } } },
  };
}

const zero = () => 0;

describe('resolveCourseBundle', () => {
  it('keeps the original pool and real units', () => {
    const b = resolveCourseBundle(course(), zero);
    expect(b.pool).toEqual(course().pool);
    expect(b.units.some((u) => u.id === 'u1')).toBe(true);
    expect(b.units.some((u) => u.id === 'u2')).toBe(true);
  });

  it('splices a gated boss unit after its afterUnitId by order', () => {
    const ordered = orderedUnits(resolveCourseBundle(course(), zero));
    const ids = ordered.map((u) => u.id);
    expect(ids.indexOf('u1')).toBeLessThan(ids.indexOf('boss-unit:gate-1'));
    expect(ids.indexOf('boss-unit:gate-1')).toBeLessThan(ids.indexOf('u2'));
  });

  it('appends the final boss unit last', () => {
    const ordered = orderedUnits(resolveCourseBundle(course(), zero));
    expect(ordered[ordered.length - 1].id).toBe('boss-unit:final-1');
  });

  it('makes the gated boss a findable checkpoint lesson carrying its boss + sampled items', () => {
    const b = resolveCourseBundle(course(), zero);
    const found = findLesson(b, 'gate-1');
    expect(found?.lesson.isCheckpoint).toBe(true);
    expect(found?.lesson.boss?.name).toBe('Gate');
    expect(found?.lesson.itemIds).toEqual(['a']); // sampled from u1 dragdrop
    expect(found?.lesson.onClear).toBeUndefined();
  });

  it('tags the final boss lesson with onClear=completeCourse', () => {
    const b = resolveCourseBundle(course(), zero);
    const found = findLesson(b, 'final-1');
    expect(found?.lesson.onClear).toBe('completeCourse');
    expect(found?.lesson.itemIds).toHaveLength(2);
  });

  it('is a no-op (only real units) when there are no gates or final boss', () => {
    const c = course();
    c.gates = [];
    delete c.finalBoss;
    const b = resolveCourseBundle(c, zero);
    expect(b.units.map((u) => u.id).sort()).toEqual(['u1', 'u2']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/content/journey.test.ts`
Expected: FAIL — `Cannot find module './journey'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/content/journey.ts
import type { Course, BossNode } from './course';
import { activeBundle } from './course';
import type { ContentBundle, Unit, Lesson } from './model';
import { sampleReviewItems } from './review';

/** Synthetic-unit id namespace, kept distinct from authored unit ids. */
export const BOSS_UNIT_PREFIX = 'boss-unit:';

/** Highest authored unit order (0 when there are no units). */
function maxOrder(course: Course): number {
  return course.units.reduce((m, u) => Math.max(m, u.order), 0);
}

/** Build a synthetic single-checkpoint unit wrapping a gated/final boss node.
 *  The lesson id IS the node id, so journey stars + completion key by node. */
function bossUnit(course: Course, node: BossNode, rng: () => number, order: number, emoji: string): Unit {
  const itemIds = sampleReviewItems(course, node, rng);
  const lesson: Lesson = {
    id: node.id,
    kind: 'dragdrop',          // battle engine is dragdrop-only
    drill: 'mixed',
    level: 1,
    itemIds,
    isCheckpoint: true,
    title: node.title,
    boss: node.boss,
    ...(node.onClear ? { onClear: node.onClear } : {}),
  };
  return { id: `${BOSS_UNIT_PREFIX}${node.id}`, title: node.title, emoji, order, lessons: [lesson] };
}

/**
 * Adapt a Course to the ContentBundle the player runtime consumes, materialising
 * gated/final bosses as synthetic checkpoint units. Gated bosses are placed after
 * their `afterUnitId` (order +0.5); the final boss is appended (max +1). All
 * downstream code sorts by `order`, so placement, unlock gating, and the battle
 * flow work without further changes. Pure given a deterministic `rng`.
 */
export function resolveCourseBundle(course: Course, rng: () => number): ContentBundle {
  const base = activeBundle(course);
  const extra: Unit[] = [];

  for (const gate of course.gates) {
    const after = course.units.find((u) => u.id === gate.afterUnitId);
    const order = (after?.order ?? maxOrder(course)) + 0.5;
    extra.push(bossUnit(course, gate, rng, order, '⚔️'));
  }
  if (course.finalBoss) {
    extra.push(bossUnit(course, course.finalBoss, rng, maxOrder(course) + 1, '👑'));
  }

  return { pool: base.pool, units: [...base.units, ...extra] };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/content/journey.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/model.ts src/content/journey.ts src/content/journey.test.ts
git commit -m "feat(content): journey resolver materialises gated/final bosses as synthetic units"
```

---

## Task 3: Example bosses on a Course fallback (`SEED_COURSE`)

`SEED` is a `ContentBundle` (pool+units only) and cannot carry gates/finalBoss. To make the runtime playable/testable today, build a Course-shaped fallback that wraps the migrated default course and attaches one example gated boss (after `u2-next-steps`, reviewing u1+u2) and a final boss (reviewing all three units). Uses real seed item ids (`l1-1`, `mx-l1-1`, etc., all dragdrop).

**Files:**
- Create: `src/content/seedCourse.ts`
- Test: `src/content/seedCourse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/seedCourse.test.ts
import { describe, it, expect } from 'vitest';
import { SEED_COURSE } from './seedCourse';
import { validateCourse } from './validate';
import { resolveCourseBundle } from './journey';
import { findLesson } from './model';

const zero = () => 0;

describe('SEED_COURSE', () => {
  it('is a valid course', () => {
    expect(validateCourse(SEED_COURSE)).toEqual({ ok: true, errors: [] });
  });

  it('has one gated boss and a final boss', () => {
    expect(SEED_COURSE.gates).toHaveLength(1);
    expect(SEED_COURSE.gates[0].scope).toBe('gated');
    expect(SEED_COURSE.finalBoss?.scope).toBe('final');
    expect(SEED_COURSE.finalBoss?.onClear).toBe('completeCourse');
  });

  it('resolves to extra playable boss units with non-empty sampled items', () => {
    const b = resolveCourseBundle(SEED_COURSE, zero);
    const gate = findLesson(b, SEED_COURSE.gates[0].id);
    const final = findLesson(b, SEED_COURSE.finalBoss!.id);
    expect(gate?.lesson.itemIds.length).toBeGreaterThan(0);
    expect(final?.lesson.itemIds.length).toBeGreaterThan(0);
    expect(final?.lesson.onClear).toBe('completeCourse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/seedCourse.test.ts`
Expected: FAIL — `Cannot find module './seedCourse'`.

- [ ] **Step 3: Write minimal implementation**

`bundleToDefaultCourse(SEED)` produces the default `Course` (id `'default'`, gates `[]`, no finalBoss); attach example bosses. Item ids referenced are real dragdrop seed items (verify against `src/content/seed.ts`: `mx-l1-1..5`, `gr-l1-1..5`, `l1-1..5` exist and are dragdrop).

```ts
// src/content/seedCourse.ts
import type { Course } from './course';
import { SEED } from './seed';
import { bundleToDefaultCourse } from './migrate';

/**
 * P3a fallback course: the migrated default course plus hand-authored example
 * gated + final bosses so the new boss-tier runtime is playable before P3b adds
 * admin authoring + seed regen. The gate sits after Next Steps and reviews the
 * first two units; the final boss reviews all three and completes the course.
 * All referenced item ids are dragdrop items in src/content/seed.ts.
 */
export const SEED_COURSE: Course = (() => {
  const base = bundleToDefaultCourse(SEED);
  return {
    ...base,
    gates: [
      {
        id: 'gate-midcourse',
        title: 'Midway Review',
        scope: 'gated',
        afterUnitId: 'u2-next-steps',
        reviewsUnitIds: ['u1-basics', 'u2-next-steps'],
        reviewCount: 5,
        pinnedItemIds: ['mx-l1-1'],
        boss: { tierId: 'tier-2', element: 'water', name: 'Riptide Reviewer', rivalSprite: { species: 'water', stage: 'adult' } },
      },
    ],
    finalBoss: {
      id: 'final-course',
      title: 'Grand Finale',
      scope: 'final',
      onClear: 'completeCourse',
      reviewsUnitIds: ['u1-basics', 'u2-next-steps', 'u3-challenge'],
      reviewCount: 6,
      pinnedItemIds: ['gr-l1-1'],
      boss: { tierId: 'tier-3', element: 'leaf', name: 'Course Champion', rivalSprite: { species: 'leaf', stage: 'adult' } },
    },
  };
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/seedCourse.test.ts`
Expected: PASS (3 tests). If `validateCourse` fails, confirm the referenced item ids exist and are dragdrop in `src/content/seed.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/content/seedCourse.ts src/content/seedCourse.test.ts
git commit -m "feat(content): example gated + final bosses on SEED_COURSE fallback"
```

---

## Task 4: Wire the resolver into the content store

Point `useContentStore.bundle` at `resolveCourseBundle(course, Math.random)` and use `SEED_COURSE` as the fallback, so `JourneyMap`, `findLesson`, and the battle flow see gated/final bosses. `activeBundle` stays (the resolver builds on it).

**Files:**
- Modify: `src/content/store.ts`
- Test: `src/content/store.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// src/content/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useContentStore } from './store';
import { SEED_COURSE } from './seedCourse';

describe('useContentStore bundle resolution', () => {
  beforeEach(() => {
    useContentStore.getState().setCourse(SEED_COURSE, 'fallback');
  });

  it('exposes synthetic boss units in the active bundle', () => {
    const units = useContentStore.getState().bundle.units;
    const ids = units.map((u) => u.id);
    expect(ids).toContain('boss-unit:gate-midcourse');
    expect(ids).toContain('boss-unit:final-course');
  });

  it('keeps the gated/final boss lessons findable as checkpoints', () => {
    const units = useContentStore.getState().bundle.units;
    const finalUnit = units.find((u) => u.id === 'boss-unit:final-course');
    expect(finalUnit?.lessons[0].isCheckpoint).toBe(true);
    expect(finalUnit?.lessons[0].onClear).toBe('completeCourse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/store.test.ts`
Expected: FAIL — bundle has only authored units (no `boss-unit:*`).

- [ ] **Step 3: Edit the store**

In `src/content/store.ts`: swap the fallback to `SEED_COURSE`, and replace both `activeBundle(...)` bundle assignments with `resolveCourseBundle(..., Math.random)`. Final file:

```ts
import { create } from 'zustand';
import type { ContentBundle } from './model';
import type { Course } from './course';
import { resolveCourseBundle } from './journey';
import { SEED_COURSE } from './seedCourse';
import { bundleToDefaultCourse } from './migrate';
import { cachedCourse } from './cache';

export type ContentStatus = 'fallback' | 'live';

interface ContentState {
  course: Course | null;
  activeCourseId: string | null;
  status: ContentStatus;
  /** Active course resolved to the legacy ContentBundle consumed by model/UI,
   *  with gated/final bosses materialised as synthetic checkpoint units. */
  bundle: ContentBundle;
  setCourse: (course: Course, status: ContentStatus) => void;
  /** Compat shim: legacy callers (hydrateContent, AdminShell) that pass a raw
   *  ContentBundle are wrapped into a default Course and forwarded to setCourse. */
  setBundle: (bundle: ContentBundle, status: ContentStatus) => void;
}

const firstCourse: Course = cachedCourse() ?? SEED_COURSE;

/** Module-level store so React + gameStore read the active course synchronously.
 *  `bundle` is kept in sync with `course` on every setCourse. Resolution samples
 *  boss review content once per setCourse (stable for the session). */
export const useContentStore = create<ContentState>((set, get) => ({
  course: firstCourse,
  activeCourseId: firstCourse.id,
  status: 'fallback',
  bundle: resolveCourseBundle(firstCourse, Math.random),
  setCourse: (course, status) =>
    set({ course, activeCourseId: course.id, status, bundle: resolveCourseBundle(course, Math.random) }),
  setBundle: (bundle, status) =>
    get().setCourse(bundleToDefaultCourse(bundle), status),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/content/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full content + admin suites for regressions**

Run: `npm test -- src/content src/components/admin`
Expected: PASS. `setBundle` (admin save path) now resolves a default course with no gates/final → resolver is a no-op there; behaviour unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/content/store.ts src/content/store.test.ts
git commit -m "feat(content): resolve gated/final bosses into the active bundle"
```

---

## Task 5: Persist `courseComplete` (PERSIST_VERSION 14→15)

Add a per-player `courseComplete: Record<string, boolean>` following the `l1Mode` (v14) reference pattern across every persistence seam. This task only adds the field + migration + fixtures; `finishBoss` writes it in Task 6.

**Files:**
- Modify: `src/state/gameStore.ts`
- Modify: `src/sync/mapping.test.ts`

- [ ] **Step 1: Update the cloud-sync mapping fixture (failing test first)**

In `src/sync/mapping.test.ts`, add `courseComplete` to the `sample: PersistedState` fixture (after `coins`). This will fail to type-check / round-trip until the field exists on `PersistedState`.

```ts
  coins: 7,
  courseComplete: { 'course-1': true },
```

- [ ] **Step 2: Run the mapping test to verify it fails**

Run: `npm test -- src/sync/mapping.test.ts`
Expected: FAIL — `courseComplete` is not a known property of `PersistedState` (type error / missing in round-trip).

- [ ] **Step 3: Thread `courseComplete` through gameStore — six edits**

In `src/state/gameStore.ts`:

(a) `GameState` interface — add after `journey` (line ~68):
```ts
  journey: { lessonStars: Record<string, number> };
  courseComplete: Record<string, boolean>; // per-player completed courses (v15); unlocks the next course
```

(b) `PERSIST_VERSION` (line 107):
```ts
export const PERSIST_VERSION = 15;
```

(c) `PersistedState` Pick (lines 110–114) — add `'courseComplete'`:
```ts
export type PersistedState = Pick<
  GameState,
  | 'screen' | 'pets' | 'activePetId' | 'coins' | 'courseComplete' | 'inventory' | 'selectedDrill'
  | 'selectedLevel' | 'lastReward' | 'lastPull' | 'owned' | 'activeBackground' | 'activeTrack' | 'journey' | 'audio' | 'l1Mode'
>;
```

(d) `selectPersisted` (lines 117–135) — add `courseComplete`:
```ts
    coins: s.coins,
    courseComplete: s.courseComplete,
```

(e) `freshState` (lines 174–198) — add after `journey`:
```ts
    journey: { lessonStars: {} as Record<string, number> },
    courseComplete: {} as Record<string, boolean>,
```

(f) `migrate` — extend the `st` type union (after `l1Mode?: L1Mode;` at line 468) and the `base` object (after the `l1Mode` backfill at line 485), and add a comment to the version log (after line 450):
```ts
              l1Mode?: L1Mode;
              courseComplete?: Record<string, boolean>;
```
```ts
          // v13->v14: backfill the per-user TH/ENG language-helper toggle (default 'TH').
          l1Mode: (st as { l1Mode?: L1Mode }).l1Mode ?? 'TH',
          // v14->v15: backfill per-player course-completion map (default {}).
          courseComplete: (st as { courseComplete?: Record<string, boolean> }).courseComplete ?? {},
```
```ts
      // v13->v14 backfills l1Mode (per-user TH/ENG language-helper toggle; default 'TH').
      // v14->v15 backfills courseComplete (per-player completed-course map; default {}).
```

> `partialize` needs no change: `courseComplete` is not transient, so it falls through the `...rest` catch-all. `toCloud`/`fromCloud` in `src/sync/mapping.ts` operate on `PersistedState` generically and pick it up automatically.

- [ ] **Step 4: Run mapping + persistence tests**

Run: `npm test -- src/sync src/state`
Expected: PASS. If `src/sync/reconcile.test.ts` or `src/sync/cloudSync.test.ts` construct a full `PersistedState` and now fail to compile, add `courseComplete: {}` to those fixtures too.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/sync/mapping.test.ts
git commit -m "feat(state): persist courseComplete map (PERSIST_VERSION 14->15)"
```

---

## Task 6: Wire course completion in `finishBoss`

When a cleared boss lesson carries `onClear:'completeCourse'` and a course is active, mark that course complete.

**Files:**
- Modify: `src/state/gameStore.ts` (`finishBoss`, win branch, lines 236–285)
- Test: `src/state/gameStore.test.ts` (add to existing, or create)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/gameStore.test.ts  (add this describe block; keep existing imports/tests)
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { useContentStore } from '../content/store';
import { SEED_COURSE } from '../content/seedCourse';

describe('finishBoss course completion', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
    useContentStore.getState().setCourse(SEED_COURSE, 'fallback');
  });

  it('marks the active course complete when clearing a final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBe(true);
  });

  it('does not complete the course when clearing a non-final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'gate-midcourse' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });

  it('does not complete on a loss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(false);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/gameStore.test.ts`
Expected: FAIL — `courseComplete['default']` is `undefined` after clearing the final boss.

- [ ] **Step 3: Edit the `finishBoss` win branch**

In `src/state/gameStore.ts`, inside `finishBoss`, after the existing `const lvl = ...` line (249) add the completion check, and add `courseComplete` to the returned object (after `journey:` on line 280):

```ts
          const lvl = findLesson(useContentStore.getState().bundle, lessonId)?.lesson.level ?? 1;
          const clearedLesson = findLesson(useContentStore.getState().bundle, lessonId)?.lesson;
          const completesCourse = clearedLesson?.onClear === 'completeCourse' && !!s.currentCourseId;
          const courseComplete = completesCourse
            ? { ...s.courseComplete, [s.currentCourseId as string]: true }
            : s.courseComplete;
```

```ts
            journey: { ...s.journey, lessonStars: { ...s.journey.lessonStars, [lessonId]: Math.max(s.journey.lessonStars[lessonId] ?? 0, 3) } },
            courseComplete,
            currentBossLessonId: null,
```

> The loss branch already returns early without `courseComplete`, so a loss leaves it untouched — no change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/state/gameStore.test.ts`
Expected: PASS (3 new tests + existing).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(state): complete the active course on final-boss clear"
```

---

## Task 7: Lock courses until the predecessor is complete

`CourseSelect` already renders `c.locked` (disabled + 🔒). Compute it client-side: a course is locked iff it is not the first in index order and the previous course is not in `courseComplete`.

**Files:**
- Create: `src/components/courseLock.ts`
- Test: `src/components/courseLock.test.ts`
- Modify: `src/components/CourseSelect.tsx`

- [ ] **Step 1: Write the failing test for the pure helper**

```ts
// src/components/courseLock.test.ts
import { describe, it, expect } from 'vitest';
import type { CourseIndexEntry } from '../content/course';
import { isCourseLocked } from './courseLock';

const idx: CourseIndexEntry[] = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('isCourseLocked', () => {
  it('never locks the first course', () => {
    expect(isCourseLocked(idx, 0, {})).toBe(false);
  });
  it('locks a course whose predecessor is not complete', () => {
    expect(isCourseLocked(idx, 1, {})).toBe(true);
    expect(isCourseLocked(idx, 2, { a: true })).toBe(true);
  });
  it('unlocks a course once its predecessor is complete', () => {
    expect(isCourseLocked(idx, 1, { a: true })).toBe(false);
    expect(isCourseLocked(idx, 2, { a: true, b: true })).toBe(false);
  });
  it('respects a server-set locked flag', () => {
    const withLocked: CourseIndexEntry[] = [{ id: 'a', title: 'A', locked: true }];
    expect(isCourseLocked(withLocked, 0, {})).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/courseLock.test.ts`
Expected: FAIL — `Cannot find module './courseLock'`.

- [ ] **Step 3: Write the helper**

```ts
// src/components/courseLock.ts
import type { CourseIndexEntry } from '../content/course';

/** A course is locked if a server flag says so, or if it is not the first entry
 *  and its predecessor (by index order) is not yet complete. The first course is
 *  always playable. `complete` is the player's courseComplete map. */
export function isCourseLocked(
  index: CourseIndexEntry[],
  i: number,
  complete: Record<string, boolean>,
): boolean {
  if (index[i]?.locked) return true;
  if (i <= 0) return false;
  return !complete[index[i - 1].id];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/courseLock.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Use the helper in `CourseSelect`**

In `src/components/CourseSelect.tsx`: read `courseComplete` from the game store, compute `locked` per entry via `isCourseLocked`, and use that instead of the raw `c.locked`. Replace the component body (lines 1–43):

```tsx
import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { loadCoursesIndex } from '../content/load';
import type { CourseIndexEntry } from '../content/course';
import { isCourseLocked } from './courseLock';

/** First screen of the journey flow: pick a course, then enter its unit map. */
export function CourseSelect() {
  const selectCourse = useGameStore((s) => s.selectCourse);
  const courseComplete = useGameStore((s) => s.courseComplete);
  const [courses, setCourses] = useState<CourseIndexEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCoursesIndex().then((idx) => { if (alive) setCourses(idx); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Choose a course</h1>
      {courses === null && <p className="opacity-60">Loading…</p>}
      {courses?.length === 0 && <p className="opacity-60">No courses yet.</p>}
      <div className="flex flex-col gap-3">
        {courses?.map((c, i) => {
          const locked = isCourseLocked(courses, i, courseComplete);
          return (
            <button
              key={c.id}
              type="button"
              disabled={locked}
              onClick={() => selectCourse(c.id)}
              aria-label={locked ? `${c.title} - locked` : c.title}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left disabled:opacity-40"
            >
              <span aria-hidden="true" className="text-2xl">{c.emoji ?? '📘'}</span>
              <span className="flex flex-col">
                <span className="font-semibold">{c.title}</span>
                {c.l1Ready && <span className="text-xs opacity-60"><span aria-hidden="true">🇹🇭</span> L1-ready</span>}
              </span>
              {locked && <span aria-hidden="true" className="ml-auto text-sm opacity-60">🔒</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run any CourseSelect test + the helper test**

Run: `npm test -- src/components/courseLock.test.ts src/components/CourseSelect`
Expected: PASS. If a `CourseSelect.test.tsx` exists and asserts unlocked rendering, ensure its fixture's first course stays clickable (the first entry is never locked).

- [ ] **Step 7: Commit**

```bash
git add src/components/courseLock.ts src/components/courseLock.test.ts src/components/CourseSelect.tsx
git commit -m "feat(course): lock courses until the predecessor is complete"
```

---

## Task 8: Non-breaking structural validation for gates/final

Harden `validateCourse` with placement/scope/review checks that only fire for **present** gates/final boss — so finalBoss-absent courses (incl. the migrated default) still validate and keep loading. (finalBoss-present enforcement is P3b.)

**Files:**
- Modify: `src/content/validate.ts` (`validateCourse`, lines 80–98)
- Test: `src/content/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('validateCourse', ...)` block in `src/content/validate.test.ts`:

```ts
  it('still accepts a course with no final boss (P3a does not enforce presence)', () => {
    expect(validateCourse(base).ok).toBe(true);
  });
  it('rejects a gated boss with no afterUnitId', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', reviewsUnitIds: ['u'], boss: sampleBoss }],
    };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/afterUnitId/);
  });
  it('rejects a gated boss whose afterUnitId is unknown', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'nope', reviewsUnitIds: ['u'], boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/afterUnitId/);
  });
  it('rejects a gated/final boss with empty reviewsUnitIds', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u', reviewsUnitIds: [], boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/reviews no units/);
  });
  it('rejects a reviewCount below 1', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u', reviewsUnitIds: ['u'], reviewCount: 0, boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/reviewCount/);
  });
  it('rejects a final boss missing onClear=completeCourse', () => {
    const bad: Course = {
      ...base,
      finalBoss: { id: 'fb', title: 'F', scope: 'final', reviewsUnitIds: ['u'], boss: sampleBoss },
    };
    expect(validateCourse(bad).errors.join()).toMatch(/onClear/);
  });
```

> Note: `base.units[0].id === 'u'` in the existing fixture (line 122), so `reviewsUnitIds: ['u']` resolves.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/content/validate.test.ts`
Expected: FAIL on the new cases (no `afterUnitId`/`reviews no units`/`reviewCount`/`onClear` errors produced yet). Existing cases still pass.

- [ ] **Step 3: Extend `validateCourse`**

In `src/content/validate.ts`, replace the gate/final loop (lines 86–95) with checks that include placement/scope/review validation. Keep the existing unknown-unit / unknown-pin checks:

```ts
  const unitIds = new Set(course.units.map((u) => u.id));
  const reviewBosses = [
    ...course.gates.map((b) => ({ b, isFinal: false })),
    ...(course.finalBoss ? [{ b: course.finalBoss, isFinal: true }] : []),
  ];
  for (const { b, isFinal } of reviewBosses) {
    // Existing reference checks.
    for (const uid of b.reviewsUnitIds ?? []) {
      if (!unitIds.has(uid)) push(`boss ${b.id} reviews unknown unit ${uid}`);
    }
    for (const pid of b.pinnedItemIds ?? []) {
      if (!course.pool[pid]) push(`boss ${b.id} pins unknown item ${pid}`);
    }
    // Review bosses must actually review something.
    if (!b.reviewsUnitIds || b.reviewsUnitIds.length === 0) push(`boss ${b.id} reviews no units`);
    if (b.reviewCount !== undefined && b.reviewCount < 1) push(`boss ${b.id} reviewCount must be >= 1`);
    // Scope-specific structure.
    if (isFinal) {
      if (b.scope !== 'final') push(`final boss ${b.id} must have scope 'final'`);
      if (b.onClear !== 'completeCourse') push(`final boss ${b.id} must set onClear 'completeCourse'`);
    } else {
      if (b.scope !== 'gated') push(`gate ${b.id} must have scope 'gated'`);
      if (!b.afterUnitId) push(`gate ${b.id} missing afterUnitId`);
      else if (!unitIds.has(b.afterUnitId)) push(`gate ${b.id} afterUnitId ${b.afterUnitId} is unknown`);
    }
  }
```

- [ ] **Step 4: Run the validate suite**

Run: `npm test -- src/content/validate.test.ts`
Expected: PASS (existing + new). Confirm the original `base` (no finalBoss) case stays `.ok === true`.

- [ ] **Step 5: Verify `SEED_COURSE` still validates**

Run: `npm test -- src/content/seedCourse.test.ts`
Expected: PASS — the example bosses satisfy the new checks (gate has `afterUnitId`+`scope:'gated'`; final has `onClear`+`scope:'final'`; both have non-empty `reviewsUnitIds` and `reviewCount >= 1`).

- [ ] **Step 6: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(content): structural validation for gated/final boss placement"
```

---

## Task 9: Whole-phase verification + handoff

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS (P2 baseline was 775; this phase adds new tests, so expect ≥ 775 passing, 0 failing). Investigate any failure before proceeding — especially cloud-sync fixtures that build a full `PersistedState`.

- [ ] **Step 2: Type-check + production build**

Run: `npm run build`
Expected: clean (no TS errors). The `screenKeyAndNode` 7-positional-param signature is unchanged in P3a.

- [ ] **Step 3: Lint (if configured)**

Run: `npm run lint`
Expected: clean. (Skip if no `lint` script.)

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Play as guest → PetRoom → Play ▶ → pick the Beginner course. On the journey:
- Clear Basics + Next Steps and their checkpoints; confirm the **⚔️ Midway Review** gate appears after Next Steps and that **Challenge stays locked** until the gate is cleared.
- Beat the gate (drag-drop battle); confirm Challenge unlocks.
- Clear Challenge's checkpoint; confirm the **👑 Grand Finale** appears last. Beat it.
- Return to course select; confirm course completion persisted (reload the page; `courseComplete['default']` survives). If a second course existed, it would now be unlocked.

- [ ] **Step 5: Confirm `firebase.json` is NOT staged**

Run: `git status`
Expected: `firebase.json` shows as modified-but-unstaged and appears in **no** commit from this phase. If it was staged, unstage it: `git restore --staged firebase.json`.

- [ ] **Step 6: Write the P3b handoff**

Create `docs/superpowers/plans/2026-06-28-drill-revamp-p3b-handoff.md` summarising: P3a shipped (runtime + completion); remaining P3 scope = admin boss-config forms (checkpoint/gated/final), Excel bulk import (xlsx, preview-then-commit), `seed.ts` regen via admin export, and **finalBoss-present enforcement in `validateCourse`** (now safe once authoring guarantees a final boss everywhere — but coordinate with `bundleToDefaultCourse`, which still produces no finalBoss, so either synthesize a default final boss there or ensure migrated courses are never re-validated on load). Note that `SEED_COURSE` (P3a hand-authored) should be folded into the regenerated `seed.ts`/course seed and then removed.

- [ ] **Step 7: Commit the handoff**

```bash
git add docs/superpowers/plans/2026-06-28-drill-revamp-p3b-handoff.md
git commit -m "docs: P3b handoff (admin boss forms + Excel import + seed regen + finalBoss enforcement)"
```

---

## Self-Review (completed against the spec + handoff)

**Spec coverage (P3 items in this plan's scope):**
- §3.2 gated boss (sampled `reviewCount` from `reviewsUnitIds`, `pinnedItemIds` always included, placed via `afterUnitId`, gates progression) → Tasks 1, 2, 4 (gating falls out of synthetic-unit `order` + existing `journeyProgress`).
- §7 final boss `onClear:'completeCourse'` → per-player `courseComplete` → unlock next course → Tasks 2, 5, 6, 7.
- §9 kind-aware validate, gate/final reference + structure checks → Task 8 (presence enforcement deferred to P3b, per handoff #5 and the load-gate constraint).
- Reuse existing boss-battle feature → resolver feeds the unchanged `startBoss`/`BossPrepScreen`/`BattleScreen`/`finishBoss` pipeline.

**Deferred to P3b (out of scope, documented):** admin boss-config forms (§6), Excel import (§8), `seed.ts` regen, `finalBoss`-present enforcement (§9 / handoff #5).

**Placeholder scan:** none — every code step shows complete code; every run step shows the command + expected result.

**Type consistency:** `sampleReviewItems(course, node, rng)` (Task 1) is called by `bossUnit` in `resolveCourseBundle` (Task 2). `resolveCourseBundle(course, rng)` is called by the store (Task 4) and tests (Tasks 2, 3). `Lesson.onClear` (Task 2) is read by `finishBoss` (Task 6) and set by `bossUnit` (Task 2). `courseComplete` field name is identical across GameState/freshState/PersistedState/selectPersisted/migrate (Task 5), `finishBoss` (Task 6), and `CourseSelect`/`isCourseLocked` (Task 7). `BOSS_UNIT_PREFIX` = `'boss-unit:'` matches the ids asserted in Tasks 2 and 4 tests.
