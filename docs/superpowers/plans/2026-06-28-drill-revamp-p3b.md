# Drill Revamp P3b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins UI + Excel authoring for gated/final bosses and full courses, regenerate a Course-shaped seed, and enforce that every course has a final boss.

**Architecture:** Migrate the admin tool from a `ContentBundle` draft to a `Course` draft (`validateCourse` + `saveCourse` + `setCourse`) — the keystone that unblocks gated/final boss forms, Excel-import-to-`Course`, Course-shaped seed export, and finalBoss-present enforcement. Enforcement is made safe first by synthesizing a default `finalBoss` in `bundleToDefaultCourse` so every loadable course shape already has one.

**Tech Stack:** React 19 + Zustand + TypeScript (strict, `tsc -b`), Vitest + Testing Library, Firebase Firestore, `xlsx` (SheetJS, added here).

**Spec:** `docs/superpowers/specs/2026-06-28-drill-revamp-p3b-design.md`

---

## Conventions (read once)

- **Branch:** `journey-redesign` (integration branch — commit here, do NOT merge to `main`).
- **Stage explicit files only**, never `git add -A`. **Never stage `firebase.json`** (it is intentionally modified-but-unstaged).
- **Test runner:** `npm test` (vitest run). Single file: `npx vitest run <path>`. Single test: `npx vitest run <path> -t "<name>"`.
- **Type gate:** `npx tsc -b` (NOT `tsc --noEmit` — a no-op in this repo). Run it before declaring any task done; vitest does not catch excess-property / shape breaks.
- **Build:** `npm run build` (= `tsc -b && vite build`).
- **READ a file before overwriting it** (a P3a subagent nearly clobbered an 892-line test on a false "missing" glob).
- **Reuse, don't rebuild:** boss-battle feature (`CheckpointBoss`, `BossPrepScreen`, `BattleScreen`, `finishBoss`) and the P3a resolver (`resolveCourseBundle`, `sampleReviewItems`) are done — feed them, don't touch them.
- **`DragDropItem.thaiHint` is REQUIRED** — every dragdrop fixture (incl. Excel import fixtures) must set it.
- Baseline: 803 tests green at P3a (`94b9447`). Each task keeps the suite green.

## File map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/content/migrate.ts` | Modify | Synthesize a default `finalBoss` when wrapping a bundle into a Course |
| `src/content/migrate.test.ts` | Modify | Assert synthesized finalBoss shape |
| `src/content/validate.ts` | Modify | Enforce finalBoss-present + reject duplicate gate `afterUnitId` |
| `src/content/validate.test.ts` | Modify | Flip the "no final boss" case; add dup-afterUnitId + finalBoss-present tests |
| `src/content/seed.ts` | Modify | Add generated `SEED_COURSE: Course` (carries gates + finalBoss) |
| `src/content/seed.test.ts` | Create | Validate `SEED_COURSE` (moved from `seedCourse.test.ts`) |
| `src/content/seedCourse.ts` | Delete | P3a stopgap, replaced by `seed.ts` `SEED_COURSE` |
| `src/content/seedCourse.test.ts` | Delete | Replaced by `seed.test.ts` |
| `src/content/store.ts` | Modify | Import `SEED_COURSE` from `./seed` |
| `scripts/export-seed.ts` | Modify | Also write a Course-shaped `dist-seed/course.json` |
| `src/components/admin/PoolTab.tsx` | Modify | Prop `ContentBundle` → `Course` |
| `src/components/admin/JourneyTab.tsx` | Modify | Prop `ContentBundle` → `Course` |
| `src/components/admin/AdminShell.tsx` | Modify | Draft a `Course`; `validateCourse` + `saveCourse` + `setCourse`; add Bosses + Import tabs |
| `src/components/admin/AdminShell.test.tsx` | Modify | Course draft + `saveCourse` assertions |
| `src/components/admin/BossesTab.tsx` | Create | Edit `course.gates[]` + `course.finalBoss` |
| `src/components/admin/BossesTab.test.tsx` | Create | Add/edit/delete gate + final boss |
| `src/content/excelImport.ts` | Create | Pure `parseWorkbookToCourse(workbook)` |
| `src/content/excelImport.test.ts` | Create | Parser happy path + per-sheet row errors |
| `src/components/admin/ImportTab.tsx` | Create | File upload → parse → preview-then-commit |
| `src/components/admin/ImportTab.test.tsx` | Create | Preview blocks on error, commits when valid |
| `package.json` | Modify | Add `xlsx` dependency |

---

## Task 1: Synthesize a default finalBoss in `bundleToDefaultCourse`

**Why first:** finalBoss enforcement (Task 2) is only safe once every Course shape already has a valid final boss. Migrated/legacy courses come from `bundleToDefaultCourse`, so it must synthesize one.

**Files:**
- Modify: `src/content/migrate.ts`
- Test: `src/content/migrate.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/content/migrate.test.ts`, the first test currently asserts `c.finalBoss).toBeUndefined()`. Replace that test body and add a shape test:

```typescript
  it('wraps a legacy bundle into a default course with a synthesized final boss', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.id).toBe(DEFAULT_COURSE_ID);
    expect(c.pool).toBe(legacy.pool);
    expect(c.gates).toEqual([]);
    expect(c.finalBoss).toBeDefined();
    expect(c.finalBoss!.scope).toBe('final');
    expect(c.finalBoss!.onClear).toBe('completeCourse');
    // reviews every authored unit
    expect(c.finalBoss!.reviewsUnitIds).toEqual(c.units.map((u) => u.id));
    expect(c.finalBoss!.reviewCount).toBeGreaterThanOrEqual(1);
    expect(c.finalBoss!.boss).toBeDefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/migrate.test.ts -t "synthesized final boss"`
Expected: FAIL — `c.finalBoss` is `undefined`.

- [ ] **Step 3: Implement the synthesis**

In `src/content/migrate.ts`, import the boss type and add a synthesizer. Replace the `return { ... }` in `bundleToDefaultCourse` so it includes `finalBoss`:

