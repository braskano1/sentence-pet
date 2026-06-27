# Drill Revamp — P1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure content into a course-based model (Course → Units → kind-tagged Lesson nodes) with per-course Firestore persistence, migrate existing content into a default course, add a course-select screen, and route player lessons by `kind` — while keeping today's drag-drop drill the only functional activity (parity).

**Architecture:** Additive, backward-compatible type changes. `Lesson` gains `kind`, `Unit` gains `l1Enabled`, and a new `Course` wraps the existing `{ pool, units }` bundle with metadata + boss config. The content store keeps exposing `bundle` (the active course's `{ pool, units }`) so existing consumers (`model.ts`, `App.tsx`, `JourneyMap`) need minimal change. Persistence moves to `content/courses/{id}` + a `content/coursesIndex`, with a one-shot legacy read fallback that migrates the old two-doc layout into a `default` course. The player flow gains a `pickCourse` screen before the journey; lesson rendering branches on `lesson.kind` — `dragdrop` renders the existing `DrillScreen`, every other kind renders a temporary "coming soon" placeholder (built out in P2).

**Tech Stack:** TypeScript, React, Zustand, Firebase Firestore, Vitest (`npm test`), Vite (`npm run build`).

**Spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md` (this plan implements §10 phase P1 only; P2/P3 get their own plans in fresh sessions).

---

## File Structure

**New files**
- `src/content/course.ts` — `Course`, `BossNode`, `CourseIndexEntry`, `ContentKind`, helpers (`activeBundle`, `courseUnits`).
- `src/content/migrate.ts` — `bundleToDefaultCourse(bundle)` legacy → Course.
- `src/components/CourseSelect.tsx` — the new first screen (pick a course).
- `src/components/ComingSoon.tsx` — placeholder for not-yet-built lesson kinds.
- Test files: `src/content/course.test.ts`, `src/content/migrate.test.ts`, `src/content/validate.test.ts` (extend if exists), `src/content/courseStore.test.ts`.

**Modified files**
- `src/data/types.ts` — add `ContentKind`, `hidePos?` on `DrillItem`, `'pickCourse'` screen.
- `src/content/model.ts` — `kind` on `Lesson`, `l1Enabled` on `Unit`.
- `src/content/validate.ts` — kind-aware item checks; validate a `Course`.
- `src/firebase/content.ts` — `fetchCoursesIndex`, `fetchCourse`, `saveCourse`, legacy fallback.
- `src/content/store.ts` — course-aware store (index, activeCourseId, course; `bundle` derived).
- `src/content/load.ts` — course-aware cache + `hydrateCourses`.
- `src/state/gameStore.ts` — `currentCourseId`, `selectCourse`, default screen routing.
- `src/App.tsx` — `pickCourse` route + kind-routed lesson rendering.
- `src/content/seed.ts` — regenerated as a default Course (keep as generated snapshot).

---

## Task 1: Add `ContentKind` and kind-tagging to the item/lesson types

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/content/model.ts`
- Test: `src/content/model.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `src/content/model.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Lesson, Unit } from './model';

