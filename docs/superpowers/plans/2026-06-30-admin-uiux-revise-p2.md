# Admin UI/UX Revise — Phase 2 (shell + rail + course switcher + Courses surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal-tab admin shell with a full-width grouped left rail + header course switcher, and add a new Courses surface that lists/creates/switches/deletes courses (the data model is already multi-course; the old admin never exposed it).

**Architecture:** Build leaf pieces first (data layer → counts helper → rail → switcher → courses-admin hook → Courses surface), then rewrite `AdminShell` last to compose them. The shell owns one `useCoursesAdmin` instance + the active-course `draft`; the rail and switcher are dumb, props-driven, and accessible (roving `role=tab`/`tablist` vertical for the rail, `aria-haspopup` listbox for the switcher). The Courses surface reuses the P1 `SearchableList` kit and relocates `ImportTab`'s xlsx parse into a "New from file…" action.

**Tech Stack:** React 18 + TypeScript (strict, `tsc -b`), Zustand (`useContentStore`), Vitest + Testing Library, Tailwind (admin tokens scoped to `.admin-root`), SheetJS (`xlsx`).

---

## Context the executor needs

- **Repo / branch:** `D:/ai_projects/AI_design_thinking/sentence-pet`, branch **`admin-uiux-revise`** (do NOT branch off main; P2 stacks on P1). Confirm with `git status -sb` → `## admin-uiux-revise`.
- **Run all shell commands via Bash with an explicit cd** (the PowerShell tool resolves cwd wrong on this machine):
  `cd /d/ai_projects/AI_design_thinking/sentence-pet && <cmd>`
- **Approved visual target:** `temp/admin-mockup/index.html` + screenshots `temp/admin-mockup/view-courses.png` (the new surface) and `temp/admin-mockup/view-pool.png` (the shell frame). Build to these.
- **Per-task gates (run before every commit):**
  - `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run <the test file(s) for this task>`
  - `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`  (NOT `--noEmit`)
  - On the FINAL task only, also: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vite build`
- **Hazards (carry forward):** stage explicit files, never `git add -A`. **Append**/adjust `*.test.tsx` — never clobber existing test bodies. Admin tokens stay under `.admin-root` in `src/index.css`; never global `@theme`. Windows vitest "Worker exited unexpectedly" → re-run. No em-dashes in UI copy.
- **Existing kit (reuse, do not rebuild):** `src/components/admin/ui/` barrel exports `Button, Field, TextInput, NumberInput, Select, Checkbox, Card, SectionLabel, ValidationSummary, SaveBar, AdminHeader, Tabs, FilterChips, SearchableList`. `SaveBar` already accepts `dirty?: boolean` and `saveLabel?: string`.

## File Structure (what this phase creates / modifies)

- **Create** `src/firebase/content.ts` → add `deleteCourse(id)` (modify existing file).
- **Create** `src/components/admin/coursesTab/courseCounts.ts` — `courseCounts(course)` → `{ units, lessons, items, bosses }`. One source of truth for counts, reused by rail + Courses list rows + Contents cards.
- **Create** `src/components/admin/coursesTab/newCourse.ts` — `makeCourseId(title, existingIds)` + `emptyCourse(meta)` factory for "+ New course".
- **Create** `src/components/admin/ui/AdminRail.tsx` — grouped vertical nav (roving `role=tab`/`tablist`). Export from `ui/index.ts`.
- **Create** `src/components/admin/ui/CourseSwitcher.tsx` — header listbox popover. Export from `ui/index.ts`.
- **Create** `src/components/admin/useCoursesAdmin.ts` — hook: `index`, `activeCourseId`, `refresh()`, `switchTo(id)`, `create(meta)`, `remove(id)`.
- **Create** `src/components/admin/CoursesTab.tsx` — the new Courses surface (master-detail).
- **Modify** `src/components/admin/AdminShell.tsx` — full-width, no wrapping `<Card>`, header (AdminHeader + CourseSwitcher) + AdminRail + active surface, drop the `import` top tab, resync `draft` on course switch.
- **Modify** `src/components/admin/AdminShell.test.tsx` — update tab→rail assertions, add Courses-surface + switcher coverage (adjust, don't clobber).
- **Leave alone:** `PoolTab`, `JourneyTab`, `BossesTab`, `PetsTab` render unchanged into the new frame (their master-detail conversions are P4). `ImportTab.tsx` stays on disk for now (the standalone Import tab is removed from nav here; the file is deleted in P5 once `parseWorkbookToCourse` reuse is confirmed).

---

### Task 1: `deleteCourse(id)` in the firebase content layer

**Files:**
- Modify: `src/firebase/content.ts`
- Test: `src/firebase/content.test.ts` (create if absent; otherwise append)

- [ ] **Step 1: Write the failing test**

Check first whether `src/firebase/content.test.ts` exists (`cd /d/ai_projects/AI_design_thinking/sentence-pet && ls src/firebase/content.test.ts`). If it exists, APPEND the `describe('deleteCourse', …)` block and reuse its existing `firebase/firestore` mock instead of re-declaring one. If it does NOT exist, create it with this content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture batch ops + index reads so we can assert deleteCourse's behaviour.
const batchDelete = vi.fn();
const batchSet = vi.fn();
const commit = vi.fn().mockResolvedValue(undefined);
let indexCourses: Array<{ id: string; title: string }> = [];

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ __path: args.slice(1).join('/') }),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ courses: indexCourses }) })),
  setDoc: vi.fn(),
  writeBatch: () => ({ set: batchSet, delete: batchDelete, commit }),
}));
vi.mock('./db', () => ({ db: {} }));

import { deleteCourse } from './content';

beforeEach(() => {
  batchDelete.mockClear();
  batchSet.mockClear();
  commit.mockClear();
  indexCourses = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ];
});

describe('deleteCourse', () => {
  it('deletes the course doc and rewrites the index without that id', async () => {
    await deleteCourse('a');
    expect(batchDelete).toHaveBeenCalledTimes(1);
    // Index is rewritten with only the surviving entry.
    const indexWrite = batchSet.mock.calls.at(-1);
    expect(indexWrite?.[1]).toEqual({ courses: [{ id: 'b', title: 'B' }] });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('refuses to delete the last remaining course', async () => {
    indexCourses = [{ id: 'only', title: 'Only' }];
    await expect(deleteCourse('only')).rejects.toThrow(/last course/i);
    expect(commit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/firebase/content.test.ts`