```typescript
import type { ContentBundle } from './model';
import type { Course, BossNode } from './course';
import type { ContentItem } from '../data/types';

// ... DEFAULT_COURSE_ID and stampPoolKind unchanged ...

/** A default final boss reviewing every unit, so every Course shape always has
 *  one (lets validateCourse enforce final-boss presence without rejecting
 *  migrated/legacy courses). Authored courses override this in the admin UI. */
function defaultFinalBoss(courseId: string, unitIds: string[]): BossNode {
  return {
    id: `${courseId}-final`,
    title: 'Final Boss',
    scope: 'final',
    reviewsUnitIds: unitIds,
    reviewCount: 6,
    boss: { tierId: 'tier-3', element: 'leaf', name: 'Course Champion', rivalSprite: { species: 'leaf', stage: 'adult' } },
    onClear: 'completeCourse',
  };
}

export function bundleToDefaultCourse(bundle: ContentBundle): Course {
  const units = bundle.units.map((u) => ({
    ...u,
    l1Enabled: u.l1Enabled ?? false,
    lessons: u.lessons.map((l) => ({ ...l, kind: l.kind ?? 'dragdrop' })),
  }));
  return {
    id: DEFAULT_COURSE_ID,
    title: 'Beginner Course',
    emoji: '📘',
    pool: stampPoolKind(bundle.pool),
    units,
    gates: [],
    finalBoss: defaultFinalBoss(DEFAULT_COURSE_ID, units.map((u) => u.id)),
  };
}
```

- [ ] **Step 4: Run the migrate tests**

Run: `npx vitest run src/content/migrate.test.ts`
Expected: PASS (all, incl. the idempotency test — re-running keeps a finalBoss present).

- [ ] **Step 5: Run the full suite + type gate**

Run: `npm test`
Expected: still green. (Note `courseStore.test.ts` and `AdminShell.test.tsx` build courses via `bundleToDefaultCourse(SEED)`; they now carry a finalBoss — still valid, no assertions on its absence.)

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/content/migrate.ts src/content/migrate.test.ts
git commit -m "feat(content): synthesize default finalBoss in bundleToDefaultCourse"
```

---

## Task 2: Enforce finalBoss-present + reject duplicate gate `afterUnitId` in `validateCourse`

**Files:**
- Modify: `src/content/validate.ts`
- Test: `src/content/validate.test.ts`

- [ ] **Step 1: Update / add the failing tests**

In `src/content/validate.test.ts`, the `base` fixture (around line 118) has no `finalBoss`. Give it one so it stays valid:

```typescript
const base: Course = {
  id: 'c', title: 'C',
  pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{
    id: 'u', title: 'U', emoji: '🦊', order: 0, l1Enabled: false,
    lessons: [{ id: 'l', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  }],
  gates: [],
  finalBoss: { id: 'fb', title: 'F', scope: 'final', reviewsUnitIds: ['u'], reviewCount: 3, boss: sampleBoss, onClear: 'completeCourse' },
};
```

Replace the old "still accepts a course with no final boss" test (around line 160) with an enforcement test, and add a duplicate-`afterUnitId` test:

```typescript
  it('rejects a course with no final boss', () => {
    const bad: Course = { ...base, finalBoss: undefined };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/final boss/i);
  });

  it('rejects two gates sharing the same afterUnitId', () => {
    const g = (id: string): BossNode =>
      ({ id, title: id, scope: 'gated', afterUnitId: 'u', reviewsUnitIds: ['u'], boss: sampleBoss });
    const bad: Course = { ...base, gates: [g('g1'), g('g2')] };
    expect(validateCourse(bad).errors.join()).toMatch(/duplicate afterUnitId/i);
  });
```

Add the `BossNode` import to the test file's imports:

```typescript
import type { Course, BossNode } from './course';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content/validate.test.ts -t "no final boss"`
Expected: FAIL — currently `validateCourse` accepts a missing finalBoss.

- [ ] **Step 3: Add the two checks**

In `src/content/validate.ts`, inside `validateCourse`, after the `reviewBosses` loop and before `return`, add:

```typescript
  // P3b: every course must carry a final boss (safe — bundleToDefaultCourse synthesizes one).
  if (!course.finalBoss) push('course has no final boss');

  // P3b: two gates after the same unit both resolve to order N+0.5 (a tie the resolver can't place).
  const afterIds = course.gates.map((g) => g.afterUnitId).filter((x): x is string => !!x);
  if (new Set(afterIds).size !== afterIds.length) push('duplicate afterUnitId across gates');
```

- [ ] **Step 4: Run the validate tests**

Run: `npx vitest run src/content/validate.test.ts`
Expected: PASS (all). The existing `seedCourse.test.ts` `SEED_COURSE` already has a finalBoss, so it stays valid.

- [ ] **Step 5: Full suite + type gate**

Run: `npm test`
Expected: green. Watch for any Course fixture lacking a finalBoss that flows through `validateCourse` (cache/load tests). `content.test.ts` calls `saveCourse` (no validation) so its `gates:[]`, no-finalBoss fixture is unaffected.

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/content/validate.ts src/content/validate.test.ts
git commit -m "feat(content): enforce finalBoss presence + reject duplicate gate afterUnitId"
```

---

## Task 3: Move `SEED_COURSE` into `seed.ts`, repoint store, Course-shaped export, delete `seedCourse.ts`

**Files:**
- Modify: `src/content/seed.ts`
- Create: `src/content/seed.test.ts`
- Delete: `src/content/seedCourse.ts`, `src/content/seedCourse.test.ts`
- Modify: `src/content/store.ts`
- Modify: `scripts/export-seed.ts`

- [ ] **Step 1: Read `seed.ts` head, then add `SEED_COURSE`**

Read `src/content/seed.ts` (it exports `SEED: ContentBundle` — keep it untouched). At the **end** of the file add the generated course (the example bosses move here from `seedCourse.ts`):

```typescript
import type { Course } from './course';
import { bundleToDefaultCourse } from './migrate';

/** Seed course: the migrated default course plus the example gated + final bosses.
 *  This is the offline/first-paint fallback and the source for `npm run seed:export`.
 *  Do NOT hand-edit content — author in the admin UI (#admin) then regenerate. */
export const SEED_COURSE: Course = {
  ...bundleToDefaultCourse(SEED),
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
```