describe('kind-tagged model', () => {
  it('a Lesson carries a ContentKind and a Unit carries l1Enabled', () => {
    const lesson: Lesson = { id: 'x', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: ['a'] };
    const unit: Unit = { id: 'u', title: 'U', emoji: '🦊', order: 0, l1Enabled: false, lessons: [lesson] };
    expect(lesson.kind).toBe('dragdrop');
    expect(unit.l1Enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/model.test.ts`
Expected: FAIL — `Object literal may only specify known properties` / `kind` and `l1Enabled` not on the types.

- [ ] **Step 3: Implement the type changes**

In `src/data/types.ts`, after the `DrillType` line, add:

```ts
/** The five activity families a unit node can be. Boss is not a pool item. */
export type ContentKind = 'flashcard' | 'matching' | 'dragdrop' | 'fillblank' | 'boss';
```

In the same file, add `hidePos?` to `DrillItem` (admin difficulty, used in P2; declared now so the type is stable):

```ts
export interface DrillItem {
  id: string;
  drill: DrillType;
  level: number;
  thaiHint: string;
  slots: PosLabel[];
  answer: string[];
  distractors?: string[];
  traps?: GrammarTrap[];
  hidePos?: boolean;      // drag-drop difficulty: hide POS label/tint in slots (rendered in P2)
}
```

Add `'pickCourse'` to the `Screen` union:

```ts
export type Screen = 'egg' | 'petRoom' | 'pickCourse' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution' | 'bossPrep' | 'battle';
```

In `src/content/model.ts`, import `ContentKind` and add `kind` to `Lesson`, `l1Enabled` to `Unit`:

```ts
import type { DrillItem, DrillType, Species, PetStage, ContentKind } from '../data/types';
```

```ts
export interface Lesson {
  id: string;
  kind: ContentKind;          // which activity screen renders + which pool items are valid
  drill: DrillType;           // dragdrop variant (only meaningful when kind === 'dragdrop')
  level: number;
  itemIds: string[];
  isCheckpoint?: boolean;
  title?: string;
  boss?: CheckpointBoss;
}
```

```ts
export interface Unit {
  id: string;
  title: string;
  emoji: string;
  order: number;
  l1Enabled: boolean;         // admin backend flag — gates the TH/ENG toggle for this unit
  lessons: Lesson[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/content/model.ts src/content/model.test.ts
git commit -m "feat(content): add ContentKind, Lesson.kind, Unit.l1Enabled"
```

---

## Task 2: Course / BossNode model

**Files:**
- Create: `src/content/course.ts`
- Test: `src/content/course.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/content/course.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import { activeBundle, courseUnits } from './course';

const course: Course = {
  id: 'default',
  title: 'Beginner',
  pool: { a: { id: 'a', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{ id: 'u1', title: 'U1', emoji: '🦊', order: 1, l1Enabled: false, lessons: [] },
          { id: 'u0', title: 'U0', emoji: '🐣', order: 0, l1Enabled: false, lessons: [] }],
  gates: [],
};

describe('course helpers', () => {
  it('activeBundle exposes the course pool + units as a ContentBundle', () => {
    const b = activeBundle(course);
    expect(b.pool).toBe(course.pool);
    expect(b.units).toBe(course.units);
  });
  it('courseUnits returns units sorted by order', () => {
    expect(courseUnits(course).map((u) => u.id)).toEqual(['u0', 'u1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/course.test.ts`
Expected: FAIL — cannot find module `./course`.

- [ ] **Step 3: Implement `src/content/course.ts`**

```ts
import type { DrillItem, ContentKind, Species, PetStage } from '../data/types';
import type { ContentBundle, Unit } from './model';

/** A boss node. `checkpoint` is per-unit (today). `gated` reviews 2–3 prior
 *  units. `final` ends the course. Review bosses sample items from reviewsUnitIds. */
export type BossScope = 'checkpoint' | 'gated' | 'final';

export interface BossNode {
  id: string;
  title: string;
  scope: BossScope;
  afterUnitId?: string;        // gated: which unit this gate sits after (trail placement)
  reviewsUnitIds?: string[];   // gated/final: units sourced for review items
  reviewCount?: number;        // gated/final: how many review items to sample
  pinnedItemIds?: string[];    // gated/final: always-included items; rest sampled
  boss: {                      // reuse the existing boss-battle config shape
    tierId: string;
    element: Species;
    name: string;
    rivalSprite: { species: Species; stage: Exclude<PetStage, 'egg'> };
  };
  onClear?: 'completeCourse';  // final only
}

/** A course: a shared item pool, ordered units, multi-unit gates, and a final boss.
 *  finalBoss is optional in P1 (migrated legacy courses have none); P3 enforces it. */
export interface Course {
  id: string;
  title: string;
  emoji?: string;
  l1Ready?: boolean;
  pool: Record<string, DrillItem>;
  units: Unit[];
  gates: BossNode[];
  finalBoss?: BossNode;
}

/** Lightweight entry for the course-select screen (no pool/units payload). */
export interface CourseIndexEntry {
  id: string;
  title: string;
  emoji?: string;
  l1Ready?: boolean;
  locked?: boolean;
}

/** Adapt a Course to the legacy ContentBundle the player/model code consumes. */
export function activeBundle(course: Course): ContentBundle {
  return { pool: course.pool, units: course.units };
}

/** Units sorted by order ascending (defensive copy). */
export function courseUnits(course: Course): Unit[] {
  return [...course.units].sort((a, b) => a.order - b.order);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/course.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/course.ts src/content/course.test.ts
git commit -m "feat(content): add Course / BossNode / CourseIndexEntry model"
```

---

## Task 3: Legacy bundle → default Course migration

**Files:**
- Create: `src/content/migrate.ts`
- Test: `src/content/migrate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/content/migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bundleToDefaultCourse, DEFAULT_COURSE_ID } from './migrate';
import type { ContentBundle } from './model';

const legacy: ContentBundle = {
  pool: { a: { id: 'a', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{
    id: 'u0', title: 'U0', emoji: '🐣', order: 0,
    // legacy units/lessons have neither l1Enabled nor kind:
    lessons: [{ id: 'l0', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  } as any],
};

describe('bundleToDefaultCourse', () => {
  it('wraps a legacy bundle into a default course', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.id).toBe(DEFAULT_COURSE_ID);
    expect(c.pool).toBe(legacy.pool);
    expect(c.gates).toEqual([]);
    expect(c.finalBoss).toBeUndefined();
  });
  it('defaults l1Enabled=false on units and kind=dragdrop on lessons', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.units[0].l1Enabled).toBe(false);
    expect(c.units[0].lessons[0].kind).toBe('dragdrop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/migrate.test.ts`
Expected: FAIL — cannot find module `./migrate`.

- [ ] **Step 3: Implement `src/content/migrate.ts`**

```ts
import type { ContentBundle } from './model';
import type { Course } from './course';

export const DEFAULT_COURSE_ID = 'default';

/** Wrap the legacy two-doc bundle into a single default Course.
 *  Units missing l1Enabled default to false; lessons missing kind default to
 *  'dragdrop' (legacy content was all slot-fill). Idempotent. */
export function bundleToDefaultCourse(bundle: ContentBundle): Course {
  return {
    id: DEFAULT_COURSE_ID,
    title: 'Beginner Course',
    emoji: '📘',
    pool: bundle.pool,
    units: bundle.units.map((u) => ({
      ...u,
      l1Enabled: u.l1Enabled ?? false,
      lessons: u.lessons.map((l) => ({ ...l, kind: l.kind ?? 'dragdrop' })),
    })),
    gates: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/migrate.ts src/content/migrate.test.ts
git commit -m "feat(content): migrate legacy bundle into a default Course"
```

---

## Task 4: Kind-aware validation of a Course

**Files:**
- Modify: `src/content/validate.ts`
- Test: `src/content/validate.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/extend `src/content/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateCourse } from './validate';
import type { Course } from './course';

const base: Course = {
  id: 'c', title: 'C', pool: {
    a: { id: 'a', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] },
  },
  units: [{
    id: 'u', title: 'U', emoji: '🦊', order: 0, l1Enabled: false,
    lessons: [{ id: 'l', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  }],
  gates: [],
};

describe('validateCourse', () => {
  it('accepts a valid dragdrop course', () => {
    expect(validateCourse(base).ok).toBe(true);
  });
  it('rejects a dragdrop item whose answer/slots length mismatch', () => {
    const bad: Course = { ...base, pool: { a: { ...base.pool.a, answer: ['I', 'run'] } } };
    expect(validateCourse(bad).ok).toBe(false);
    expect(validateCourse(bad).errors.join()).toMatch(/answer\/slots/);
  });
  it('rejects a gate whose reviewsUnitIds reference an unknown unit', () => {
    const bad: Course = { ...base, gates: [{ id: 'g', title: 'G', scope: 'gated', reviewsUnitIds: ['nope'], boss: base.units[0] as any && ({ tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } }) }] };
    expect(validateCourse(bad).ok).toBe(false);
    expect(validateCourse(bad).errors.join()).toMatch(/unknown unit/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/validate.test.ts`
Expected: FAIL — `validateCourse` is not exported.

- [ ] **Step 3: Implement kind-aware validation in `src/content/validate.ts`**

Keep the existing `validateContent(bundle)` (still used for the legacy cache path) and add `validateCourse`. Replace the file body with:

```ts
import type { ContentBundle } from './model';
import type { Course } from './course';
import type { DrillItem } from '../data/types';

/** Per-kind item checks. In P1 only dragdrop items exist; the other kinds are
 *  validated structurally as they arrive in P2 (fields added then). */
function validateItem(itemId: string, item: DrillItem, push: (m: string) => void): void {
  // dragdrop (legacy DrillItem shape):
  if (item.answer.length !== item.slots.length) push(`item ${itemId} answer/slots length mismatch`);
  for (const trap of item.traps ?? []) {
    if (trap.slot < 0 || trap.slot >= item.slots.length) push(`item ${itemId} trap slot out of range`);
  }
}

/** Structural invariants shared by legacy bundle + course. */
function validateBundleShape(bundle: ContentBundle, push: (m: string) => void): string[] {
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
        validateItem(itemId, item, push);
      }
    }
  }

  if (new Set(lessonIds).size !== lessonIds.length) push('duplicate lesson ids across journey');
  return lessonIds;
}

/** Legacy bundle validation (cache path). */
export function validateContent(bundle: ContentBundle): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  validateBundleShape(bundle, (m) => errors.push(m));
  return { ok: errors.length === 0, errors };
}

/** Course validation: structural bundle checks + gate/final-boss references. */
export function validateCourse(course: Course): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  validateBundleShape({ pool: course.pool, units: course.units }, push);

  const unitIds = new Set(course.units.map((u) => u.id));
  const reviewBosses = [...course.gates, ...(course.finalBoss ? [course.finalBoss] : [])];
  for (const b of reviewBosses) {
    for (const uid of b.reviewsUnitIds ?? []) {
      if (!unitIds.has(uid)) push(`boss ${b.id} reviews unknown unit ${uid}`);
    }
    for (const pid of b.pinnedItemIds ?? []) {
      if (!course.pool[pid]) push(`boss ${b.id} pins unknown item ${pid}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/validate.test.ts`
Expected: PASS. Also run `npm test -- src/content` to confirm existing validate consumers still pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(content): kind-aware validateCourse alongside legacy validateContent"
```

---

## Task 5: Per-course Firestore persistence with legacy fallback

**Files:**
- Modify: `src/firebase/content.ts`
- Test: `src/firebase/content.test.ts` (create — mock the firestore calls)

- [ ] **Step 1: Write the failing test**

Create `src/firebase/content.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the firestore module surface used by content.ts.
const mocks = vi.hoisted(() => ({ getDoc: vi.fn(), setDoc: vi.fn(), doc: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  doc: mocks.doc, getDoc: mocks.getDoc, setDoc: mocks.setDoc, writeBatch: () => ({ set: vi.fn(), commit: vi.fn() }),
}));
vi.mock('./db', () => ({ db: {} }));

import { fetchCoursesIndex } from './content';

describe('fetchCoursesIndex', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the index list when the index doc exists', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ courses: [{ id: 'default', title: 'Beginner' }] }) });
    const idx = await fetchCoursesIndex();
    expect(idx).toEqual([{ id: 'default', title: 'Beginner' }]);
  });
  it('falls back to a synthetic default entry when no index doc exists', async () => {
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    const idx = await fetchCoursesIndex();
    expect(idx[0].id).toBe('default');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/firebase/content.test.ts`
Expected: FAIL — `fetchCoursesIndex` not exported.

- [ ] **Step 3: Implement `src/firebase/content.ts`**

Replace the file with:

```ts
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './db';
import type { ContentBundle, Unit } from '../content/model';
import type { Course, CourseIndexEntry } from '../content/course';
import { bundleToDefaultCourse, DEFAULT_COURSE_ID } from '../content/migrate';
import type { DrillItem } from '../data/types';

const COURSES_INDEX = doc(db, 'content', 'coursesIndex');
const courseDoc = (id: string) => doc(db, 'content', 'courses', id, 'doc');
// Legacy docs (read-only fallback for one-time migration):
const LEGACY_POOL = doc(db, 'content', 'pool');
const LEGACY_JOURNEY = doc(db, 'content', 'journey');

/** Index for the course-select screen. Falls back to a synthetic default entry
 *  (so a not-yet-migrated install still lists the legacy content as a course). */
export async function fetchCoursesIndex(): Promise<CourseIndexEntry[]> {
  const snap = await getDoc(COURSES_INDEX);
  if (snap.exists()) return (snap.data()?.courses ?? []) as CourseIndexEntry[];
  return [{ id: DEFAULT_COURSE_ID, title: 'Beginner Course', emoji: '📘' }];
}

/** Read one course. If its doc is absent and id === default, migrate the legacy
 *  two-doc layout into a default course on the fly. Returns null if nothing exists. */
export async function fetchCourse(id: string): Promise<Course | null> {
  const snap = await getDoc(courseDoc(id));
  if (snap.exists()) return snap.data()?.course as Course;

  if (id === DEFAULT_COURSE_ID) {
    const [poolSnap, journeySnap] = await Promise.all([getDoc(LEGACY_POOL), getDoc(LEGACY_JOURNEY)]);
    const pool = (poolSnap.data()?.items ?? {}) as Record<string, DrillItem>;
    const units = (journeySnap.data()?.units ?? []) as Unit[];
    if (units.length === 0) return null;
    return bundleToDefaultCourse({ pool, units } as ContentBundle);
  }
  return null;
}

/** Write one course doc and upsert its index entry atomically. */
export async function saveCourse(course: Course): Promise<void> {
  const batch = writeBatch(db);
  batch.set(courseDoc(course.id), { course });
  const indexSnap = await getDoc(COURSES_INDEX);
  const existing = (indexSnap.data()?.courses ?? []) as CourseIndexEntry[];
  const entry: CourseIndexEntry = { id: course.id, title: course.title, emoji: course.emoji, l1Ready: course.l1Ready };
  const merged = [...existing.filter((e) => e.id !== course.id), entry];
  batch.set(COURSES_INDEX, { courses: merged });
  await batch.commit();
}

// Re-export legacy single-bundle save for any remaining admin code paths until P3.
export async function saveContent(bundle: ContentBundle): Promise<void> {
  await saveCourse(bundleToDefaultCourse(bundle));
}
```

Note for the implementer: `setDoc` is imported for parity with the test mock surface even though `writeBatch.set` is used for writes; if your lint flags it unused, drop the `setDoc` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/firebase/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/content.ts src/firebase/content.test.ts
git commit -m "feat(firebase): per-course content docs + coursesIndex + legacy fallback"
```

---

## Task 6: Course-aware content store + load

**Files:**
- Modify: `src/content/store.ts`
- Modify: `src/content/load.ts`
- Test: `src/content/courseStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/content/courseStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useContentStore } from './store';
import { bundleToDefaultCourse } from './migrate';
import { SEED } from './seed';

describe('content store (course-aware)', () => {
  beforeEach(() => {
    const course = bundleToDefaultCourse(SEED);
    useContentStore.setState({ course, activeCourseId: course.id, status: 'fallback' });
  });

  it('derives bundle from the active course', () => {
    const s = useContentStore.getState();
    expect(s.bundle.units).toBe(s.course!.units);
    expect(s.bundle.pool).toBe(s.course!.pool);
  });

  it('setCourse swaps the active course and status', () => {
    const next = { ...bundleToDefaultCourse(SEED), id: 'other', title: 'Other' };
    useContentStore.getState().setCourse(next, 'live');
    const s = useContentStore.getState();
    expect(s.activeCourseId).toBe('other');
    expect(s.status).toBe('live');
    expect(s.bundle.units).toBe(next.units);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/courseStore.test.ts`
Expected: FAIL — `course`, `activeCourseId`, `setCourse`, `bundle` getter not present.

- [ ] **Step 3: Implement the store**

Replace `src/content/store.ts`:

```ts
import { create } from 'zustand';
import type { ContentBundle } from './model';
import type { Course } from './course';
import { activeBundle } from './course';
import { SEED } from './seed';
import { bundleToDefaultCourse } from './migrate';
import { cachedCourse } from './load';

export type ContentStatus = 'fallback' | 'live';

interface ContentState {
  course: Course | null;
  activeCourseId: string | null;
  status: ContentStatus;
  /** Active course adapted to the legacy ContentBundle consumed by model/UI. */
  bundle: ContentBundle;
  setCourse: (course: Course, status: ContentStatus) => void;
}

const firstCourse: Course = cachedCourse() ?? bundleToDefaultCourse(SEED);

/** Module-level store so React + gameStore read the active course synchronously.
 *  `bundle` is kept in sync with `course` on every setCourse. */
export const useContentStore = create<ContentState>((set) => ({
  course: firstCourse,
  activeCourseId: firstCourse.id,
  status: 'fallback',
  bundle: activeBundle(firstCourse),
  setCourse: (course, status) =>
    set({ course, activeCourseId: course.id, status, bundle: activeBundle(course) }),
}));
```

Add to `src/content/load.ts` (keep existing `validateContent`/cache functions; add course cache + hydrate). Append:

```ts
import type { Course, CourseIndexEntry } from './course';
import { validateCourse } from './validate';
import { bundleToDefaultCourse } from './migrate';
import { SEED } from './seed';
import { fetchCourse, fetchCoursesIndex } from '../firebase/content';

export const COURSE_CACHE_PREFIX = 'sentence-pet-course:';

/** Last-good cached Course for the active id (default if none requested). */
export function cachedCourse(id = 'default'): Course | null {
  try {
    const raw = localStorage.getItem(COURSE_CACHE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Course;
    return validateCourse(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCourseCache(course: Course): void {
  try {
    localStorage.setItem(COURSE_CACHE_PREFIX + course.id, JSON.stringify(course));
  } catch { /* quota / disabled — non-fatal */ }
}

/** Fetch one live course; swap + cache only if valid. Errors → keep current. */
export async function hydrateCourse(id: string): Promise<void> {
  try {
    const live = (await fetchCourse(id)) ?? bundleToDefaultCourse(SEED);
    if (validateCourse(live).ok) {
      const { useContentStore } = await import('./store');
      useContentStore.getState().setCourse(live, 'live');
      writeCourseCache(live);
    }
  } catch { /* offline / permission — keep fallback */ }
}

/** Fetch the course index for the select screen; [] on error. */
export async function loadCoursesIndex(): Promise<CourseIndexEntry[]> {
  try { return await fetchCoursesIndex(); } catch { return []; }
}
```

(The dynamic `import('./store')` inside `hydrateCourse` avoids a load↔store circular import at module-eval time.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/courseStore.test.ts`
Expected: PASS. Also run `npm test -- src/content/load.test.ts` to confirm the existing load tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/store.ts src/content/load.ts src/content/courseStore.test.ts
git commit -m "feat(content): course-aware store + course cache/hydrate"
```

---

## Task 7: `currentCourseId` + `selectCourse` in gameStore, and the CourseSelect screen

**Files:**
- Modify: `src/state/gameStore.ts` (state field ~62, actions ~201, persist omit ~410)
- Create: `src/components/CourseSelect.tsx`
- Test: `src/state/gameStore.courseSelect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/gameStore.courseSelect.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

describe('selectCourse', () => {
  beforeEach(() => useGameStore.setState({ screen: 'petRoom', currentCourseId: null } as never));
  it('sets currentCourseId and routes to the journey (pickDrill)', () => {
    useGameStore.getState().selectCourse('default');
    const s = useGameStore.getState();
    expect(s.currentCourseId).toBe('default');
    expect(s.screen).toBe('pickDrill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/gameStore.courseSelect.test.ts`
Expected: FAIL — `selectCourse` / `currentCourseId` not present.

- [ ] **Step 3: Implement gameStore changes**

In `src/state/gameStore.ts`, add to the state interface (near `currentLessonId: string | null;` at ~62):

```ts
  currentCourseId: string | null;
```

Add to the actions interface (near `startLesson` at ~85):

```ts
  selectCourse: (courseId: string) => void;
```

Add the initial value (near `currentLessonId: null as string | null,` at ~181):

```ts
    currentCourseId: null as string | null,
```

Add the action implementation (near `startLesson` at ~203). It triggers the live hydrate of the chosen course, then routes to the journey:

```ts
      selectCourse: (courseId) => {
        void import('../content/load').then((m) => m.hydrateCourse(courseId));
        set({ currentCourseId: courseId, currentLessonId: null, screen: 'pickDrill' });
      },
```

`currentCourseId` is session-transient like `currentLessonId` — add it to the persist omit at ~410:

```ts
        const { lastLevelUp, lastStageChange, currentLessonId, currentCourseId, currentBossLessonId, pendingStinger, ...rest } = s;
        void currentLessonId;
        void currentCourseId; // transient — not persisted
```

(Also add `'currentCourseId'` to the `Omit<...>` return cast on the following line, mirroring `currentLessonId`.)

- [ ] **Step 4: Implement `src/components/CourseSelect.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { loadCoursesIndex } from '../content/load';
import type { CourseIndexEntry } from '../content/course';

/** First screen of the journey flow: pick a course, then enter its unit map. */
export function CourseSelect() {
  const selectCourse = useGameStore((s) => s.selectCourse);
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
        {courses?.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={c.locked}
            onClick={() => selectCourse(c.id)}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left disabled:opacity-40"
          >
            <span className="text-2xl">{c.emoji ?? '📘'}</span>
            <span className="flex flex-col">
              <span className="font-semibold">{c.title}</span>
              {c.l1Ready && <span className="text-xs opacity-60">🇹🇭 L1-ready</span>}
            </span>
            {c.locked && <span className="ml-auto text-sm opacity-60">🔒</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/state/gameStore.courseSelect.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/gameStore.ts src/components/CourseSelect.tsx src/state/gameStore.courseSelect.test.ts
git commit -m "feat(game): currentCourseId + selectCourse + CourseSelect screen"
```

---

## Task 8: Route `pickCourse` and branch lesson rendering by `kind`

**Files:**
- Create: `src/components/ComingSoon.tsx`
- Modify: `src/App.tsx` (`screenKeyAndNode` ~24-42, `zoneForScreen` ~51-73, `CurrentScreen` ~75-93)
- Test: `src/App.kindRouting.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/App.kindRouting.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { screenKeyAndNode } from './App';
import type { DrillItem } from './data/types';

const items: DrillItem[] = [{ id: 'a', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] }];

describe('kind-routed lesson rendering', () => {
  it('routes pickCourse to the CourseSelect screen', () => {
    const { key } = screenKeyAndNode('pickCourse', true, 'pattern', 1, items, 'dragdrop');
    expect(key).toBe('pickCourse');
  });
  it('renders DrillScreen for a dragdrop lesson', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'dragdrop');
    expect(key).toBe('drill');
  });
  it('renders ComingSoon for a not-yet-built kind', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'flashcard');
    expect(key).toBe('comingSoon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.kindRouting.test.tsx`
Expected: FAIL — `screenKeyAndNode` has the old 5-arg signature and no `pickCourse`/kind branch.

- [ ] **Step 3: Implement `src/components/ComingSoon.tsx`**

```tsx
import { useGameStore } from '../state/gameStore';

/** Placeholder for activity kinds not yet built (flashcard/matching/fillblank).
 *  Built out in P2. Lets P1 ship a kind-routed shell without those screens. */
export function ComingSoon({ kind }: { kind: string }) {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xl font-semibold">“{kind}” activity coming soon</p>
      <button type="button" onClick={() => setScreen('pickDrill')} className="rounded-lg bg-slate-700 px-4 py-2">
        Back to map
      </button>
    </div>
  );
}
```

If `setScreen` does not exist on the store, use the existing navigation action (search `setScreen`/`goTo` in `gameStore.ts`); the test only asserts the `key`, so wiring the button to the real nav action is the only adjustment.

- [ ] **Step 4: Implement App.tsx routing**

Add imports near the other component imports:

```tsx
import { CourseSelect } from './components/CourseSelect';
import { ComingSoon } from './components/ComingSoon';
import type { ContentKind } from './data/types';
```

Change `screenKeyAndNode` to accept the active lesson `kind` and branch:

```tsx
export function screenKeyAndNode(screen: string, hatched: boolean, drill: DrillType, level: number, items: DrillItem[], kind: ContentKind) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'pickCourse': return { key: 'pickCourse', node: <CourseSelect /> };
    case 'pickDrill': return { key: 'pickDrill', node: <JourneyMap /> };
    case 'drill': {
      if (items.length === 0) return { key: 'pickDrill', node: <JourneyMap /> };
      if (kind === 'dragdrop') return { key: 'drill', node: <DrillScreen items={items} drill={drill} level={level} /> };
      return { key: 'comingSoon', node: <ComingSoon kind={kind} /> };
    }
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'evolution': return { key: 'evolution', node: <EvolutionScreen /> };
    case 'shop': return { key: 'shop', node: <Shop /> };
    case 'gacha': return { key: 'gacha', node: <Gacha /> };
    case 'collection': return { key: 'collection', node: <Collection /> };
    case 'bossPrep': return { key: 'bossPrep', node: <BossPrepScreen /> };
    case 'battle': return { key: 'battle', node: <BattleScreen /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}
```

Add `pickCourse` and `comingSoon` to `zoneForScreen` (both overworld):

```tsx
    case 'pickCourse':
    case 'comingSoon':
    case 'pickDrill':
    case 'petRoom':
    case 'shop':
    case 'gacha':
    case 'collection':
      return 'overworld';
```

In `CurrentScreen`, pass the active lesson's kind (default `'dragdrop'` for free-practice/no lesson):

```tsx
  const kind: ContentKind = lesson?.kind ?? 'dragdrop';
  const { key, node } = screenKeyAndNode(screen, hatched, drill, level, items, kind);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/App.kindRouting.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ComingSoon.tsx src/App.tsx src/App.kindRouting.test.tsx
git commit -m "feat(app): route pickCourse + branch lesson rendering by kind"
```

---

## Task 9: Regenerate seed as a default course, wire hydrate, full green

**Files:**
- Modify: `src/main.tsx` (hydrate call ~22)
- Modify: `src/content/seed.ts` (regenerated — see note)
- Test: full suite + build

- [ ] **Step 1: Point app hydrate at the default course**

In `src/main.tsx`, replace the legacy hydrate import + call:

```tsx
import { hydrateCourse } from './content/load'
```
```tsx
if (!isAdmin) {
  void hydrateCourse('default') // live fetch the default course → swap + cache; failures keep fallback
}
```

- [ ] **Step 2: Confirm seed compatibility**

`src/content/seed.ts` exports `SEED: ContentBundle` (legacy pool+units). Tasks 3/6 wrap it via `bundleToDefaultCourse(SEED)` at runtime, so **no seed regeneration is required for P1 to function** — the migration handles legacy-shaped units (no `kind`/`l1Enabled`). Leave `seed.ts` as-is for P1. (P2 regenerates it once the admin writes kind-tagged content; that is out of scope here.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all prior tests plus the new course/migrate/validate/store/gameStore/App tests. Investigate any failure before proceeding; do not edit tests to pass.

- [ ] **Step 4: Type-check + build**

Run: `npm run build`
Expected: clean TypeScript build (no unused-import or type errors). If `setDoc` in `content.ts` is flagged unused, remove that import.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the printed URL, play as guest → PetRoom → Play ▶. Confirm: the journey still loads, a drag-drop lesson plays exactly as before, and selecting a course (if surfaced) routes to the map. A non-dragdrop kind (if any seeded) shows the ComingSoon placeholder.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx
git commit -m "feat(app): hydrate the default course on player boot"
```

---

## Self-Review

**Spec coverage (P1 slice of §10):**
- New types (ContentKind, Course, kind-aware Lesson/Unit/BossNode) → Tasks 1, 2.
- Persistence restructure to `content/courses/*` → Task 5.
- Migration of existing content into a default course → Tasks 3, 5 (fallback).
- Course-select screen → Task 7.
- Kind-routed player shell rendering only dragdrop + checkpoint → Task 8 (checkpoint boss is unchanged existing flow, reached via `JourneyMap`/`startBoss`, not altered here).
- Kind-aware `validate.ts` → Task 4.
- Green tests + build → Task 9.

**Deferred to P2/P3 (intentionally not in this plan):** the four new activity screens, L1 TH/ENG toggle UI, admin editor/Excel import, gated/final boss content sampling, enforcing `finalBoss` presence in `validateCourse`, regenerating `seed.ts` with kind-tagged content. The `finalBoss?` is optional in P1 specifically so legacy migration validates.

**Type consistency check:** `Course`, `BossNode`, `CourseIndexEntry`, `ContentKind`, `bundleToDefaultCourse`, `DEFAULT_COURSE_ID`, `activeBundle`, `courseUnits`, `validateCourse`, `fetchCourse`, `fetchCoursesIndex`, `saveCourse`, `setCourse`, `selectCourse`, `currentCourseId`, `hydrateCourse`, `loadCoursesIndex`, `cachedCourse` are defined once and referenced consistently across tasks. `screenKeyAndNode`'s new 6th param `kind: ContentKind` is updated at its one call site (Task 8, Step 4).

**Landmines honored:** explicit `git add` of named files per commit (never `-A`); `firebase.json` untouched; `seed.ts` not hand-edited (migration wraps it at runtime); `.superpowers/` already gitignored.