Expected: FAIL — `deleteCourse` is not exported.

- [ ] **Step 3: Implement `deleteCourse`**

In `src/firebase/content.ts`, add after `saveCourse`:

```ts
/** Delete one course: remove its doc and drop its index entry (single batch).
 *  Refuses to delete the last remaining course (the app must always have one). */
export async function deleteCourse(id: string): Promise<void> {
  const indexSnap = await getDoc(COURSES_INDEX);
  const existing = (indexSnap.data()?.courses ?? []) as CourseIndexEntry[];
  const remaining = existing.filter((e) => e.id !== id);
  if (remaining.length === 0) throw new Error('Cannot delete the last course.');

  const batch = writeBatch(db);
  batch.delete(courseDoc(id));
  batch.set(COURSES_INDEX, { courses: remaining });
  await batch.commit();
}
```

(`writeBatch` and `doc` are already imported; `courseDoc`/`COURSES_INDEX` already exist in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/firebase/content.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/firebase/content.ts src/firebase/content.test.ts && git commit -m "feat(admin): add deleteCourse (doc + index entry, blocks last course)"
```

---

### Task 2: `courseCounts` helper

**Files:**
- Create: `src/components/admin/coursesTab/courseCounts.ts`
- Test: `src/components/admin/coursesTab/courseCounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { courseCounts } from './courseCounts';
import type { Course } from '../../../content/course';

const COURSE: Course = {
  id: 'c1',
  title: 'C1',
  pool: { a: {} as never, b: {} as never, c: {} as never },
  units: [
    { id: 'u1', title: 'U1', emoji: '🐣', order: 1, l1Enabled: false,
      lessons: [{ id: 'l1', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'] },
                { id: 'l2', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['b'] }] },
    { id: 'u2', title: 'U2', emoji: '🐥', order: 2, l1Enabled: false,
      lessons: [{ id: 'l3', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['c'] }] },
  ],
  gates: [{ id: 'g1' } as never, { id: 'g2' } as never],
  finalBoss: { id: 'fb' } as never,
};

describe('courseCounts', () => {
  it('counts units, lessons, items, and bosses (gates + final)', () => {
    expect(courseCounts(COURSE)).toEqual({ units: 2, lessons: 3, items: 3, bosses: 3 });
  });

  it('counts a bare course with no final boss', () => {
    expect(courseCounts({ ...COURSE, gates: [], finalBoss: undefined }))
      .toEqual({ units: 2, lessons: 3, items: 3, bosses: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/coursesTab/courseCounts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
import type { Course } from '../../../content/course';

export interface CourseCounts {
  units: number;
  lessons: number;
  items: number;
  bosses: number;
}

/** Aggregate counts shown in the rail, the Courses list rows, and the Contents
 *  summary cards. `bosses` = gates + (final boss, if present). */
export function courseCounts(course: Course): CourseCounts {
  const lessons = course.units.reduce((n, u) => n + u.lessons.length, 0);
  return {
    units: course.units.length,
    lessons,
    items: Object.keys(course.pool).length,
    bosses: course.gates.length + (course.finalBoss ? 1 : 0),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/coursesTab/courseCounts.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/coursesTab/courseCounts.ts src/components/admin/coursesTab/courseCounts.test.ts && git commit -m "feat(admin): add courseCounts helper (units/lessons/items/bosses)"
```

---

### Task 3: `makeCourseId` + `emptyCourse` factory

**Files:**
- Create: `src/components/admin/coursesTab/newCourse.ts`
- Test: `src/components/admin/coursesTab/newCourse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeCourseId, emptyCourse } from './newCourse';

describe('makeCourseId', () => {
  it('slugifies the title', () => {
    expect(makeCourseId('Survival Thai!', [])).toBe('survival-thai');
  });

  it('disambiguates against existing ids', () => {
    expect(makeCourseId('Thai', ['thai'])).toBe('thai-2');
    expect(makeCourseId('Thai', ['thai', 'thai-2'])).toBe('thai-3');
  });

  it('falls back to "course" when the title has no slug characters', () => {
    expect(makeCourseId('!!!', [])).toBe('course');
  });
});

describe('emptyCourse', () => {
  it('builds a structurally-valid-but-empty course with the given meta', () => {
    const c = emptyCourse({ id: 'thai', title: 'Thai', emoji: '🇹🇭' });
    expect(c).toEqual({ id: 'thai', title: 'Thai', emoji: '🇹🇭', pool: {}, units: [], gates: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/coursesTab/newCourse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { Course } from '../../../content/course';

/** kebab-case slug of `title`, deduped against `existingIds` (-2, -3, …). */
export function makeCourseId(title: string, existingIds: readonly string[]): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'course';
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A new, empty course scaffold. Not yet playable (no units/boss); the admin
 *  fills it in via the other surfaces. SaveBar gates persistence on validity. */
export function emptyCourse(meta: { id: string; title: string; emoji?: string }): Course {
  return {
    id: meta.id,
    title: meta.title,
    ...(meta.emoji !== undefined && { emoji: meta.emoji }),
    pool: {},
    units: [],
    gates: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/coursesTab/newCourse.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/coursesTab/newCourse.ts src/components/admin/coursesTab/newCourse.test.ts && git commit -m "feat(admin): add makeCourseId + emptyCourse factory"
```

---

### Task 4: `AdminRail` — grouped vertical nav

**Files:**
- Create: `src/components/admin/ui/AdminRail.tsx`
- Modify: `src/components/admin/ui/index.ts` (export)
- Test: `src/components/admin/ui/AdminRail.test.tsx`

Mirror `Tabs.tsx`'s roving-arrow a11y (`role="tablist"` + `role="tab"` + `aria-selected` + roving `tabIndex`), but vertical (ArrowUp/ArrowDown across the flattened item order) and with group headings + per-item counts. Keeping `role=tab`/`tablist` lets the shell stay an accessible tablist.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminRail } from './AdminRail';
import type { RailGroup } from './AdminRail';

const GROUPS: RailGroup<string>[] = [
  { heading: 'Workspace', items: [{ id: 'courses', label: 'Courses', count: 3 }] },
  { heading: 'Course · Thai', items: [
    { id: 'pool', label: 'Items', count: 214 },
    { id: 'journey', label: 'Journey', count: 8 },
    { id: 'bosses', label: 'Bosses', count: 10 },
  ] },
  { heading: 'Creatures · global', items: [{ id: 'pets', label: 'Pets', count: 63 }] },
];

describe('AdminRail', () => {
  it('renders group headings, labels, and counts inside a tablist', () => {
    render(<AdminRail groups={GROUPS} active="courses" onSelect={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /items/i })).toHaveTextContent('214');
  });

  it('marks the active item aria-selected and fires onSelect on click', () => {
    const onSelect = vi.fn();
    render(<AdminRail groups={GROUPS} active="pool" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: /items/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /journey/i }));
    expect(onSelect).toHaveBeenCalledWith('journey');
  });

  it('moves selection with ArrowDown across the flattened item order', () => {
    const onSelect = vi.fn();
    render(<AdminRail groups={GROUPS} active="courses" onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: /courses/i }), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('pool');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/AdminRail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `AdminRail`**

```tsx
import type { KeyboardEvent } from 'react';

export type RailItem<T extends string> = { id: T; label: string; count?: number; emoji?: string };
export type RailGroup<T extends string> = { heading: string; items: RailItem<T>[] };

/**
 * Grouped vertical nav for the admin console. Real `role="tablist"` semantics
 * (vertical orientation) with `aria-selected` + roving tabIndex and Up/Down arrow
 * navigation across the flattened item order. Group headings are presentational.
 * Panels are rendered by the caller (this is a switcher, not a panel host).
 */
export function AdminRail<T extends string>({
  groups,
  active,
  onSelect,
}: {
  groups: readonly RailGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  const flat = groups.flatMap((g) => g.items);
  const activeIndex = flat.findIndex((i) => i.id === active);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const next = (activeIndex + delta + flat.length) % flat.length;
    onSelect(flat[next].id);
  }

  return (
    <nav
      role="tablist"
      aria-orientation="vertical"
      aria-label="Admin sections"
      className="flex w-52 shrink-0 flex-col gap-4 border-r border-slate-200 py-4 pr-4"
    >
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
            {group.heading}
          </p>
          {group.items.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(item.id)}
                onKeyDown={onKeyDown}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.emoji && <span aria-hidden>{item.emoji}</span>}
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums text-slate-400">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Export from the barrel**

In `src/components/admin/ui/index.ts`, append:

```ts
export { AdminRail } from './AdminRail';
export type { RailGroup, RailItem } from './AdminRail';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/AdminRail.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/ui/AdminRail.tsx src/components/admin/ui/AdminRail.test.tsx src/components/admin/ui/index.ts && git commit -m "feat(admin): add AdminRail grouped vertical nav"
```

---

### Task 5: `CourseSwitcher` — header listbox popover

**Files:**
- Create: `src/components/admin/ui/CourseSwitcher.tsx`
- Modify: `src/components/admin/ui/index.ts` (export)
- Test: `src/components/admin/ui/CourseSwitcher.test.tsx`

A trigger button showing the active course (emoji + title + id), opening a `role="listbox"` popover. Selecting an option fires `onSelect(id)` and closes. Escape closes. The popover is absolutely positioned with `z-50`; the header is NOT `overflow-hidden`, so it will not clip (do not nest this inside an `overflow-hidden` container — the clipping trap the handoff warns about).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseSwitcher } from './CourseSwitcher';
import type { CourseIndexEntry } from '../../../content/course';

const COURSES: CourseIndexEntry[] = [
  { id: 'thai', title: 'Survival Thai', emoji: '🇹🇭' },
  { id: 'money', title: 'Market & Money', emoji: '💰' },
];

describe('CourseSwitcher', () => {
  it('shows the active course on the trigger', () => {
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /survival thai/i })).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('opens the listbox and selects a course', () => {
    const onSelect = vi.fn();
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /survival thai/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /market & money/i }));
    expect(onSelect).toHaveBeenCalledWith('money');
    // closes after selection
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape without selecting', () => {
    const onSelect = vi.fn();
    render(<CourseSwitcher courses={COURSES} activeId="thai" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /survival thai/i }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/CourseSwitcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CourseSwitcher`**

```tsx
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CourseIndexEntry } from '../../../content/course';

/**
 * Header control that shows the active course and switches the editing context.
 * Trigger opens an absolutely-positioned `role="listbox"` (z-50, so it is not
 * clipped — keep it out of any `overflow-hidden` ancestor). Escape and
 * select-then-close are handled here; the caller loads the chosen course.
 */
export function CourseSwitcher({
  courses,
  activeId,
  onSelect,
}: {
  courses: readonly CourseIndexEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = courses.find((c) => c.id === activeId);

  function choose(id: string) {
    setOpen(false);
    if (id !== activeId) onSelect(id);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {active?.emoji && <span aria-hidden>{active.emoji}</span>}
        <span>{active?.title ?? 'Select course'}</span>
        {active && <code className="rounded bg-slate-100 px-1 text-xs text-slate-500">{active.id}</code>}
        <span aria-hidden className="text-slate-400">▾</span>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            aria-label="Courses"
            onKeyDown={onKeyDown}
            tabIndex={-1}
            className="absolute left-0 top-full z-50 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {courses.map((c) => {
              const selected = c.id === activeId;
              return (
                <li key={c.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => choose(c.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      selected ? 'font-semibold text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    {c.emoji && <span aria-hidden>{c.emoji}</span>}
                    <span className="flex-1">{c.title}</span>
                    {selected && <span aria-hidden className="text-indigo-500">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Export from the barrel**

In `src/components/admin/ui/index.ts`, append:

```ts
export { CourseSwitcher } from './CourseSwitcher';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/CourseSwitcher.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/ui/CourseSwitcher.tsx src/components/admin/ui/CourseSwitcher.test.tsx src/components/admin/ui/index.ts && git commit -m "feat(admin): add CourseSwitcher header listbox"
```

---

### Task 6: `useCoursesAdmin` — courses data wiring hook

**Files:**
- Create: `src/components/admin/useCoursesAdmin.ts`
- Test: `src/components/admin/useCoursesAdmin.test.tsx`

One hook owning the course index + the list/switch/create/delete actions. The shell instantiates it once and feeds `index`/`activeCourseId`/actions to both the CourseSwitcher and the CoursesTab (single source of truth — do NOT instantiate it twice).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const fetchCoursesIndex = vi.fn();
const fetchCourse = vi.fn();
const saveCourse = vi.fn().mockResolvedValue(undefined);
const deleteCourse = vi.fn().mockResolvedValue(undefined);

vi.mock('../../firebase/content', () => ({
  fetchCoursesIndex: () => fetchCoursesIndex(),
  fetchCourse: (id: string) => fetchCourse(id),
  saveCourse: (c: unknown) => saveCourse(c),
  deleteCourse: (id: string) => deleteCourse(id),
}));

import { useCoursesAdmin } from './useCoursesAdmin';
import { useContentStore } from '../../content/store';

const THAI = { id: 'thai', title: 'Thai', pool: {}, units: [], gates: [] };

beforeEach(() => {
  fetchCoursesIndex.mockReset().mockResolvedValue([
    { id: 'thai', title: 'Thai' },
    { id: 'money', title: 'Money' },
  ]);
  fetchCourse.mockReset().mockResolvedValue(THAI);
  saveCourse.mockClear();
  deleteCourse.mockClear();
});

describe('useCoursesAdmin', () => {
  it('loads the course index on mount', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await waitFor(() => expect(result.current.index).toHaveLength(2));
  });

  it('switchTo fetches the course and sets it active in the store', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.switchTo('thai'); });
    expect(fetchCourse).toHaveBeenCalledWith('thai');
    expect(useContentStore.getState().activeCourseId).toBe('thai');
  });

  it('create saves a new empty course, refreshes the index, and switches to it', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.create({ title: 'Brand New' }); });
    expect(saveCourse).toHaveBeenCalled();
    const saved = saveCourse.mock.calls[0][0];
    expect(saved.title).toBe('Brand New');
    expect(useContentStore.getState().course?.id).toBe(saved.id);
  });

  it('remove deletes then refreshes the index', async () => {
    const { result } = renderHook(() => useCoursesAdmin());
    await act(async () => { await result.current.remove('money'); });
    expect(deleteCourse).toHaveBeenCalledWith('money');
    expect(fetchCoursesIndex).toHaveBeenCalledTimes(2); // mount + after remove
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/useCoursesAdmin.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useContentStore } from '../../content/store';
import { fetchCoursesIndex, fetchCourse, saveCourse, deleteCourse } from '../../firebase/content';
import type { CourseIndexEntry } from '../../content/course';
import { emptyCourse, makeCourseId } from './coursesTab/newCourse';

/** Owns the course index + switch/create/delete actions. Instantiate ONCE in
 *  the shell and pass `index`/`activeCourseId`/actions down (single source). */
export function useCoursesAdmin() {
  const [index, setIndex] = useState<CourseIndexEntry[]>([]);
  const activeCourseId = useContentStore((s) => s.activeCourseId);
  const setCourse = useContentStore((s) => s.setCourse);

  const refresh = useCallback(async () => {
    setIndex(await fetchCoursesIndex());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const switchTo = useCallback(async (id: string) => {
    const course = await fetchCourse(id);
    if (course) setCourse(course, 'live');
  }, [setCourse]);

  const create = useCallback(async (meta: { title: string; emoji?: string }) => {
    const existing = await fetchCoursesIndex();
    const course = emptyCourse({ id: makeCourseId(meta.title, existing.map((e) => e.id)), ...meta });
    await saveCourse(course);
    await refresh();
    setCourse(course, 'live');
  }, [refresh, setCourse]);

  const remove = useCallback(async (id: string) => {
    await deleteCourse(id);
    await refresh();
    // If the active course was deleted, switch to the first surviving one.
    if (id === useContentStore.getState().activeCourseId) {
      const survivors = await fetchCoursesIndex();
      if (survivors[0]) await switchTo(survivors[0].id);
    }
  }, [refresh, switchTo]);

  return { index, activeCourseId, refresh, switchTo, create, remove };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/useCoursesAdmin.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/useCoursesAdmin.ts src/components/admin/useCoursesAdmin.test.tsx && git commit -m "feat(admin): add useCoursesAdmin wiring hook"
```

---

### Task 7: `CoursesTab` — the new Courses surface

**Files:**
- Create: `src/components/admin/CoursesTab.tsx`
- Test: `src/components/admin/CoursesTab.test.tsx`

Master-detail: `SearchableList` of courses (emoji + title + counts; active row badged) with `+ New course` and `⬇ New from file…` footer actions, a meta editor (Title / Emoji / Course id — id read-only), a Contents summary (Units / Lessons / Items / Bosses via `courseCounts`), and a delete-with-confirm. The active course's meta is edited through the SAME `draft`/`onChange` contract the other surfaces use, so the shell's SaveBar persists it. "New from file…" reuses `parseWorkbookToCourse` (relocated parse path) and calls `onImport(course)`.

The list iterates `courses` (the index), but the meta editor edits the active `course` draft. Reading the per-row counts from the index alone is impossible (index has no pool/units); show counts only for the active course row (from `courseCounts(course)`), and just the title for the rest. (Per-row full counts for inactive courses is a P4+ nicety — note it, do not block on it.)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoursesTab } from './CoursesTab';
import type { Course, CourseIndexEntry } from '../../content/course';

const COURSE: Course = {
  id: 'thai', title: 'Survival Thai', emoji: '🇹🇭',
  pool: { a: {} as never },
  units: [{ id: 'u1', title: 'U1', emoji: '🐣', order: 1, l1Enabled: false,
    lessons: [{ id: 'l1', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'] }] }],
  gates: [],
  finalBoss: undefined,
};
const INDEX: CourseIndexEntry[] = [
  { id: 'thai', title: 'Survival Thai', emoji: '🇹🇭' },
  { id: 'money', title: 'Market & Money', emoji: '💰' },
];

function setup(over: Partial<React.ComponentProps<typeof CoursesTab>> = {}) {
  const props = {
    course: COURSE, onChange: vi.fn(), index: INDEX,
    onCreate: vi.fn(), onDelete: vi.fn(), onSwitch: vi.fn(), onImport: vi.fn(),
    ...over,
  };
  render(<CoursesTab {...props} />);
  return props;
}

describe('CoursesTab', () => {
  it('lists courses and badges the active one', () => {
    setup();
    expect(screen.getByText('Survival Thai')).toBeInTheDocument();
    expect(screen.getByText('Market & Money')).toBeInTheDocument();
    expect(screen.getByText(/editing/i)).toBeInTheDocument();
  });

  it('shows the active course meta with a read-only id and the contents counts', () => {
    setup();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Survival Thai');
    expect(screen.getByLabelText(/course id/i)).toHaveAttribute('readonly');
    expect(screen.getByText(/units/i)).toBeInTheDocument();
  });

  it('edits the title through onChange', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Survival Thai 2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Survival Thai 2' }));
  });

  it('clicking a non-active course switches to it', () => {
    const { onSwitch } = setup();
    fireEvent.click(screen.getByText('Market & Money'));
    expect(onSwitch).toHaveBeenCalledWith('money');
  });

  it('delete requires confirmation then calls onDelete', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: /delete course/i }));
    // confirm step
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledWith('thai');
  });

  it('+ New course prompts for a title and calls onCreate', () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole('button', { name: /new course/i }));
    fireEvent.change(screen.getByLabelText(/new course title/i), { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(onCreate).toHaveBeenCalledWith({ title: 'Fresh' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CoursesTab`**

```tsx
import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course, CourseIndexEntry } from '../../content/course';
import { parseWorkbookToCourse } from '../../content/excelImport';
import { SearchableList, Field, TextInput, Button, SectionLabel } from './ui';
import { courseCounts } from './coursesTab/courseCounts';

async function defaultReadWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

export function CoursesTab({
  course,
  onChange,
  index,
  onCreate,
  onDelete,
  onSwitch,
  onImport,
  readWorkbook = defaultReadWorkbook,
}: {
  course: Course;                                    // the active (draft) course
  onChange: (c: Course) => void;                     // edit active course meta
  index: readonly CourseIndexEntry[];                // all courses
  onCreate: (meta: { title: string }) => void;
  onDelete: (id: string) => void;
  onSwitch: (id: string) => void;
  onImport: (c: Course) => void;                     // whole-course xlsx commit
  readWorkbook?: (file: File) => Promise<XLSX.WorkBook>;
}) {
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const counts = courseCounts(course);

  async function onFile(file: File) {
    const wb = await readWorkbook(file);
    const { course: parsed } = parseWorkbookToCourse(wb);
    if (parsed) onImport(parsed);
  }

  return (
    <div className="flex gap-6">
      <SearchableList
        items={index}
        total={index.length}
        countNoun="course"
        getKey={(c) => c.id}
        selectedKey={course.id}
        onSelect={(id) => { if (id !== course.id) onSwitch(id); }}
        searchText={(c) => `${c.title} ${c.id}`}
        query={query}
        onQuery={setQuery}
        placeholder="Search courses…"
        renderRow={(c) => (
          <span className="flex items-center gap-2">
            {c.emoji && <span aria-hidden>{c.emoji}</span>}
            <span className="flex-1">{c.title}</span>
            {c.id === course.id && (
              <span className="text-xs font-semibold uppercase text-indigo-600">editing</span>
            )}
          </span>
        )}
        footer={
          <div className="flex flex-col gap-2">
            {creating ? (
              <div className="flex flex-col gap-2">
                <Field label="New course title">
                  <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={!newTitle.trim()}
                    onClick={() => { onCreate({ title: newTitle.trim() }); setCreating(false); setNewTitle(''); }}>
                    Create
                  </Button>
                  <Button variant="ghost" onClick={() => { setCreating(false); setNewTitle(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" onClick={() => setCreating(true)}>+ New course</Button>
            )}
            <label className="cursor-pointer text-sm text-indigo-600 hover:underline">
              ⬇ New from file…
              <input type="file" accept=".xlsx" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            </label>
          </div>
        }
      />

      <div className="flex-1">
        <SectionLabel>Course</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Title"><TextInput value={course.title} onChange={(e) => onChange({ ...course, title: e.target.value })} /></Field>
          <Field label="Emoji"><TextInput value={course.emoji ?? ''} onChange={(e) => onChange({ ...course, emoji: e.target.value })} /></Field>
          <Field label="Course id"><TextInput value={course.id} readOnly /></Field>
        </div>

        <SectionLabel>Contents</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Units" value={counts.units} />
          <Stat label="Lessons" value={counts.lessons} />
          <Stat label="Items" value={counts.items} />
          <Stat label="Bosses" value={counts.bosses} />
        </div>

        <SectionLabel>Manage</SectionLabel>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-700">Delete this course.</p>
          <p className="text-red-600">Removes its units, lessons, items and bosses. Pets are unaffected. Cannot be undone.</p>
          {confirming ? (
            <div className="mt-2 flex gap-2">
              <Button variant="danger" onClick={() => onDelete(course.id)}>Confirm delete</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          ) : (
            <Button className="mt-2" variant="danger" onClick={() => setConfirming(true)}>Delete course</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-2xl font-bold tabular-nums text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
```

**Confirmed primitive contracts (no kit changes needed):** `TextInput` spreads native `InputHTMLAttributes`, so `onChange` receives a DOM **event** (`(e) => …e.target.value`, per `ItemEditor.tsx`) and `readOnly` works natively. `Button`'s `ButtonVariant` already includes `'danger'` (red). The `CoursesTab` code above uses both correctly — do NOT modify `Button.tsx`/`TextInput.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/CoursesTab.tsx src/components/admin/CoursesTab.test.tsx && git commit -m "feat(admin): add CoursesTab surface (list/meta/contents/delete/new-from-file)"
```

---

### Task 8: Rewrite `AdminShell` to compose the new frame

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/admin/AdminShell.test.tsx`

Full-width container; remove the single wrapping `<Card>` (kills the nested-card hazard); compose `AdminHeader` + `CourseSwitcher` in the header row, `AdminRail` on the left, the active surface on the right; drop the `import` top tab; resync `draft` when the active course changes (switch/create replaces the store course). Existing surfaces render unchanged.

- [ ] **Step 1: Update the shell**

Replace the body of `src/components/admin/AdminShell.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { getActivePetDefs } from '../../domain/petDef';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { AdminHeader, AdminRail, CourseSwitcher, SaveBar, ValidationSummary } from './ui';
import type { RailGroup } from './ui';
import { useCoursesAdmin } from './useCoursesAdmin';
import { courseCounts } from './coursesTab/courseCounts';
import { CoursesTab } from './CoursesTab';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { PetsTab } from './PetsTab';

type Surface = 'courses' | 'pool' | 'journey' | 'bosses' | 'pets';

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const { index, activeCourseId, switchTo, create, remove } = useCoursesAdmin();

  const [draft, setDraft] = useState<Course | null>(liveCourse);
  const [surface, setSurface] = useState<Surface>('courses');
  const [status, setStatus] = useState('');

  // Resync the editing draft whenever the active course identity changes
  // (switch / create / delete-fallback replaces the store course).
  const liveId = liveCourse?.id ?? null;
  useEffect(() => { setDraft(liveCourse); }, [liveId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return <p className="p-4 text-sm text-red-600">No course loaded.</p>;
  const currentDraft: Course = draft;
  const dirty = currentDraft !== liveCourse;
  const validation = validateCourse(currentDraft, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) });
  const counts = courseCounts(currentDraft);

  const groups: RailGroup<Surface>[] = [
    { heading: 'Workspace', items: [{ id: 'courses', label: 'Courses', count: index.length }] },
    { heading: `Course · ${currentDraft.title}`, items: [
      { id: 'pool', label: 'Items', count: counts.items },
      { id: 'journey', label: 'Journey', count: counts.units },
      { id: 'bosses', label: 'Bosses', count: counts.bosses },
    ] },
    { heading: 'Creatures · global', items: [{ id: 'pets', label: 'Pets', count: getActivePetDefs().length }] },
  ];

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveCourse(currentDraft);
      setCourse(currentDraft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  async function commitImport(c: Course) {
    setStatus('saving…');
    try {
      await saveCourse(c);
      setCourse(c, 'live'); // draft resyncs via the effect (id change)
      setStatus('imported ✓');
    } catch (e) {
      setStatus(`import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="admin-root mx-auto mt-6 flex max-w-7xl flex-col gap-4 p-4 text-base text-slate-800">
      <div className="flex flex-wrap items-center gap-4">
        <AdminHeader email={user?.email} onSignOut={() => signOut()} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CourseSwitcher courses={index} activeId={activeCourseId} onSelect={(id) => void switchTo(id)} />
        <span className="flex-1" />
        <SaveBar
          valid={validation.ok}
          dirty={dirty}
          status={status}
          onSave={save}
          saveLabel="Save changes"
          errorCount={validation.errors.length}
        />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <div className="flex gap-6">
        <AdminRail groups={groups} active={surface} onSelect={setSurface} />
        <div className="min-w-0 flex-1">
          {surface === 'courses' && (
            <CoursesTab
              course={currentDraft}
              onChange={setDraft}
              index={index}
              onCreate={(meta) => void create(meta)}
              onDelete={(id) => void remove(id)}
              onSwitch={(id) => void switchTo(id)}
              onImport={commitImport}
            />
          )}
          {surface === 'pool' && <PoolTab course={currentDraft} onChange={setDraft} />}
          {surface === 'journey' && <JourneyTab course={currentDraft} onChange={setDraft} />}
          {surface === 'bosses' && <BossesTab course={currentDraft} onChange={setDraft} />}
          {surface === 'pets' && <PetsTab />}
        </div>
      </div>
    </div>
  );
}
```

Notes for the executor:
- `ImportTab` import is removed (standalone Import tab gone). Leave `src/components/admin/ImportTab.tsx` on disk — P5 deletes it after confirming the `parseWorkbookToCourse` reuse holds.
- `Card`/`Tabs`/`TabItem` are no longer imported here; do NOT remove them from the `ui` barrel (still used by other surfaces — `Card` by `PoolTab`/`ItemEditor`, etc.). Confirm with `cd /d/ai_projects/AI_design_thinking/sentence-pet && grep -rl "from './ui'" src/components/admin | xargs grep -l "Card\|Tabs" ` before assuming anything is dead.

- [ ] **Step 2: Update `AdminShell.test.tsx` (adjust, do not clobber)**

The old tests assert horizontal `role="tab"` named Pool/Journey/Import and the `commit` import flow. Update them to the rail + Courses-default world. Apply these edits to the existing file (keep the mocks block at the top, including `excelImport`):

1. The `firebase/content` mock must also expose the functions `useCoursesAdmin` calls. Replace the existing `vi.mock('../../firebase/content', …)` with:

```ts
const saveCourse = vi.fn().mockResolvedValue(undefined);
const deleteCourse = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  saveCourse: (c: unknown) => saveCourse(c),
  fetchCourse: vi.fn().mockResolvedValue(null),
  fetchCoursesIndex: vi.fn().mockResolvedValue([{ id: 'default', title: 'Beginner Course', emoji: '📘' }]),
  deleteCourse: (id: string) => deleteCourse(id),
}));
```

2. Replace the three tab-specific tests (`shows Pool and Journey tabs…`, `renders the tabs inside an accessible tablist`, and the `Import tab commit…` test) with rail-based equivalents:

```tsx
it('renders the section rail with the global Pets entry', async () => {
  render(<AdminShell />);
  expect(screen.getByRole('tablist')).toBeInTheDocument();
  expect(await screen.findByRole('tab', { name: /pets/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /courses/i })).toBeInTheDocument();
});

it('defaults to the Courses surface and can switch to Journey via the rail', () => {
  render(<AdminShell />);
  // Courses surface shows the active course meta editor.
  expect(screen.getByLabelText(/course id/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /journey/i }));
  expect(screen.getAllByText(/u1-pattern/i).length).toBeGreaterThan(0);
});
```

3. The `Save calls saveCourse…` and `saveCourse rejection…` tests: the Save button label is now "Save changes". Change `getByRole('button', { name: /^save$/i })` to `getByRole('button', { name: /save changes/i })` in those two tests. The validation-gate test's button query changes the same way.

4. Keep `shows the signed-in admin email` as-is.

- [ ] **Step 3: Run the full admin suite + typecheck + build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin && npx tsc -b && npx vite build`
Expected: all admin tests PASS, tsc clean, build clean. If "Worker exited unexpectedly" appears, re-run vitest.

- [ ] **Step 4: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx && git commit -m "feat(admin): rewrite AdminShell to full-width rail + course switcher + Courses surface"
```

---

## Self-Review (completed against the P2 scope in the handoff)

**Spec coverage:**
1. AdminRail → Task 4. ✓
2. CourseSwitcher → Task 5. ✓
3. Courses data wiring incl. `deleteCourse` (block last course) → Task 1 (deleteCourse) + Task 6 (hook). ✓
4. CoursesTab (list / +New / New-from-file / meta editor read-only id / contents summary / delete-with-confirm / per-surface SaveBar via the shell) → Task 7 + Task 8 (SaveBar in shell). ✓
5. AdminShell rewrite (full-width, no Card wrapper, header+switcher+rail, drop Import tab) → Task 8. ✓

**Type consistency:** `Surface` union, `RailGroup<T>`/`RailItem<T>`, `courseCounts → {units,lessons,items,bosses}`, `useCoursesAdmin → {index,activeCourseId,refresh,switchTo,create,remove}`, `emptyCourse`/`makeCourseId` signatures all match across tasks. `CoursesTab` props match the shell's call site.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only conditional work (Task 7 Step 4) is a real verify-then-adjust on the shared `Button`/`TextInput` primitives with explicit fallback instructions — not a placeholder.

**Known deferrals (not regressions):** per-row full counts for INACTIVE courses in the list (index lacks pool/units) → P4+. Standalone `ImportTab.tsx` file deletion → P5. Switcher full roving-arrow option navigation (current impl: click + Escape, which the mockup's simple dropdown matches) → polish in P5.

## Remaining roadmap after P2
P3 Pets→SearchableList + unify per-surface SaveBar. P4 Bosses + Journey → master-detail (kill checkbox walls); per-row inactive-course counts. P5 `mergeById` + `ImportDrawer` per-surface additive import + delete standalone Import tab + polish.