> If the unit ids (`u1-basics`, `u2-next-steps`, `u3-challenge`) or pinned item ids (`mx-l1-1`, `gr-l1-1`) differ in the current `seed.ts`, copy the exact values from the existing `src/content/seedCourse.ts` before deleting it — they were already correct there.

- [ ] **Step 2: Create `seed.test.ts` (moved from `seedCourse.test.ts`)**

Create `src/content/seed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SEED_COURSE } from './seed';
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

- [ ] **Step 3: Repoint the store import**

In `src/content/store.ts`, change the import:

```typescript
import { SEED_COURSE } from './seed';
```

(Replaces `import { SEED_COURSE } from './seedCourse';`. Everything else in `store.ts` is unchanged.)

- [ ] **Step 4: Delete the stopgap file + its test**

```bash
git rm src/content/seedCourse.ts src/content/seedCourse.test.ts
```

- [ ] **Step 5: Make the export Course-shaped**

Read then edit `scripts/export-seed.ts` to also emit a Course-shaped JSON (keep `content.json` for the legacy `seed:push`):

```typescript
import { writeFileSync, mkdirSync } from 'node:fs';
import { SEED, SEED_COURSE } from '../src/content/seed';

mkdirSync('dist-seed', { recursive: true });
writeFileSync('dist-seed/content.json', JSON.stringify(SEED, null, 2));
writeFileSync('dist-seed/course.json', JSON.stringify(SEED_COURSE, null, 2));
console.log(
  `wrote dist-seed/content.json (${SEED.units.length} units, ${Object.keys(SEED.pool).length} items) ` +
  `and dist-seed/course.json (${SEED_COURSE.gates.length} gates, finalBoss ${SEED_COURSE.finalBoss ? 'yes' : 'no'})`,
);
```

- [ ] **Step 6: Run tests, export, type gate**

Run: `npx vitest run src/content/seed.test.ts src/content/store.ts src/content/courseStore.test.ts`
Expected: PASS.

Run: `npm test`
Expected: green (no remaining importer of `./seedCourse`).

Run: `npm run seed:export`
Expected: logs both files; `dist-seed/course.json` exists with `finalBoss yes`.

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/content/seed.ts src/content/seed.test.ts src/content/store.ts scripts/export-seed.ts
git commit -m "refactor(content): move SEED_COURSE into seed.ts, Course-shaped export, drop seedCourse.ts"
```

---

## Task 4: Retarget `PoolTab` and `JourneyTab` props from `ContentBundle` to `Course`

**Why:** AdminShell (Task 5) will hold a `Course` draft. These tabs only touch `.pool`/`.units`, which `Course` also has — the change is the prop type plus spread-preserving the course-only fields (`gates`, `finalBoss`, etc.) in `onChange`.

**Files:**
- Modify: `src/components/admin/PoolTab.tsx`
- Modify: `src/components/admin/JourneyTab.tsx`

- [ ] **Step 1: Retarget `PoolTab`**

In `src/components/admin/PoolTab.tsx`:
- Change the import and prop type from `ContentBundle` to `Course`.
- Rename the prop `bundle` → `course` throughout (read `course.pool`).
- `onChange` emits a `Course` via spread (`{ ...course, pool }`) — already the existing shape, so only the type/name changes.

```typescript
import { useState } from 'react';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { ItemEditor } from './ItemEditor';

export function PoolTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const ids = Object.keys(course.pool);
  const [selected, setSelected] = useState<string | null>(ids[0] ?? null);

  function freshId(): string {
    let n = 1;
    while (course.pool[`item-${n}`]) n++;
    return `item-${n}`;
  }

  function addItem() {
    const id = freshId();
    const fresh: DrillItem = { id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun', 'Verb'], answer: ['', ''] };
    onChange({ ...course, pool: { ...course.pool, [id]: fresh } });
    setSelected(id);
  }

  function updateItem(next: ContentItem) {
    const pool = { ...course.pool };
    delete pool[selected!];
    pool[next.id] = next;
    onChange({ ...course, pool });
    setSelected(next.id);
  }

  function removeItem(id: string) {
    const pool = { ...course.pool };
    delete pool[id];
    onChange({ ...course, pool });
    setSelected(Object.keys(pool)[0] ?? null);
  }
  // ...JSX unchanged except `bundle.pool` → `course.pool` everywhere...
}
```

Update the JSX body: replace every `bundle.pool` with `course.pool`.

- [ ] **Step 2: Retarget `JourneyTab`**

In `src/components/admin/JourneyTab.tsx`:
- Change imports: drop `ContentBundle`, import `Course`; keep `Lesson, Unit` from `../../content/model`.
- Rename prop `bundle` → `course`; replace `bundle.units`/`bundle.pool` with `course.units`/`course.pool`.
- `setUnits` emits a Course: `onChange({ ...course, units })`.

```typescript
import { useState } from 'react';
import type { Lesson, Unit } from '../../content/model';
import type { Course } from '../../content/course';
import type { ContentItem, ContentKind } from '../../data/types';
import { isDragDrop } from '../../data/types';

export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}

export function JourneyTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    course.units[0]?.lessons[0]?.id ?? null,
  );

  function setUnits(units: Unit[]) { onChange({ ...course, units }); }
  // ...patchUnit/patchLesson/toggleItem unchanged...
  // JSX: replace every `bundle.units` → `course.units` and `bundle.pool` → `course.pool`.
}
```

- [ ] **Step 3: Type gate (AdminShell will be red until Task 5)**

Run: `npx vitest run src/components/admin/JourneyTab.test.tsx 2>nul || echo "no journeytab test"`

> `AdminShell.tsx` still passes `bundle={draft}` to these tabs, so `tsc -b` will report a prop mismatch until Task 5. That is expected. Confirm the only `tsc -b` errors are in `AdminShell.tsx` (prop type), nothing inside `PoolTab.tsx`/`JourneyTab.tsx` themselves.

Run: `npx tsc -b`
Expected: errors ONLY in `AdminShell.tsx`. If errors appear inside the two tabs, fix them before continuing.

- [ ] **Step 4: Commit (with Task 5 — they are one compiling unit)**

Do not commit standalone (the tree does not type-check between Task 4 and Task 5). Proceed directly to Task 5; commit both together at the end of Task 5.

---

## Task 5: Migrate `AdminShell` to a `Course` draft

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/admin/AdminShell.test.tsx`

- [ ] **Step 1: Update the failing tests**

Read `src/components/admin/AdminShell.test.tsx` first (do not clobber). Then change the firebase mock from `saveContent` to `saveCourse`, seed the store with a `Course`, and update assertions:

```typescript
const saveCourse = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  saveCourse: (c: unknown) => saveCourse(c),
  fetchCourse: vi.fn(),
}));

import { AdminShell } from './AdminShell';
import { useContentStore } from '../../content/store';
import { SEED } from '../../content/seed';
import { bundleToDefaultCourse } from '../../content/migrate';

beforeEach(() => {
  saveCourse.mockClear();
  const course = bundleToDefaultCourse(SEED);
  useContentStore.setState({ course, activeCourseId: 'default', bundle: { pool: course.pool, units: course.units }, status: 'fallback' });
});
```

Update the save test and the invalid-draft test:

```typescript
  it('Save calls saveCourse with the draft course when valid', async () => {
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(saveCourse).toHaveBeenCalled());
  });

  it('validation gate: Save is disabled and banner shows errors when draft is invalid', () => {
    // An invalid course (no units → "journey has no units") seeded before render.
    const course = { ...bundleToDefaultCourse(SEED), units: [], finalBoss: undefined };
    useContentStore.setState({ course, bundle: { pool: course.pool, units: [] }, status: 'fallback' });
    render(<AdminShell />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/journey has no units/i)).toBeInTheDocument();
  });
```

For the rejection test, swap `saveContent` → `saveCourse` and compare `course` (not `bundle`) reference:

```typescript
  it('saveCourse rejection leaves live store unchanged and surfaces error text', async () => {
    saveCourse.mockRejectedValueOnce(new Error('boom'));
    const courseBefore = useContentStore.getState().course;
    render(<AdminShell />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText(/save failed/i);
    expect(useContentStore.getState().course).toBe(courseBefore);
  });
```

(The "shows Pool and Journey tabs" test stays; SEED's first lesson id still renders in the Journey tab.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: FAIL — `AdminShell` still imports `saveContent`/`validateContent` and drafts a bundle.

- [ ] **Step 3: Rewrite `AdminShell` to draft a Course**

Replace `src/components/admin/AdminShell.tsx`:

```typescript
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { ImportTab } from './ImportTab';

type Tab = 'pool' | 'journey' | 'bosses' | 'import';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const [draft, setDraft] = useState<Course>(liveCourse!);
  const [tab, setTab] = useState<Tab>('pool');
  const [status, setStatus] = useState('');

  const validation = validateCourse(draft);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveCourse(draft);
      setCourse(draft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button type="button" onClick={() => setTab(id)}
      className={`rounded px-3 py-1 ${tab === id ? 'bg-indigo-600 text-white' : 'border'}`}>{label}</button>
  );

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
        {tabBtn('pool', 'Pool')}
        {tabBtn('journey', 'Journey')}
        {tabBtn('bosses', 'Bosses')}
        {tabBtn('import', 'Import')}
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono text-sm">{status}</span>}
      </div>

      {!validation.ok && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-sm text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {tab === 'pool' && <PoolTab course={draft} onChange={setDraft} />}
      {tab === 'journey' && <JourneyTab course={draft} onChange={setDraft} />}
      {tab === 'bosses' && <BossesTab course={draft} onChange={setDraft} />}
      {tab === 'import' && <ImportTab onCommit={(c) => { setCourse(c, 'live'); setStatus('imported ✓'); }} />}
    </div>
  );
}
```

> `BossesTab` and `ImportTab` are created in Tasks 6 and 8. To keep the tree compiling at the end of Task 5, create minimal stubs now and flesh them out later:
>
> `src/components/admin/BossesTab.tsx` (stub):
> ```typescript
> import type { Course } from '../../content/course';
> export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
>   void course; void onChange;
>   return <p className="text-sm text-slate-500">Bosses editor — coming in Task 6.</p>;
> }
> ```
> `src/components/admin/ImportTab.tsx` (stub):
> ```typescript
> import type { Course } from '../../content/course';
> export function ImportTab({ onCommit }: { onCommit: (c: Course) => void }) {
>   void onCommit;
>   return <p className="text-sm text-slate-500">Excel import — coming in Task 8.</p>;
> }
> ```

- [ ] **Step 4: Run the admin tests + type gate**

Run: `npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: PASS.

Run: `npx tsc -b`
Expected: clean (Task 4 mismatch resolved; stubs satisfy the imports).

- [ ] **Step 5: Full suite**

Run: `npm test`
Expected: green.

- [ ] **Step 6: Commit (Tasks 4 + 5 together)**

```bash
git add src/components/admin/PoolTab.tsx src/components/admin/JourneyTab.tsx src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx src/components/admin/BossesTab.tsx src/components/admin/ImportTab.tsx
git commit -m "feat(admin): migrate admin tool to a Course draft (validateCourse + saveCourse)"
```

---

## Task 6: `BossesTab` — author gated bosses + the final boss

**Files:**
- Modify: `src/components/admin/BossesTab.tsx` (replace the stub)
- Create: `src/components/admin/BossesTab.test.tsx`

Design: a list of `course.gates[]` (add / edit / delete) and a single `course.finalBoss` editor. Each boss edits `afterUnitId` (gated only, `<select>` of unit ids), `reviewsUnitIds` (checkboxes of unit ids), `reviewCount` (number), `pinnedItemIds` (checkboxes of pool ids), and the `boss` config (`tierId`, `element`, `name`, `rivalSprite.species`, `rivalSprite.stage`). All edits emit `onChange(course)`. `scope` is fixed per section; final boss is forced `onClear: 'completeCourse'`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/BossesTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BossesTab } from './BossesTab';
import type { Course } from '../../content/course';

function course(): Course {
  return {
    id: 'c', title: 'C', gates: [],
    pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
    units: [
      { id: 'u1', title: 'One', emoji: '🐣', order: 1, l1Enabled: false,
        lessons: [{ id: 'u1-cp', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true }] },
      { id: 'u2', title: 'Two', emoji: '🌱', order: 2, l1Enabled: false,
        lessons: [{ id: 'u2-cp', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'], isCheckpoint: true }] },
    ],
    finalBoss: { id: 'fb', title: 'Final', scope: 'final', reviewsUnitIds: ['u1'], reviewCount: 3,
      boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } }, onClear: 'completeCourse' },
  };
}

describe('BossesTab', () => {
  it('adds a gated boss with scope gated', () => {
    const onChange = vi.fn();
    render(<BossesTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add gate/i }));
    const next: Course = onChange.mock.calls.at(-1)![0];
    expect(next.gates).toHaveLength(1);
    expect(next.gates[0].scope).toBe('gated');
  });

  it('deletes a gated boss', () => {
    const onChange = vi.fn();
    const c = course();
    c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
      boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
    render(<BossesTab course={c} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /delete gate g1/i }));
    expect(onChange.mock.calls.at(-1)![0].gates).toHaveLength(0);
  });

  it('edits the final boss name', () => {
    const onChange = vi.fn();
    render(<BossesTab course={course()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/final boss name/i), { target: { value: 'Champion' } });
    expect(onChange.mock.calls.at(-1)![0].finalBoss.boss.name).toBe('Champion');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: FAIL — stub has no "add gate" button.

- [ ] **Step 3: Implement `BossesTab`**

Replace `src/components/admin/BossesTab.tsx`:

```typescript
import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Reusable review/boss fields shared by gated + final editors. */
function BossFields({ node, units, poolIds, onPatch }: {
  node: BossNode;
  units: { id: string }[];
  poolIds: string[];
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  return (
    <div className="flex flex-col gap-1">
      <label>name
        <input className="border px-1" aria-label={`${labelPrefix} name`} value={node.boss.name}
          onChange={(e) => onPatch({ boss: { ...node.boss, name: e.target.value } })} />
      </label>
      <label>tierId
        <input className="border px-1" aria-label={`${labelPrefix} tierId`} value={node.boss.tierId}
          onChange={(e) => onPatch({ boss: { ...node.boss, tierId: e.target.value } })} />
      </label>
      <label>element
        <select className="border px-1" aria-label={`${labelPrefix} element`} value={node.boss.element}
          onChange={(e) => onPatch({ boss: { ...node.boss, element: e.target.value as Species } })}>
          {SPECIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>sprite species
        <select className="border px-1" aria-label={`${labelPrefix} sprite species`} value={node.boss.rivalSprite.species}
          onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, species: e.target.value as Species } } })}>
          {SPECIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>sprite stage
        <select className="border px-1" aria-label={`${labelPrefix} sprite stage`} value={node.boss.rivalSprite.stage}
          onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, stage: e.target.value as Exclude<PetStage, 'egg'> } } })}>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>reviewCount
        <input type="number" className="w-16 border px-1" aria-label={`${labelPrefix} reviewCount`} value={node.reviewCount ?? 0}
          onChange={(e) => { const n = Number(e.target.value); onPatch({ reviewCount: Number.isNaN(n) ? node.reviewCount : n }); }} />
      </label>
      <fieldset className="border p-1"><legend>reviews units</legend>
        {units.map((u) => (
          <label key={u.id} className="mr-2">
            <input type="checkbox" aria-label={`${labelPrefix} reviews ${u.id}`} checked={reviews.includes(u.id)}
              onChange={() => onPatch({ reviewsUnitIds: reviews.includes(u.id) ? reviews.filter((x) => x !== u.id) : [...reviews, u.id] })} /> {u.id}
          </label>
        ))}
      </fieldset>
      <fieldset className="border p-1"><legend>pinned items</legend>
        {poolIds.map((id) => (
          <label key={id} className="mr-2">
            <input type="checkbox" aria-label={`${labelPrefix} pins ${id}`} checked={pinned.includes(id)}
              onChange={() => onPatch({ pinnedItemIds: pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id] })} /> {id}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const poolIds = Object.keys(course.pool);

  function patchGate(id: string, patch: Partial<BossNode>) {
    onChange({ ...course, gates: course.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function addGate() {
    let n = 1;
    while (course.gates.some((g) => g.id === `gate-${n}`)) n++;
    const gate: BossNode = {
      id: `gate-${n}`, title: `Gate ${n}`, scope: 'gated',
      afterUnitId: course.units[0]?.id, reviewsUnitIds: [], reviewCount: 5, boss: emptyBoss(),
    };
    onChange({ ...course, gates: [...course.gates, gate] });
  }
  function deleteGate(id: string) {
    onChange({ ...course, gates: course.gates.filter((g) => g.id !== id) });
  }
  function patchFinal(patch: Partial<BossNode>) {
    const base: BossNode = course.finalBoss ?? {
      id: `${course.id}-final`, title: 'Final Boss', scope: 'final', reviewsUnitIds: [], reviewCount: 6,
      boss: emptyBoss(), onClear: 'completeCourse',
    };
    onChange({ ...course, finalBoss: { ...base, ...patch, scope: 'final', onClear: 'completeCourse' } });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Gated bosses</h2>
          <button type="button" onClick={addGate} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add gate</button>
        </div>
        {course.gates.map((g) => (
          <div key={g.id} className="mt-2 rounded border p-2">
            <div className="flex items-center gap-2">
              <strong>{g.id}</strong>
              <label>afterUnit
                <select className="border px-1" aria-label={`gate ${g.id} afterUnit`} value={g.afterUnitId ?? ''}
                  onChange={(e) => patchGate(g.id, { afterUnitId: e.target.value })}>
                  {course.units.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
                </select>
              </label>
              <button type="button" aria-label={`delete gate ${g.id}`} onClick={() => deleteGate(g.id)}
                className="text-red-600">Delete</button>
            </div>
            <BossFields node={g} units={course.units} poolIds={poolIds} onPatch={(p) => patchGate(g.id, p)} />
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Final boss</h2>
        <div className="mt-2 rounded border p-2">
          {course.finalBoss
            ? <BossFields node={course.finalBoss} units={course.units} poolIds={poolIds} onPatch={patchFinal} />
            : <button type="button" onClick={() => patchFinal({})} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add final boss</button>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the BossesTab tests**

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type gate + full suite**

Run: `npx tsc -b` → clean.
Run: `npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BossesTab.tsx src/components/admin/BossesTab.test.tsx
git commit -m "feat(admin): Bosses tab for authoring gated + final bosses"
```

---

## Task 7: `xlsx` dependency + pure `parseWorkbookToCourse` parser

**Files:**
- Modify: `package.json` (add `xlsx`)
- Create: `src/content/excelImport.ts`
- Create: `src/content/excelImport.test.ts`

The parser is the substance: a workbook (already-read SheetJS `WorkBook`) → `{ course, errors }`. It does no file IO and no Firestore — the UI (Task 8) reads the file into a `WorkBook` and calls this. Sheets per spec §8.

- [ ] **Step 1: Add the dependency**

```bash
npm install xlsx
```

Verify `package.json` `dependencies` now lists `xlsx`.

- [ ] **Step 2: Write the failing tests**

Create `src/content/excelImport.test.ts`. Build workbooks in-memory with SheetJS's `aoa_to_sheet` so no fixture files are needed:

```typescript
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookToCourse } from './excelImport';

/** Build a WorkBook from a map of sheetName → array-of-arrays (first row = headers). */
function wb(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

function validBook(): XLSX.WorkBook {
  return wb({
    Course: [['id', 'title', 'emoji', 'l1Ready'], ['c1', 'Course One', '📘', true]],
    Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]],
    Items: [
      ['id', 'kind', 'level', 'unit', 'node', 'l1_th', 'front', 'back', 'audio', 'template', 'answer', 'alternates', 'variant', 'slots', 'distractors', 'hidePos', 'thaiHint'],
      ['d1', 'dragdrop', 1, 'u1', 'u1-n1', '', '', '', '', '', 'I,run', '', 'pattern', 'Pronoun,Verb', '', false, 'ฉันวิ่ง'],
      ['c1card', 'flashcard', 1, 'u1', 'u1-n1', 'แมว', 'cat', 'แมว', '', '', '', '', '', '', '', '', ''],
    ],
    Bosses: [
      ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'],
      ['final-1', 'final', '', 'u1', 6, 'd1'],
    ],
  });
}

describe('parseWorkbookToCourse', () => {
  it('parses a valid workbook into a Course with no errors', () => {
    const { course, errors } = parseWorkbookToCourse(validBook());
    expect(errors).toEqual([]);
    expect(course).not.toBeNull();
    expect(course!.id).toBe('c1');
    expect(course!.units).toHaveLength(1);
    expect(Object.keys(course!.pool)).toContain('d1');
    expect(course!.finalBoss?.scope).toBe('final');
  });

  it('reports a missing required sheet with its name', () => {
    const book = validBook();
    delete book.Sheets.Units;
    book.SheetNames = book.SheetNames.filter((n) => n !== 'Units');
    const { course, errors } = parseWorkbookToCourse(book);
    expect(course).toBeNull();
    expect(errors.join()).toMatch(/Units/);
  });

  it('reports a malformed Items row with sheet + row number', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [['id', 'kind', 'level', 'unit', 'node'], ['', 'dragdrop', 1, 'u1', 'u1-n1']], // empty id
      Bosses: [['id', 'scope', 'reviewsUnits', 'reviewCount'], ['f', 'final', 'u1', 6]],
    });
    const { errors } = parseWorkbookToCourse(book);
    expect(errors.some((e) => /Items/.test(e) && /row 2/.test(e))).toBe(true);
  });

  it('keeps thaiHint on dragdrop items (required field)', () => {
    const { course } = parseWorkbookToCourse(validBook());
    const d1 = course!.pool.d1;
    expect(d1.kind).toBe('dragdrop');
    if (d1.kind === 'dragdrop') expect(d1.thaiHint).toBe('ฉันวิ่ง');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/content/excelImport.test.ts`
Expected: FAIL — `parseWorkbookToCourse` does not exist.

- [ ] **Step 4: Implement the parser**

Create `src/content/excelImport.ts`:

```typescript
import * as XLSX from 'xlsx';
import type { Course, BossNode } from './course';
import type { Unit, Lesson, CheckpointBoss } from './model';
import type { ContentItem, ContentKind, DragDropItem, PosLabel, Species, PetStage } from '../data/types';

type Row = Record<string, unknown>;

const REQUIRED_SHEETS = ['Course', 'Units', 'Items', 'Bosses'] as const;

function rows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  return ws ? (XLSX.utils.sheet_to_json(ws, { defval: '' }) as Row[]) : [];
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const num = (v: unknown): number => Number(v);
const bool = (v: unknown): boolean => v === true || str(v).toLowerCase() === 'true';
const csv = (v: unknown): string[] => str(v).split(',').map((s) => s.trim()).filter(Boolean);

/** Parse a SheetJS workbook into a Course. Pure: no IO, no validation side effects.
 *  Returns { course: null } when a required sheet is missing or a row is fatal. */
export function parseWorkbookToCourse(wb: XLSX.WorkBook): { course: Course | null; errors: string[] } {
  const errors: string[] = [];
  for (const s of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(s)) errors.push(`missing required sheet "${s}"`);
  }
  if (errors.length) return { course: null, errors };

  // Course (single row).
  const courseRow = rows(wb, 'Course')[0];
  if (!courseRow || !str(courseRow.id)) {
    errors.push('Course row 2: id is required');
    return { course: null, errors };
  }

  // Units.
  const units: Unit[] = [];
  rows(wb, 'Units').forEach((r, i) => {
    const id = str(r.id);
    if (!id) { errors.push(`Units row ${i + 2}: id is required`); return; }
    units.push({ id, title: str(r.title), emoji: str(r.emoji), order: num(r.order) || i + 1, l1Enabled: bool(r.l1Enabled), lessons: [] });
  });

  // Items → pool + node grouping (node id groups items into a Lesson within a unit).
  const pool: Record<string, ContentItem> = {};
  const nodeItems = new Map<string, { unit: string; kind: ContentKind; level: number; ids: string[] }>();
  rows(wb, 'Items').forEach((r, i) => {
    const id = str(r.id);
    const kind = str(r.kind) as ContentKind;
    if (!id) { errors.push(`Items row ${i + 2}: id is required`); return; }
    const level = num(r.level) || 1;
    const l1th = str(r.l1_th);
    const l1 = l1th ? { l1: { th: l1th } } : {};
    let item: ContentItem | null = null;
    switch (kind) {
      case 'dragdrop':
        item = { id, kind, level, thaiHint: str(r.thaiHint), drill: (str(r.variant) || 'pattern') as DragDropItem['drill'],
          slots: csv(r.slots) as PosLabel[], answer: csv(r.answer),
          ...(csv(r.distractors).length ? { distractors: csv(r.distractors) } : {}),
          ...(bool(r.hidePos) ? { hidePos: true } : {}) };
        break;
      case 'flashcard':
        item = { id, kind, level, ...l1, front: str(r.front), back: str(r.back), ...(str(r.audio) ? { audio: str(r.audio) } : {}) };
        break;
      case 'fillblank':
        item = { id, kind, level, ...l1, template: str(r.template), answer: str(r.answer),
          ...(csv(r.alternates).length ? { alternates: csv(r.alternates) } : {}) };
        break;
      case 'matching': {
        // pairs encoded as pair1/pair2/... cells "left|right|th"
        const pairs = Object.keys(r).filter((k) => /^pair\d+$/.test(k)).map((k) => str(r[k])).filter(Boolean)
          .map((cell) => { const [left, right, th] = cell.split('|'); return { left: str(left), right: str(right), ...(str(th) ? { l1: { th: str(th) } } : {}) }; });
        item = { id, kind, level, ...l1, pairs };
        break;
      }
      default:
        errors.push(`Items row ${i + 2}: unknown kind "${str(r.kind)}"`);
        return;
    }
    pool[id] = item;
    const nodeId = str(r.node) || `${str(r.unit)}-${kind}`;
    const grp = nodeItems.get(nodeId) ?? { unit: str(r.unit), kind, level, ids: [] };
    grp.ids.push(id);
    nodeItems.set(nodeId, grp);
  });

  // Attach lessons to units (one Lesson per node group; last node per unit becomes the checkpoint).
  for (const [nodeId, grp] of nodeItems) {
    const unit = units.find((u) => u.id === grp.unit);
    if (!unit) { errors.push(`Items node ${nodeId}: unknown unit "${grp.unit}"`); continue; }
    const lesson: Lesson = { id: nodeId, kind: grp.kind, drill: 'pattern', level: grp.level, itemIds: grp.ids };
    unit.lessons.push(lesson);
  }
  for (const unit of units) {
    if (unit.lessons.length) unit.lessons[unit.lessons.length - 1].isCheckpoint = true;
  }

  // Bosses → gates + finalBoss.
  const gates: BossNode[] = [];
  let finalBoss: BossNode | undefined;
  const bossCfg = (): CheckpointBoss => ({ tierId: 'tier-1', element: 'leaf', name: 'Boss', rivalSprite: { species: 'leaf' as Species, stage: 'adult' as Exclude<PetStage, 'egg'> } });
  rows(wb, 'Bosses').forEach((r, i) => {
    const id = str(r.id);
    const scope = str(r.scope);
    if (!id) { errors.push(`Bosses row ${i + 2}: id is required`); return; }
    const common = { id, title: id, reviewsUnitIds: csv(r.reviewsUnits), ...(num(r.reviewCount) ? { reviewCount: num(r.reviewCount) } : {}),
      ...(csv(r.pinnedItemIds).length ? { pinnedItemIds: csv(r.pinnedItemIds) } : {}), boss: bossCfg() };
    if (scope === 'final') finalBoss = { ...common, scope: 'final', onClear: 'completeCourse' };
    else if (scope === 'gated') gates.push({ ...common, scope: 'gated', afterUnitId: str(r.afterUnit) });
    else errors.push(`Bosses row ${i + 2}: unknown scope "${scope}"`);
  });

  const course: Course = {
    id: str(courseRow.id), title: str(courseRow.title),
    ...(str(courseRow.emoji) ? { emoji: str(courseRow.emoji) } : {}),
    ...(courseRow.l1Ready !== '' ? { l1Ready: bool(courseRow.l1Ready) } : {}),
    pool, units, gates, ...(finalBoss ? { finalBoss } : {}),
  };
  return { course, errors };
}
```

> The parser produces structure; correctness (unknown unit refs, empty itemIds, etc.) is caught by `validateCourse` in Task 8's preview step — do not duplicate those checks here.

- [ ] **Step 5: Run the parser tests**

Run: `npx vitest run src/content/excelImport.test.ts`
Expected: PASS.

- [ ] **Step 6: Type gate + full suite**

Run: `npx tsc -b` → clean.
Run: `npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/content/excelImport.ts src/content/excelImport.test.ts
git commit -m "feat(content): xlsx dep + pure parseWorkbookToCourse parser"
```

---

## Task 8: `ImportTab` — upload → parse → preview-then-commit

**Files:**
- Modify: `src/components/admin/ImportTab.tsx` (replace the stub)
- Create: `src/components/admin/ImportTab.test.tsx`

Flow: `<input type=file accept=".xlsx">` → read to `WorkBook` → `parseWorkbookToCourse` → `validateCourse` → show preview (unit titles, per-unit item counts, gate + final boss config) and **all** errors. Commit button disabled if any parse or validation error; on commit calls `onCommit(course)` (which `AdminShell` wires to `setCourse`). Inject the workbook reader so tests don't need a real File.

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/ImportTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { ImportTab } from './ImportTab';

function validBook(): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  add('Course', [['id', 'title', 'emoji'], ['c1', 'Course One', '📘']]);
  add('Units', [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]]);
  add('Items', [['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'variant', 'slots', 'answer'],
    ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'ฉันวิ่ง', 'pattern', 'Pronoun,Verb', 'I,run']]);
  add('Bosses', [['id', 'scope', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'], ['f', 'final', 'u1', 6, 'd1']]);
  return book;
}

describe('ImportTab', () => {
  it('previews a valid workbook and commits it', async () => {
    const onCommit = vi.fn();
    render(<ImportTab onCommit={onCommit} readWorkbook={async () => validBook()} />);
    fireEvent.change(screen.getByLabelText(/excel file/i), { target: { files: [new File([''], 'c.xlsx')] } });
    await screen.findByText(/Unit One/);
    const commit = screen.getByRole('button', { name: /commit/i });
    expect(commit).not.toBeDisabled();
    fireEvent.click(commit);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].id).toBe('c1');
  });

  it('blocks commit and shows errors for an invalid workbook', async () => {
    const onCommit = vi.fn();
    const book = validBook();
    delete book.Sheets.Bosses; // no final boss → validateCourse fails
    book.SheetNames = book.SheetNames.filter((n) => n !== 'Bosses');
    render(<ImportTab onCommit={onCommit} readWorkbook={async () => book} />);
    fireEvent.change(screen.getByLabelText(/excel file/i), { target: { files: [new File([''], 'c.xlsx')] } });
    await screen.findByText(/missing required sheet/i);
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/admin/ImportTab.test.tsx`
Expected: FAIL — stub has no file input.

- [ ] **Step 3: Implement `ImportTab`**

Replace `src/components/admin/ImportTab.tsx`:

```typescript
import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course } from '../../content/course';
import { parseWorkbookToCourse } from '../../content/excelImport';
import { validateCourse } from '../../content/validate';

/** Default reader: File → SheetJS WorkBook. Injectable for tests. */
async function defaultReadWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

export function ImportTab({ onCommit, readWorkbook = defaultReadWorkbook }: {
  onCommit: (c: Course) => void;
  readWorkbook?: (file: File) => Promise<XLSX.WorkBook>;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFile(file: File) {
    const wb = await readWorkbook(file);
    const { course: parsed, errors: parseErrors } = parseWorkbookToCourse(wb);
    const validation = parsed ? validateCourse(parsed) : { ok: false, errors: [] };
    setCourse(parsed);
    setErrors([...parseErrors, ...validation.errors]);
  }

  const canCommit = course !== null && errors.length === 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label>Excel file (.xlsx)
        <input type="file" accept=".xlsx" aria-label="excel file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      </label>

      {errors.length > 0 && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-red-700">
          {errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {course && (
        <div className="rounded border p-2">
          <p className="font-semibold">{course.emoji} {course.title} <span className="text-slate-400">({course.id})</span></p>
          <ul>
            {course.units.map((u) => (
              <li key={u.id}>{u.emoji} {u.title} — {u.lessons.reduce((n, l) => n + l.itemIds.length, 0)} items</li>
            ))}
          </ul>
          <p>Gates: {course.gates.length} · Final boss: {course.finalBoss ? course.finalBoss.boss.name : 'none'}</p>
        </div>
      )}

      <button type="button" disabled={!canCommit} onClick={() => course && onCommit(course)}
        className="self-start rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Commit import</button>
    </div>
  );
}
```

- [ ] **Step 4: Run the ImportTab tests**

Run: `npx vitest run src/components/admin/ImportTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type gate + full suite**

Run: `npx tsc -b` → clean.
Run: `npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ImportTab.tsx src/components/admin/ImportTab.test.tsx
git commit -m "feat(admin): Excel Import tab with preview-then-commit"
```

---

## Task 9: Final verification + a11y pass

**Files:** none (verification); small a11y fixes if needed in `BossesTab.tsx` / `ImportTab.tsx`.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: green, count ≥ 803 + new tests (migrate, validate, seed, BossesTab, excelImport, ImportTab). Note the final number.

- [ ] **Step 2: Type gate**

Run: `npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: a11y review of the two new surfaces**

Apply the `accessibility` skill to `BossesTab.tsx` and `ImportTab.tsx`: every control has an associated label (verify `aria-label`/`<label>` coverage), boss groups use `fieldset`/`legend`, the error lists use `aria-live="polite"` (already wired). Fix any gaps; re-run `npm test` if you touch a file with a test.

- [ ] **Step 5: Manual smoke (OFFLINE / fresh install)**

> Live `hydrateCourse('default')` overrides `SEED_COURSE`, so run offline or against a fresh install or bosses read as "missing" when they are the intended fallback.

Run: `npm run dev`. Then:
- `#admin` (admin custom claim) → **Bosses** tab: add a gate (set `afterUnit`, check a reviews unit), edit the final boss name → **Save** → reload → values persist.
- **Import** tab: upload an `.xlsx` with a missing/invalid sheet → preview shows errors, Commit disabled. Upload a valid workbook → preview shows units/items/bosses, Commit enabled → commit → course loads.
- Player: guest → PetRoom → Play ▶ → course → clear units → ⚔️ gate appears after its unit, 👑 finale appears last and completes the course (persists across reload).

- [ ] **Step 6: Confirm `firebase.json` is still unstaged**

Run: `git status --short`
Expected: `M firebase.json` present and **not** staged; no other stray changes. Never `git add` it.

- [ ] **Step 7: Update the handoff / mark P3b done**

Note in the P3b handoff doc (`docs/superpowers/plans/2026-06-28-drill-revamp-p3b-handoff.md`) that P3b is complete (commits + final test count), and that Draft PR #33 stays DRAFT until the whole drill-revamp line ships.

```bash
git add docs/superpowers/plans/2026-06-28-drill-revamp-p3b-handoff.md
git commit -m "docs: mark P3b complete"
```

---

## Self-review notes (for the executor)

- **Deferred (NOT in this plan, by design):** deterministic boss sampling (seed RNG by course id), unifying the duplicate Fisher–Yates (`review.ts` vs `check.ts`), flashcard speaking, matching images. Do not pull these in.
- **Spec coverage:** §3.1 admin migration → Tasks 4–6; §3.2 Excel → Tasks 7–8; §3.3 seed → Task 3; §3.4 finalBoss enforcement → Tasks 1–2; §3.5 dup-afterUnitId → Task 2.
- **Type-check seam:** Tasks 4 and 5 only type-check together (AdminShell passes the new `course` prop). They share one commit — do not commit between them.
- **Test fixtures:** every dragdrop fixture sets `thaiHint`. The `validate.test.ts` `base` fixture gains a `finalBoss` in Task 2; do not revert it.
