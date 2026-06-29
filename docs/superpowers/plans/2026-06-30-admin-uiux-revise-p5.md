# Admin UI/UX Revise — Phase 5 (per-surface ImportDrawer + polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone whole-course Import tab with a per-surface, additive merge drawer (Items / Bosses / Journey), and fold in the P4 polish carry-forwards. After this phase the whole `admin-uiux-revise` epic line promotes to `main` as one release.

**Architecture:** A pure `mergeById` diff util drives a generic `ImportDrawer` kit component. The drawer ingests an xlsx file, parses it through a per-surface adapter, diffs the parsed entities against the surface's current entities by `id` (New / Updated / Unchanged), and applies **additively** (adds new + replaces matches; never deletes existing). The xlsx parser is refactored once into a tolerant `parseWorkbookSlices` that reads whatever sheets are present; `parseWorkbookToCourse` (whole-course, still used by CoursesTab "New from file…") becomes a thin wrapper over it, so partial workbooks (e.g. just an `Items` sheet) and full 4-sheet workbooks both work in any surface's drawer.

**Tech Stack:** React 18 + TypeScript (strict), Vitest + @testing-library/react, Tailwind (admin tokens scoped to `.admin-root`), SheetJS (`xlsx`).

**Merge granularity (locked semantic — document in code):** the merge unit is the surface's primary entity — a pool item for Items, a boss node for Bosses, a unit for Journey. "Additive" = never delete an existing entity of that type; new ids are appended, matching ids are **replaced wholesale** by the incoming entity (so re-importing a unit replaces that unit's lessons — expected, since lessons derive from the `Items` sheet's `node` grouping). Order: existing entities keep their order; brand-new entities append at the end.

---

## File Structure

- **Create** `src/content/mergeById.ts` — pure generic diff/merge (`mergeById`, `MergeResult`, `MergeChange`, `MergeStatus`) + `stableStringify` deep-equal helper.
- **Create** `src/content/mergeById.test.ts`.
- **Modify** `src/content/excelImport.ts` — extract the parse body into a tolerant `parseWorkbookSlices(wb)`; keep `parseWorkbookToCourse` as a wrapper that enforces required sheets + assembles a `Course`.
- **Modify** `src/content/excelImport.test.ts` — append tests for `parseWorkbookSlices` tolerance (DO NOT touch existing test bodies).
- **Create** `src/content/surfaceImport.ts` — per-surface adapters `importItems`, `importBosses`, `importUnits` (workbook → entity array + errors).
- **Create** `src/content/surfaceImport.test.ts`.
- **Create** `src/components/admin/ui/ImportDrawer.tsx` — generic overlay drawer.
- **Create** `src/components/admin/ui/ImportDrawer.test.tsx`.
- **Modify** `src/components/admin/ui/index.ts` — export `ImportDrawer` + types.
- **Modify** `src/components/admin/PoolTab.tsx` — top toolbar `Import…` button + drawer wiring.
- **Modify** `src/components/admin/PoolTab.test.tsx` — append import-wiring test.
- **Modify** `src/components/admin/BossesTab.tsx` — toolbar + drawer wiring.
- **Modify** `src/components/admin/BossesTab.test.tsx` — append.
- **Modify** `src/components/admin/JourneyTab.tsx` — toolbar + drawer wiring; route assigned-count through `AssignList.headerNote`.
- **Modify** `src/components/admin/JourneyTab.test.tsx` — append (drawer wiring + direct add/delete unit & lesson coverage).
- **Delete** `src/components/admin/ImportTab.tsx` and `src/components/admin/ImportTab.test.tsx`.
- **Modify** `src/components/admin/CoursesTab.tsx` — surface "New from file…" parse/read errors (kill the silent swallow at lines 43-46).
- **Modify** `src/components/admin/CoursesTab.test.tsx` — append error-surfacing test.
- **Modify** `src/components/admin/AdminShell.tsx` — hide the shell `ValidationSummary` on the Pets surface (P3 carry-forward).
- **Modify** `src/components/admin/AdminShell.test.tsx` — append.

---

## Hazards (read before starting)

- **Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet`** at the start of every command (the PowerShell tool's cwd resolves wrong on this machine and resets after each call). Use the Bash tool.
- Gates per task: `npx vitest run <file>` (the file you touched), then before the final commit of a task `npx tsc -b` (**NOT** `--noEmit`) and `npx vite build`. Windows vitest "Worker exited unexpectedly" is flaky → re-run once.
- **Stage explicit files** (`git add <paths>`); never `git add -A` (concurrent-session contamination).
- **Append to `*.test.tsx/.test.ts`; never clobber an existing test body.** When a task says "append", add new `it(...)` blocks; leave the file's existing tests intact.
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`.
- **No em-dashes in NEW UI copy.** (Existing `"— none —"` selects are house-consistent; leave them.)
- Kit facts: native `onChange` on inputs; `NumberInput` also has `onValueChange:(n|null)`; `Button` variants `primary`/`danger`/`ghost`; `Field` wraps a visible `<label>` (queryable via `getByText`); `SearchableList`/`LessonTree` rows are `<button aria-current>` selected by content; `AssignList` rows are `<button role="checkbox" aria-checked>` named by its REQUIRED `ariaLabel(item)`.

---

## Task 1: `mergeById` pure diff/merge util

**Files:**
- Create: `src/content/mergeById.ts`
- Test: `src/content/mergeById.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/mergeById.test.ts
import { describe, it, expect } from 'vitest';
import { mergeById } from './mergeById';

const id = (x: { id: string }) => x.id;

describe('mergeById', () => {
  it('classifies new / updated / unchanged by id and value', () => {
    const existing = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
    ];
    const incoming = [
      { id: 'b', v: 2 },   // unchanged (deep-equal)
      { id: 'b', v: 99 },  // last write wins is NOT our concern: ids unique in incoming; see next test
    ].slice(0, 1).concat([
      { id: 'c', v: 3 },   // new
      { id: 'a', v: 5 },   // updated
    ]);
    const r = mergeById(existing, incoming, id);
    expect(r.counts).toEqual({ new: 1, updated: 1, unchanged: 1 });
    const byId = Object.fromEntries(r.changes.map((c) => [c.id, c.status]));
    expect(byId).toEqual({ b: 'unchanged', c: 'new', a: 'updated' });
  });

  it('merges additively: existing kept in order, updates replace, new appended, nothing deleted', () => {
    const existing = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
    const incoming = [{ id: 'a', v: 9 }, { id: 'c', v: 3 }];
    const r = mergeById(existing, incoming, id);
    expect(r.merged).toEqual([{ id: 'a', v: 9 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }]);
  });

  it('deep-equals nested objects/arrays regardless of key order', () => {
    const existing = [{ id: 'a', meta: { x: 1, y: 2 }, tags: ['p', 'q'] }];
    const incoming = [{ id: 'a', tags: ['p', 'q'], meta: { y: 2, x: 1 } }];
    const r = mergeById(existing, incoming, id);
    expect(r.counts.unchanged).toBe(1);
    expect(r.counts.updated).toBe(0);
  });

  it('detects array-order changes as updates (itemIds order is meaningful)', () => {
    const existing = [{ id: 'a', itemIds: ['x', 'y'] }];
    const incoming = [{ id: 'a', itemIds: ['y', 'x'] }];
    expect(mergeById(existing, incoming, id).counts.updated).toBe(1);
  });

  it('returns existing unchanged and empty changes for empty incoming', () => {
    const existing = [{ id: 'a', v: 1 }];
    const r = mergeById(existing, [], id);
    expect(r.merged).toEqual(existing);
    expect(r.changes).toEqual([]);
    expect(r.counts).toEqual({ new: 0, updated: 0, unchanged: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/mergeById.test.ts`
Expected: FAIL — cannot find module `./mergeById`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/content/mergeById.ts

export type MergeStatus = 'new' | 'updated' | 'unchanged';

export interface MergeChange<T> {
  id: string;
  status: MergeStatus;
  incoming: T;
  existing?: T;
}

export interface MergeResult<T> {
  /** Full resulting collection: existing order preserved, updates replaced in place, new appended. */
  merged: T[];
  /** One entry per incoming entity, in incoming order. */
  changes: MergeChange<T>[];
  counts: { new: number; updated: number; unchanged: number };
}

/** Deterministic JSON with object keys sorted recursively; arrays keep order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

const deepEqual = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/**
 * Additive merge of `incoming` into `existing`, keyed by `getId`. Never deletes:
 * existing entities stay (in order), an incoming id that matches an existing one
 * replaces it (status `updated`, or `unchanged` if deep-equal), and a new id is
 * appended (status `new`). `changes` mirrors `incoming` order; `counts` summarises.
 */
export function mergeById<T>(
  existing: readonly T[],
  incoming: readonly T[],
  getId: (item: T) => string,
): MergeResult<T> {
  const existingById = new Map<string, T>();
  existing.forEach((e) => existingById.set(getId(e), e));

  const changes: MergeChange<T>[] = [];
  const incomingById = new Map<string, T>();
  for (const inc of incoming) {
    const cid = getId(inc);
    incomingById.set(cid, inc);
    const prev = existingById.get(cid);
    const status: MergeStatus = prev === undefined ? 'new' : deepEqual(prev, inc) ? 'unchanged' : 'updated';
    changes.push({ id: cid, status, incoming: inc, existing: prev });
  }

  const merged: T[] = existing.map((e) => incomingById.get(getId(e)) ?? e);
  for (const inc of incoming) {
    if (!existingById.has(getId(inc))) merged.push(inc);
  }

  const counts = {
    new: changes.filter((c) => c.status === 'new').length,
    updated: changes.filter((c) => c.status === 'updated').length,
    unchanged: changes.filter((c) => c.status === 'unchanged').length,
  };
  return { merged, changes, counts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/mergeById.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/content/mergeById.ts src/content/mergeById.test.ts
git commit -m "feat(admin): mergeById additive diff/merge util for per-surface import"
```

---

## Task 2: Refactor excelImport into a tolerant `parseWorkbookSlices`

**Goal:** Extract the parse body so it tolerates missing sheets and returns the raw slices (`pool`, `units`, `gates`, `finalBoss`). `parseWorkbookToCourse` keeps its exact current behaviour (required-sheet errors + assembled `Course`) by wrapping the new function. Existing `excelImport.test.ts` must stay green untouched.

**Files:**
- Modify: `src/content/excelImport.ts`
- Test: `src/content/excelImport.test.ts` (append only)

- [ ] **Step 1: Write the failing test (append to the existing describe block, do not edit existing tests)**

```ts
// append near the bottom of src/content/excelImport.test.ts
import { parseWorkbookSlices } from './excelImport';
import * as XLSX from 'xlsx';

function bookWith(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

describe('parseWorkbookSlices (tolerant)', () => {
  it('parses an Items-only workbook into pool, ignoring absent sheets', () => {
    const wb = bookWith({
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'variant', 'slots', 'answer'],
        ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'ฉันวิ่ง', 'pattern', 'Pronoun,Verb', 'I,run'],
      ],
    });
    const slices = parseWorkbookSlices(wb);
    expect(Object.keys(slices.pool)).toEqual(['d1']);
    expect(slices.units).toEqual([]);
    expect(slices.gates).toEqual([]);
    expect(slices.finalBoss).toBeUndefined();
    expect(slices.errors).toEqual([]);
  });

  it('parses a Bosses-only workbook into gates + finalBoss', () => {
    const wb = bookWith({
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'],
        ['g1', 'gated', 'u1', 'u1', 4, ''],
        ['f', 'final', '', 'u1', 6, ''],
      ],
    });
    const slices = parseWorkbookSlices(wb);
    expect(slices.gates.map((g) => g.id)).toEqual(['g1']);
    expect(slices.finalBoss?.id).toBe('f');
  });

  it('parses a Units-only workbook into units (no lessons)', () => {
    const wb = bookWith({
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]],
    });
    const slices = parseWorkbookSlices(wb);
    expect(slices.units.map((u) => u.id)).toEqual(['u1']);
    expect(slices.units[0].lessons).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/excelImport.test.ts`
Expected: FAIL — `parseWorkbookSlices` is not exported.

- [ ] **Step 3: Refactor `excelImport.ts`**

Replace the single `parseWorkbookToCourse` export with a tolerant slices function + a thin wrapper. Keep ALL the existing row-mapping logic verbatim; only move it. The full file becomes:

```ts
import * as XLSX from 'xlsx';
import type { Course, BossNode } from './course';
import type { Unit, Lesson, CheckpointBoss } from './model';
import type { ContentItem, ContentKind, DragDropItem, PosLabel, Species, PetStage } from '../data/types';

// xlsx@0.18.5 has published prototype-pollution + ReDoS advisories that apply only to
// untrusted input. This parser runs admin-only, post-auth (see ImportDrawer call sites), so
// neither is reachable here. Revisit if the import surface ever accepts pre-auth files.

type Row = Record<string, unknown>;

const REQUIRED_SHEETS = ['Course', 'Units', 'Items', 'Bosses'] as const;

function sheetRows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  return ws ? (XLSX.utils.sheet_to_json(ws, { defval: '' }) as Row[]) : [];
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const num = (v: unknown): number => Number(v);
const bool = (v: unknown): boolean => v === true || str(v).toLowerCase() === 'true';
const csv = (v: unknown): string[] =>
  str(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Raw course slices parsed from whatever sheets a workbook contains. Tolerant:
 *  a missing sheet yields an empty slice, not an error. Pure: no IO, no validation. */
export interface WorkbookSlices {
  pool: Record<string, ContentItem>;
  units: Unit[];
  gates: BossNode[];
  finalBoss?: BossNode;
  errors: string[];
}

/** Parse every sheet present in `wb` into its slice. Sheets that are absent are skipped. */
export function parseWorkbookSlices(wb: XLSX.WorkBook): WorkbookSlices {
  const errors: string[] = [];

  // ── Units ────────────────────────────────────────────────────────────────
  const units: Unit[] = [];
  sheetRows(wb, 'Units').forEach((r, i) => {
    const id = str(r.id);
    if (!id) {
      errors.push(`Units row ${i + 2}: id is required`);
      return;
    }
    units.push({
      id,
      title: str(r.title),
      emoji: str(r.emoji),
      order: num(r.order) || i + 1,
      l1Enabled: bool(r.l1Enabled),
      lessons: [],
    });
  });

  // ── Items → pool + node grouping ─────────────────────────────────────────
  // Each row's `node` column groups items into a Lesson within a unit.
  const pool: Record<string, ContentItem> = {};
  const nodeItems = new Map<string, { unit: string; kind: ContentKind; level: number; ids: string[] }>();

  sheetRows(wb, 'Items').forEach((r, i) => {
    const id = str(r.id);
    const kind = str(r.kind) as ContentKind;
    if (!id) {
      errors.push(`Items row ${i + 2}: id is required`);
      return;
    }
    const level = num(r.level) || 1;
    const l1th = str(r.l1_th);
    const l1 = l1th ? { l1: { th: l1th } } : {};

    let item: ContentItem | null = null;

    switch (kind) {
      case 'dragdrop': {
        const drillVal = str(r.variant) || 'pattern';
        const ddItem: DragDropItem = {
          id,
          kind: 'dragdrop',
          level,
          thaiHint: str(r.thaiHint),
          drill: drillVal as DragDropItem['drill'],
          slots: csv(r.slots) as PosLabel[],
          answer: csv(r.answer),
        };
        const distractors = csv(r.distractors);
        if (distractors.length) ddItem.distractors = distractors;
        if (bool(r.hidePos)) ddItem.hidePos = true;
        item = ddItem;
        break;
      }
      case 'flashcard':
        item = {
          id,
          kind: 'flashcard',
          level,
          ...l1,
          front: str(r.front),
          back: str(r.back),
          ...(str(r.audio) ? { audio: str(r.audio) } : {}),
        };
        break;
      case 'fillblank': {
        const alternates = csv(r.alternates);
        item = {
          id,
          kind: 'fillblank',
          level,
          ...l1,
          template: str(r.template),
          answer: str(r.answer),
          ...(alternates.length ? { alternates } : {}),
        };
        break;
      }
      case 'matching': {
        const pairs = Object.keys(r)
          .filter((k) => /^pair\d+$/.test(k))
          .map((k) => str(r[k]))
          .filter(Boolean)
          .map((cell) => {
            const [left, right, th] = cell.split('|');
            return {
              left: str(left),
              right: str(right),
              ...(str(th) ? { l1: { th: str(th) } } : {}),
            };
          });
        item = { id, kind: 'matching', level, ...l1, pairs };
        break;
      }
      default:
        errors.push(`Items row ${i + 2}: unknown kind "${str(r.kind)}"`);
        return;
    }

    if (pool[id]) { errors.push(`Items row ${i + 2}: duplicate id "${id}"`); return; }
    pool[id] = item;
    const nodeId = str(r.node) || `${str(r.unit)}-${kind}`;
    const grp = nodeItems.get(nodeId) ?? { unit: str(r.unit), kind, level, ids: [] };
    if (nodeItems.has(nodeId) && grp.unit !== str(r.unit)) {
      errors.push(`Items row ${i + 2}: node "${nodeId}" spans units "${grp.unit}" and "${str(r.unit)}"`);
      return;
    }
    grp.ids.push(id);
    nodeItems.set(nodeId, grp);
  });

  // ── Attach lessons to units ───────────────────────────────────────────────
  // One Lesson per node group; last node per unit becomes the checkpoint.
  for (const [nodeId, grp] of nodeItems) {
    const unit = units.find((u) => u.id === grp.unit);
    if (!unit) {
      errors.push(`Items node ${nodeId}: unknown unit "${grp.unit}"`);
      continue;
    }
    const lesson: Lesson = {
      id: nodeId,
      kind: grp.kind,
      drill: 'pattern',
      level: grp.level,
      itemIds: grp.ids,
    };
    unit.lessons.push(lesson);
  }
  for (const unit of units) {
    if (unit.lessons.length) unit.lessons[unit.lessons.length - 1].isCheckpoint = true;
  }

  // ── Bosses → gates + finalBoss ────────────────────────────────────────────
  const gates: BossNode[] = [];
  let finalBoss: BossNode | undefined;

  const bossCfg = (): CheckpointBoss => ({
    tierId: 'tier-1',
    element: 'leaf' as Species,
    name: 'Boss',
    rivalSprite: { species: 'leaf' as Species, stage: 'adult' as Exclude<PetStage, 'egg'> },
  });

  sheetRows(wb, 'Bosses').forEach((r, i) => {
    const id = str(r.id);
    const scope = str(r.scope);
    if (!id) {
      errors.push(`Bosses row ${i + 2}: id is required`);
      return;
    }
    const reviewsUnits = csv(r.reviewsUnits);
    const pinnedItemIds = csv(r.pinnedItemIds);
    const reviewCountVal = num(r.reviewCount);

    const common = {
      id,
      title: id,
      ...(reviewsUnits.length ? { reviewsUnitIds: reviewsUnits } : {}),
      ...(reviewCountVal ? { reviewCount: reviewCountVal } : {}),
      ...(pinnedItemIds.length ? { pinnedItemIds } : {}),
      ...(str(r.rewardPetDefId) ? { rewardPetDefId: str(r.rewardPetDefId) } : {}),
      boss: bossCfg(),
    };

    if (scope === 'final') {
      finalBoss = { ...common, scope: 'final', onClear: 'completeCourse' };
    } else if (scope === 'gated') {
      const afterUnitId = str(r.afterUnit);
      if (!afterUnitId) errors.push(`Bosses row ${i + 2}: gated boss requires afterUnit`);
      gates.push({ ...common, scope: 'gated', afterUnitId });
    } else {
      errors.push(`Bosses row ${i + 2}: unknown scope "${scope}"`);
    }
  });

  return { pool, units, gates, finalBoss, errors };
}

/** Parse a SheetJS workbook into a Course. Pure: no IO, no validation side effects.
 *  Returns { course: null } when a required sheet is missing or the Course row is fatal. */
export function parseWorkbookToCourse(wb: XLSX.WorkBook): { course: Course | null; errors: string[] } {
  const errors: string[] = [];

  for (const s of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(s)) errors.push(`missing required sheet "${s}"`);
  }
  if (errors.length) return { course: null, errors };

  const courseRow = sheetRows(wb, 'Course')[0];
  if (!courseRow || !str(courseRow.id)) {
    errors.push('Course row 2: id is required');
    return { course: null, errors };
  }

  const slices = parseWorkbookSlices(wb);

  const course: Course = {
    id: str(courseRow.id),
    title: str(courseRow.title),
    ...(str(courseRow.emoji) ? { emoji: str(courseRow.emoji) } : {}),
    ...(courseRow.l1Ready !== '' ? { l1Ready: bool(courseRow.l1Ready) } : {}),
    pool: slices.pool,
    units: slices.units,
    gates: slices.gates,
    ...(slices.finalBoss ? { finalBoss: slices.finalBoss } : {}),
  };

  return { course, errors: [...errors, ...slices.errors] };
}
```

> Note: `parseWorkbookToCourse` now appends `slices.errors`. The original returned only the parse errors it accumulated, which were the SAME errors now produced inside `parseWorkbookSlices`. Behaviour is preserved. The `str`/`num`/`bool`/`csv` helpers are unchanged.

- [ ] **Step 4: Run tests to verify all pass (old + new)**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/excelImport.test.ts`
Expected: PASS — the pre-existing `parseWorkbookToCourse` tests AND the 3 new `parseWorkbookSlices` tests.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/content/excelImport.ts src/content/excelImport.test.ts
git commit -m "refactor(content): extract tolerant parseWorkbookSlices from parseWorkbookToCourse"
```

---

## Task 3: Per-surface import adapters

**Goal:** Turn a workbook into the entity array each surface's drawer diffs, plus a non-fatal error list. Items → pool values; Bosses → `[...gates, finalBoss?]`; Journey → units. Each guards "no rows found for this surface" as a friendly error so an empty/wrong-sheet file does not silently show "0 changes".

**Files:**
- Create: `src/content/surfaceImport.ts`
- Test: `src/content/surfaceImport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/surfaceImport.test.ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { importItems, importBosses, importUnits } from './surfaceImport';

function bookWith(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

describe('surfaceImport', () => {
  it('importItems returns pool items from an Items sheet', () => {
    const wb = bookWith({
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'front', 'back'],
        ['f1', 'flashcard', 1, 'u1', 'u1-n1', 'hello', 'สวัสดี'],
      ],
    });
    const { entities, errors } = importItems(wb);
    expect(entities.map((i) => i.id)).toEqual(['f1']);
    expect(errors).toEqual([]);
  });

  it('importItems errors when there are no item rows', () => {
    const { entities, errors } = importItems(bookWith({ Units: [['id'], ['u1']] }));
    expect(entities).toEqual([]);
    expect(errors[0]).toMatch(/no item rows/i);
  });

  it('importBosses flattens gates + finalBoss', () => {
    const wb = bookWith({
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewCount'],
        ['g1', 'gated', 'u1', 4],
        ['f', 'final', '', 6],
      ],
    });
    const { entities } = importBosses(wb);
    expect(entities.map((n) => n.id)).toEqual(['g1', 'f']);
    expect(entities.find((n) => n.id === 'f')?.scope).toBe('final');
  });

  it('importUnits returns units', () => {
    const wb = bookWith({ Units: [['id', 'title', 'order'], ['u1', 'Unit One', 1]] });
    const { entities, errors } = importUnits(wb);
    expect(entities.map((u) => u.id)).toEqual(['u1']);
    expect(errors).toEqual([]);
  });

  it('importBosses errors on an empty bosses sheet', () => {
    const { entities, errors } = importBosses(bookWith({ Items: [['id'], ['x']] }));
    expect(entities).toEqual([]);
    expect(errors[0]).toMatch(/no boss rows/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/surfaceImport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/content/surfaceImport.ts
import type * as XLSX from 'xlsx';
import type { ContentItem } from '../data/types';
import type { Unit } from './model';
import type { BossNode } from './course';
import { parseWorkbookSlices } from './excelImport';

export interface SurfaceImport<T> {
  entities: T[];
  errors: string[];
}

/** Pool items from an Items sheet (other sheets ignored). */
export function importItems(wb: XLSX.WorkBook): SurfaceImport<ContentItem> {
  const slices = parseWorkbookSlices(wb);
  const entities = Object.values(slices.pool);
  const errors = [...slices.errors];
  if (entities.length === 0 && !errors.length) errors.push('No item rows found — the file needs an "Items" sheet.');
  return { entities, errors };
}

/** Boss nodes (gates then finalBoss) from a Bosses sheet. */
export function importBosses(wb: XLSX.WorkBook): SurfaceImport<BossNode> {
  const slices = parseWorkbookSlices(wb);
  const entities = [...slices.gates, ...(slices.finalBoss ? [slices.finalBoss] : [])];
  const errors = [...slices.errors];
  if (entities.length === 0 && !errors.length) errors.push('No boss rows found — the file needs a "Bosses" sheet.');
  return { entities, errors };
}

/** Units (with lessons derived from any Items sheet) from a Units sheet. */
export function importUnits(wb: XLSX.WorkBook): SurfaceImport<Unit> {
  const slices = parseWorkbookSlices(wb);
  const entities = slices.units;
  const errors = [...slices.errors];
  if (entities.length === 0 && !errors.length) errors.push('No unit rows found — the file needs a "Units" sheet.');
  return { entities, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/surfaceImport.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/content/surfaceImport.ts src/content/surfaceImport.test.ts
git commit -m "feat(content): per-surface import adapters (items/bosses/units)"
```

---

## Task 4: `ImportDrawer` generic kit component

**Goal:** A reusable overlay drawer that takes the surface's current entities + a `parseFile` adapter (injectable, so tests never touch xlsx), previews an additive merge, and applies it. Generic over entity `T`.

**Files:**
- Create: `src/components/admin/ui/ImportDrawer.tsx`
- Test: `src/components/admin/ui/ImportDrawer.test.tsx`
- Modify: `src/components/admin/ui/index.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/ImportDrawer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDrawer } from './ImportDrawer';

type Row = { id: string; v: number };
const existing: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];

function setup(parseFile: (f: File) => Promise<{ entities: Row[]; errors: string[] }>, onApply = vi.fn()) {
  const onClose = vi.fn();
  render(
    <ImportDrawer<Row>
      open
      title="Import rows"
      noun="row"
      existing={existing}
      getId={(r) => r.id}
      parseFile={parseFile}
      onApply={onApply}
      onClose={onClose}
      renderChange={(c) => <span>{c.id} v{c.incoming.v}</span>}
    />,
  );
  return { onApply, onClose };
}

function pickFile() {
  fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
}

describe('ImportDrawer', () => {
  it('previews an additive merge and applies the merged result', async () => {
    const parseFile = async () => ({ entities: [{ id: 'b', v: 9 }, { id: 'c', v: 3 }], errors: [] });
    const { onApply, onClose } = setup(parseFile);
    pickFile();
    await screen.findByText(/1 new/i);
    expect(screen.getByText(/1 updated/i)).toBeInTheDocument();
    expect(screen.getByText(/0 unchanged/i)).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: /apply 2 changes/i });
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 9 }, { id: 'c', v: 3 }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks apply and shows parse errors', async () => {
    const parseFile = async () => ({ entities: [], errors: ['No item rows found.'] });
    const { onApply } = setup(parseFile);
    pickFile();
    await screen.findByText(/no item rows found/i);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('disables apply when there are zero changes', async () => {
    const parseFile = async () => ({ entities: [{ id: 'a', v: 1 }], errors: [] }); // deep-equal to existing
    setup(parseFile);
    pickFile();
    await screen.findByText(/1 unchanged/i);
    expect(screen.getByRole('button', { name: /apply 0 changes/i })).toBeDisabled();
  });

  it('Cancel closes without applying', () => {
    const { onApply, onClose } = setup(async () => ({ entities: [], errors: [] }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ImportDrawer<Row>
        open={false}
        title="Import rows"
        noun="row"
        existing={existing}
        getId={(r) => r.id}
        parseFile={async () => ({ entities: [], errors: [] })}
        onApply={vi.fn()}
        onClose={vi.fn()}
        renderChange={() => null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/ImportDrawer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/ImportDrawer.tsx
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { mergeById } from '../../../content/mergeById';
import type { MergeChange, MergeResult } from '../../../content/mergeById';
import { Button } from './Button';
import { ValidationSummary } from './ValidationSummary';

const STATUS_LABEL: Record<MergeChange<unknown>['status'], string> = {
  new: 'new',
  updated: 'upd',
  unchanged: 'same',
};

/**
 * Per-surface additive import drawer. Reads a file via the injected `parseFile`
 * (production wires an xlsx reader + surface adapter; tests inject a fake), diffs
 * the parsed entities against `existing` by id, previews New/Updated/Unchanged,
 * and on apply hands the fully merged collection to `onApply`. Additive: nothing
 * in `existing` is ever dropped.
 */
export function ImportDrawer<T>({
  open,
  title,
  noun,
  existing,
  getId,
  parseFile,
  onApply,
  onClose,
  renderChange,
}: {
  open: boolean;
  title: string;
  noun: string;                                  // singular, e.g. "item"
  existing: readonly T[];
  getId: (item: T) => string;
  parseFile: (file: File) => Promise<{ entities: T[]; errors: string[] }>;
  onApply: (merged: T[]) => void;
  onClose: () => void;
  renderChange: (change: MergeChange<T>) => ReactNode;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<MergeResult<T> | null>(null);
  const inputId = useId();
  const titleId = useId();

  // Reset all transient state each time the drawer opens.
  useEffect(() => {
    if (open) { setFileName(null); setErrors([]); setResult(null); }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onFile(file: File) {
    setFileName(file.name);
    try {
      const { entities, errors: parseErrors } = await parseFile(file);
      setErrors(parseErrors);
      setResult(parseErrors.length ? null : mergeById(existing, entities, getId));
    } catch (err) {
      setErrors([`Could not read file: ${err instanceof Error ? err.message : String(err)}`]);
      setResult(null);
    }
  }

  const changeCount = result ? result.counts.new + result.counts.updated : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span aria-hidden>⬇</span>
          <h3 id={titleId} className="text-base font-semibold text-slate-800">{title}</h3>
          <span className="flex-1" />
          <button type="button" aria-label="Close import" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
          <label htmlFor={inputId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 hover:border-indigo-400">
            <span aria-hidden style={{ fontSize: 22 }}>📄</span>
            <span className="flex flex-col">
              <span className="font-medium text-slate-700">{fileName ?? 'Choose a file (.xlsx)'}</span>
              <span className="text-xs text-slate-400">Additive merge — adds new and updates matches by id. Nothing is deleted.</span>
            </span>
            <input
              id={inputId}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </label>

          <ValidationSummary errors={errors} />

          {result && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat n={result.counts.new} label="new" tone="text-emerald-600" />
                <Stat n={result.counts.updated} label="updated" tone="text-indigo-600" />
                <Stat n={result.counts.unchanged} label="unchanged" tone="text-slate-400" />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Changes ({changeCount})
                </p>
                <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {result.changes
                    .filter((c) => c.status !== 'unchanged')
                    .map((c) => (
                      <li key={getId(c.incoming)} className="flex items-center gap-2 px-3 py-2">
                        <span className={`shrink-0 rounded px-1.5 text-[11px] font-semibold ${
                          c.status === 'new' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{renderChange(c)}</span>
                      </li>
                    ))}
                  {changeCount === 0 && (
                    <li className="px-3 py-3 text-center text-slate-400">Nothing to apply — every {noun} matches.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <span className="flex-1" />
          {result && (
            <Button
              variant="primary"
              disabled={changeCount === 0}
              onClick={() => { onApply(result.merged); onClose(); }}
            >
              Apply {changeCount} change{changeCount === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{n}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
```

> The merge-count line renders text like "1 new", "1 updated", "0 unchanged" via the `Stat` blocks (number + label adjacent). The tests match `/1 new/i` etc. against the combined accessible text of each stat block — `2` + `new` render as siblings inside one block, so `getByText(/1 new/i)` needs them in one element. **Adjust `Stat` so the number and label are in the SAME element** if the regex fails: render `<p>{n} {label}</p>`. Implement `Stat` as:
>
> ```tsx
> function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
>   return (
>     <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
>       <p className={`text-lg font-bold tabular-nums ${tone}`}><span>{n}</span> <span className="text-xs font-medium text-slate-500">{label}</span></p>
>     </div>
>   );
> }
> ```
>
> Use this single-element form so `screen.getByText(/1 new/i)` resolves. (RTL `getByText` matches normalized text content of one element.)

- [ ] **Step 4: Add the barrel export**

In `src/components/admin/ui/index.ts`, after the `AssignList` export line, add:

```ts
export { ImportDrawer } from './ImportDrawer';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/ImportDrawer.test.tsx`
Expected: PASS (5 tests). If a `/N new/i` matcher fails, apply the single-element `Stat` form above and re-run.

- [ ] **Step 6: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/components/admin/ui/ImportDrawer.tsx src/components/admin/ui/ImportDrawer.test.tsx src/components/admin/ui/index.ts
git commit -m "feat(admin): generic additive ImportDrawer kit component"
```

---

## Task 5: Wire ImportDrawer into PoolTab (Items)

**Goal:** A top toolbar `Import…` button on the Items surface opens the drawer; applying merges into `course.pool`.

**Files:**
- Modify: `src/components/admin/PoolTab.tsx`
- Test: `src/components/admin/PoolTab.test.tsx` (append)

- [ ] **Step 1: Write the failing test (append)**

```tsx
// append to src/components/admin/PoolTab.test.tsx — reuse the file's existing imports/helpers.
// If the file lacks a course factory, add this minimal one near the top of the new block:
import { fireEvent, screen, render } from '@testing-library/react';
import { vi } from 'vitest';
import type { Course } from '../../content/course';
import { PoolTab } from './PoolTab';

function courseWith(pool: Course['pool']): Course {
  return { id: 'c1', title: 'C1', pool, units: [], gates: [] };
}

describe('PoolTab import wiring', () => {
  it('opens the drawer and merges imported items additively', async () => {
    const onChange = vi.fn();
    const course = courseWith({
      'item-1': { id: 'item-1', kind: 'flashcard', level: 1, front: 'a', back: 'b' },
    });
    const parseItemsFile = async () => ({
      entities: [{ id: 'item-2', kind: 'flashcard', level: 1, front: 'c', back: 'd' } as Course['pool'][string]],
      errors: [],
    });
    render(<PoolTab course={course} onChange={onChange} parseItemsFile={parseItemsFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 1 change/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Course;
    expect(Object.keys(next.pool).sort()).toEqual(['item-1', 'item-2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PoolTab.test.tsx`
Expected: FAIL — `PoolTab` has no `parseItemsFile` prop / no Import button.

- [ ] **Step 3: Implement**

Edit `src/components/admin/PoolTab.tsx`:

1. Update imports — add `useState` is already imported; add the drawer + adapter:

```tsx
import * as XLSX from 'xlsx';
import { Button, SearchableList, FilterChips, ImportDrawer } from './ui';
import { importItems } from '../../content/surfaceImport';
import { itemLabel, itemSearchText } from './poolTab/itemLabel';
```

2. Add a default file parser (module scope, above the component):

```tsx
async function defaultParseItemsFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importItems(wb);
}
```

3. Extend the signature + add drawer state:

```tsx
export function PoolTab({ course, onChange, parseItemsFile = defaultParseItemsFile }: {
  course: Course;
  onChange: (c: Course) => void;
  parseItemsFile?: (file: File) => Promise<{ entities: ContentItem[]; errors: string[] }>;
}) {
  const all = Object.values(course.pool);
  const [selected, setSelected] = useState<string | null>(all[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [importing, setImporting] = useState(false);
  // ...existing freshId/addItem/updateItem/removeItem unchanged...

  function applyImport(merged: ContentItem[]) {
    onChange({ ...course, pool: Object.fromEntries(merged.map((it) => [it.id, it])) });
  }
```

4. Wrap the returned JSX in a column with a toolbar, and render the drawer. Replace the outer `return ( <div className="flex gap-4"> ... </div> )` with:

```tsx
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
      </div>
      <div className="flex gap-4">
        {/* ...existing SearchableList + detail panel unchanged... */}
      </div>

      <ImportDrawer<ContentItem>
        open={importing}
        title="Import items"
        noun="item"
        existing={all}
        getId={(it) => it.id}
        parseFile={parseItemsFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{itemLabel(c.incoming)} <span className="text-slate-400">· {c.incoming.id} · {c.incoming.kind}</span></>}
      />
    </div>
  );
```

(Keep the existing `SearchableList` and detail `<div className="flex-1">…</div>` exactly as they are inside the inner `flex gap-4` wrapper.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PoolTab.test.tsx`
Expected: PASS (existing tests + the new import-wiring test).

- [ ] **Step 5: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/components/admin/PoolTab.tsx src/components/admin/PoolTab.test.tsx
git commit -m "feat(admin): per-surface Import drawer on Items (PoolTab)"
```

---

## Task 6: Wire ImportDrawer into BossesTab

**Goal:** Toolbar `Import…` opens the drawer; applying splits the merged boss list back into `gates` + `finalBoss`.

**Files:**
- Modify: `src/components/admin/BossesTab.tsx`
- Test: `src/components/admin/BossesTab.test.tsx` (append)

- [ ] **Step 1: Write the failing test (append)**

```tsx
// append to src/components/admin/BossesTab.test.tsx
describe('BossesTab import wiring', () => {
  it('merges imported bosses and splits gates vs finalBoss', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {}, units: [{ id: 'u1', title: 'U1', emoji: '', order: 1, lessons: [] }],
      gates: [], finalBoss: undefined,
    } as unknown as import('../../content/course').Course;
    const parseBossesFile = async () => ({
      entities: [
        { id: 'g1', title: 'g1', scope: 'gated', afterUnitId: 'u1', boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } },
        { id: 'f', title: 'f', scope: 'final', onClear: 'completeCourse', boss: { tierId: 't', element: 'leaf', name: 'F', rivalSprite: { species: 'leaf', stage: 'adult' } } },
      ] as unknown as import('../../content/course').BossNode[],
      errors: [],
    });
    render(<BossesTab course={course} onChange={onChange} parseBossesFile={parseBossesFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 2 changes/i }));
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(next.gates.map((g) => g.id)).toEqual(['g1']);
    expect(next.finalBoss?.id).toBe('f');
  });
});
```

> If `BossesTab.test.tsx` lacks the `render/screen/fireEvent/vi` imports at file top, add them in the new block via `import { render, screen, fireEvent } from '@testing-library/react'; import { vi } from 'vitest';` — but check first; most admin test files already import these.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: FAIL — no `parseBossesFile` prop / no Import button.

- [ ] **Step 3: Implement**

Edit `src/components/admin/BossesTab.tsx`:

1. Imports:

```tsx
import * as XLSX from 'xlsx';
import { /* existing kit */ ImportDrawer } from './ui';
import { importBosses } from '../../content/surfaceImport';
```

2. Module-scope default parser:

```tsx
async function defaultParseBossesFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importBosses(wb);
}
```

3. Extend the component signature + drawer state + apply:

```tsx
export function BossesTab({ course, onChange, parseBossesFile = defaultParseBossesFile }: {
  course: Course;
  onChange: (c: Course) => void;
  parseBossesFile?: (file: File) => Promise<{ entities: BossNode[]; errors: string[] }>;
}) {
  // ...existing state...
  const [importing, setImporting] = useState(false);

  function applyImport(merged: BossNode[]) {
    const gates = merged.filter((n) => n.scope !== 'final');
    const finalBoss = merged.find((n) => n.scope === 'final');
    onChange({ ...course, gates, ...(finalBoss ? { finalBoss } : {}) });
  }
```

4. Wrap the return in a column with a toolbar + drawer. Change the outer `return ( <div className="flex gap-4 text-sm"> ... </div> )` to:

```tsx
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
      </div>
      <div className="flex gap-4">
        {/* ...existing SearchableList + detail panel unchanged... */}
      </div>

      <ImportDrawer<BossNode>
        open={importing}
        title="Import bosses"
        noun="boss"
        existing={list}
        getId={(n) => n.id}
        parseFile={parseBossesFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{c.incoming.boss.name} <span className="text-slate-400">· {c.incoming.id} · {c.incoming.scope}</span></>}
      />
    </div>
  );
```

(`list` is the existing `[...course.gates, ...finalBoss?]`. Keep the inner content exactly as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/components/admin/BossesTab.tsx src/components/admin/BossesTab.test.tsx
git commit -m "feat(admin): per-surface Import drawer on Bosses"
```

---

## Task 7: Wire ImportDrawer into JourneyTab + route assigned-count through `AssignList.headerNote`

**Goal:** (a) Toolbar `Import…` opens the drawer; applying merges `course.units`. (b) Fold the P4 carry-forward: replace the sibling `<p>…assigned…</p>` above the lesson `AssignList` with `AssignList`'s `headerNote` prop, killing the dead-API note.

**Files:**
- Modify: `src/components/admin/JourneyTab.tsx`
- Test: `src/components/admin/JourneyTab.test.tsx` (append)

- [ ] **Step 1: Write the failing test (append)**

```tsx
// append to src/components/admin/JourneyTab.test.tsx
describe('JourneyTab import wiring', () => {
  it('merges imported units additively', async () => {
    const onChange = vi.fn();
    const course = {
      id: 'c1', title: 'C1', pool: {},
      units: [{ id: 'u1', title: 'U1', emoji: '', order: 1, lessons: [] }],
      gates: [],
    } as unknown as import('../../content/course').Course;
    const parseUnitsFile = async () => ({
      entities: [{ id: 'u2', title: 'U2', emoji: '', order: 2, lessons: [] }] as import('../../content/model').Unit[],
      errors: [],
    });
    render(<JourneyTab course={course} onChange={onChange} parseUnitsFile={parseUnitsFile} />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/choose a file/i), { target: { files: [new File([''], 'x.xlsx')] } });
    fireEvent.click(await screen.findByRole('button', { name: /apply 1 change/i }));
    const next = onChange.mock.calls[0][0] as import('../../content/course').Course;
    expect(next.units.map((u) => u.id)).toEqual(['u1', 'u2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/JourneyTab.test.tsx`
Expected: FAIL — no `parseUnitsFile` prop / no Import button.

- [ ] **Step 3: Implement**

Edit `src/components/admin/JourneyTab.tsx`:

1. Imports:

```tsx
import * as XLSX from 'xlsx';
import { Card, Field, TextInput, NumberInput, Select, Checkbox, Button, AssignList, ImportDrawer } from './ui';
import { importUnits } from '../../content/surfaceImport';
```

2. Module-scope default parser:

```tsx
async function defaultParseUnitsFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importUnits(wb);
}
```

3. Signature + drawer state + apply:

```tsx
export function JourneyTab({ course, onChange, parseUnitsFile = defaultParseUnitsFile }: {
  course: Course;
  onChange: (c: Course) => void;
  parseUnitsFile?: (file: File) => Promise<{ entities: Unit[]; errors: string[] }>;
}) {
  // ...existing state...
  const [importing, setImporting] = useState(false);
  function applyImport(merged: Unit[]) { onChange({ ...course, units: merged }); }
```

4. Wrap the return in a column with a toolbar + drawer. Change `return ( <div className="flex gap-4 text-sm"> ... </div> )` to:

```tsx
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
      </div>
      <div className="flex gap-4">
        {/* ...existing LessonTree + detail panel unchanged... */}
      </div>

      <ImportDrawer<Unit>
        open={importing}
        title="Import units"
        noun="unit"
        existing={course.units}
        getId={(u) => u.id}
        parseFile={parseUnitsFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{c.incoming.title} <span className="text-slate-400">· {c.incoming.id} · {c.incoming.lessons.length} lessons</span></>}
      />
    </div>
  );
```

5. **headerNote fold-in:** in the lesson editor, replace the assigned-count paragraph + bare `AssignList` with `AssignList` carrying `headerNote`. Find:

```tsx
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Items in lesson · {l.itemIds.length} assigned · {kind} only
                </p>
                <AssignList
                  items={eligible}
                  getKey={(it) => it.id}
                  ariaLabel={(it) => `item ${it.id}`}
                  isSelected={(it) => l.itemIds.includes(it.id)}
                  onToggle={(it) => toggleItem(u.id, l, it.id)}
                  searchText={(it) => `${it.id} ${isDragDrop(it) ? it.drill : it.kind}`}
                  renderLabel={(it) => `${it.id} (${isDragDrop(it) ? it.drill : it.kind}·${it.level})`}
                  placeholder={`Search ${kind} items…`}
                  emptyHint="No matching items in the pool."
                />
              </div>
```

Replace with:

```tsx
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items in lesson · {kind} only</p>
                <AssignList
                  items={eligible}
                  getKey={(it) => it.id}
                  ariaLabel={(it) => `item ${it.id}`}
                  isSelected={(it) => l.itemIds.includes(it.id)}
                  onToggle={(it) => toggleItem(u.id, l, it.id)}
                  searchText={(it) => `${it.id} ${isDragDrop(it) ? it.drill : it.kind}`}
                  renderLabel={(it) => `${it.id} (${isDragDrop(it) ? it.drill : it.kind}·${it.level})`}
                  placeholder={`Search ${kind} items…`}
                  emptyHint="No matching items in the pool."
                  headerNote={`${l.itemIds.length} assigned`}
                />
              </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/JourneyTab.test.tsx`
Expected: PASS. If an existing test asserted the old `"3 assigned · dragdrop only"` exact string, update that assertion to match the split copy (the count now lives in `headerNote`; query `screen.getByText(/3 assigned/)` instead). Adjust assertions only — never delete a test.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add src/components/admin/JourneyTab.tsx src/components/admin/JourneyTab.test.tsx
git commit -m "feat(admin): Import drawer on Journey + route assigned-count via AssignList.headerNote"
```

---

## Task 8: Direct add/delete Unit & Lesson coverage (P4 carry-forward)

**Goal:** P4 added add/delete Unit + Lesson handlers but only `LessonTree` fired the callbacks; no `JourneyTab` test asserts `course.units` actually gains/loses a unit or lesson. Add direct coverage.

**Files:**
- Test: `src/components/admin/JourneyTab.test.tsx` (append)

- [ ] **Step 1: Write the tests (append)**

```tsx
// append to src/components/admin/JourneyTab.test.tsx
describe('JourneyTab unit/lesson mutations', () => {
  const base = () => ({
    id: 'c1', title: 'C1', pool: {},
    units: [{ id: 'u1', title: 'U1', emoji: '📘', order: 1, lessons: [
      { id: 'u1-l1', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: [] },
    ] }],
    gates: [],
  } as unknown as import('../../content/course').Course);

  it('adds a unit to course.units', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ unit/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units.length).toBe(2);
  });

  it('deletes the selected unit', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    // select the unit header, then delete with confirm
    fireEvent.click(screen.getByRole('button', { name: /U1/ }));
    fireEvent.click(screen.getByRole('button', { name: /delete unit/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units.length).toBe(0);
  });

  it('adds a lesson to the selected unit', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add lesson/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units[0].lessons.length).toBe(2);
  });

  it('deletes the selected lesson', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={base()} onChange={onChange} />);
    // the first lesson is selected by default; open its delete confirm
    fireEvent.click(screen.getByRole('button', { name: /delete lesson/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    const next = onChange.mock.calls.at(-1)![0] as import('../../content/course').Course;
    expect(next.units[0].lessons.length).toBe(0);
  });
});
```

> The exact button accessible names come from `JourneyTab`/`LessonTree`: the add buttons render `+ Unit` and `+ Add lesson` (see `LessonTree` footer), delete buttons render `Delete unit` / `Delete lesson` then `Confirm delete`. If a name differs, read the component and match the real label — do not change the component to fit the test.

- [ ] **Step 2: Run + verify**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/JourneyTab.test.tsx`
Expected: PASS. If a selector misses, inspect the rendered output (`screen.debug()`) and fix the selector.

- [ ] **Step 3: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/JourneyTab.test.tsx
git commit -m "test(admin): direct add/delete unit + lesson coverage for JourneyTab"
```

---

## Task 9: Delete the standalone ImportTab + surface CoursesTab import errors + hide ValidationSummary on Pets

**Goal:** Remove the dead whole-file Import tab, stop CoursesTab silently swallowing import errors, and hide the shell `ValidationSummary` on the Pets surface (it has no course SaveBar to act on).

**Files:**
- Delete: `src/components/admin/ImportTab.tsx`, `src/components/admin/ImportTab.test.tsx`
- Modify: `src/components/admin/CoursesTab.tsx`, `src/components/admin/CoursesTab.test.tsx` (append)
- Modify: `src/components/admin/AdminShell.tsx`, `src/components/admin/AdminShell.test.tsx` (append)

- [ ] **Step 1: Confirm ImportTab is unreferenced, then delete it**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
grep -rn "ImportTab" src --include=*.tsx --include=*.ts | grep -v "ImportTab.test.tsx" | grep -v "components/admin/ImportTab.tsx"
```

Expected: NO output (only the file and its test reference it). If anything prints, stop and resolve that reference first. Then:

```bash
git rm src/components/admin/ImportTab.tsx src/components/admin/ImportTab.test.tsx
```

- [ ] **Step 2: CoursesTab — surface import errors (write the failing test first, append)**

```tsx
// append to src/components/admin/CoursesTab.test.tsx
describe('CoursesTab import errors', () => {
  it('shows an error when the whole-course file fails to read', async () => {
    const course = { id: 'c1', title: 'C1', emoji: '', pool: {}, units: [], gates: [] } as unknown as import('../../content/course').Course;
    render(
      <CoursesTab
        course={course}
        onChange={() => {}}
        index={[{ id: 'c1', title: 'C1' }]}
        onCreate={() => {}}
        onDelete={() => {}}
        onSwitch={() => {}}
        onImport={() => {}}
        readWorkbook={async () => { throw new Error('not an xlsx'); }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/new from file/i), { target: { files: [new File([''], 'bad.xlsx')] } });
    await screen.findByText(/could not read file/i);
  });
});
```

> Check the existing `CoursesTab.test.tsx` for its `render/screen/fireEvent` imports and reuse them; the file input is the `New from file…` label (`getByLabelText(/new from file/i)` — the label text is `⬇ New from file...`; match a substring).

- [ ] **Step 3: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx`
Expected: FAIL — no error text rendered.

- [ ] **Step 4: Implement CoursesTab error surfacing**

In `src/components/admin/CoursesTab.tsx`:

1. Add `ValidationSummary` to the kit import and an error state:

```tsx
import { SearchableList, Field, TextInput, Button, SectionLabel, ValidationSummary } from './ui';
```

```tsx
  const [importError, setImportError] = useState<string[]>([]);
```

2. Replace the silent-swallow `onFile`:

```tsx
  async function onFile(file: File) {
    setImportError([]);
    try {
      const wb = await readWorkbook(file);
      const { course: parsed, errors } = parseWorkbookToCourse(wb);
      if (parsed) onImport(parsed);
      else setImportError(errors.length ? errors : ['Could not parse the workbook.']);
    } catch (err) {
      setImportError([`Could not read file: ${err instanceof Error ? err.message : String(err)}`]);
    }
  }
```

3. Render the errors near the file picker (inside the footer, under the `New from file…` label):

```tsx
            <label className="cursor-pointer text-sm text-indigo-600 hover:underline">
              ⬇ New from file...
              <input type="file" accept=".xlsx" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            </label>
            <ValidationSummary errors={importError} />
```

- [ ] **Step 5: Run CoursesTab tests**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx`
Expected: PASS.

- [ ] **Step 6: AdminShell — hide ValidationSummary on Pets (write the failing test first, append)**

```tsx
// append to src/components/admin/AdminShell.test.tsx — follow the file's existing render/store setup.
// The intent: when surface==='pets', the shell's course ValidationSummary is not rendered.
// Pattern: render the shell with an INVALID active course, switch to the Pets surface
// (click the "Pets" rail tab), assert the course error text is gone.
// Reuse the file's existing helpers to mount the shell with a seeded invalid course.
```

> Implementation note for the worker: `AdminShell.test.tsx` already has a harness that mounts the shell with a content store. Add one test: seed/keep an invalid course so `validation.errors` is non-empty (the existing tests show how the store is primed), confirm an error is visible on the Courses surface, click the `Pets` rail button (`screen.getByRole('tab', { name: /pets/i })` or `getByRole('button', { name: /pets/i })` — match what `AdminRail` renders), then assert `screen.queryByText(<that error>)` is `null`. If priming an invalid course is awkward in this harness, instead assert the structural guard directly: that `ValidationSummary` content is absent once Pets is active. Keep it to one focused test.

- [ ] **Step 7: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: FAIL.

- [ ] **Step 8: Implement the guard in `AdminShell.tsx`**

Change the `ValidationSummary` line (currently line ~99):

```tsx
      <ValidationSummary errors={validation.ok ? [] : validation.errors} />
```

to:

```tsx
      {surface !== 'pets' && <ValidationSummary errors={validation.ok ? [] : validation.errors} />}
```

- [ ] **Step 9: Run AdminShell tests**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: PASS.

- [ ] **Step 10: Typecheck + commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b
git add -- src/components/admin/CoursesTab.tsx src/components/admin/CoursesTab.test.tsx src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx
git commit -m "feat(admin): delete standalone ImportTab; surface CoursesTab import errors; hide ValidationSummary on Pets"
```

> Note: the `git rm` from Step 1 is committed here too (staged by `git rm`). If `git status` shows the deletions still pending, add them explicitly: `git add -- src/components/admin/ImportTab.tsx src/components/admin/ImportTab.test.tsx`.

---

## Task 10: Whole-phase verification + em-dash sweep

**Goal:** Full green, clean build, no em-dashes in NEW copy, then ready to promote.

- [ ] **Step 1: Em-dash sweep of new/changed UI copy**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
grep -rn "—" src/components/admin/ui/ImportDrawer.tsx src/content/surfaceImport.ts src/components/admin/PoolTab.tsx src/components/admin/BossesTab.tsx src/components/admin/JourneyTab.tsx
```

Expected: NO em-dashes in NEW copy strings. The drawer's drop-zone hint uses " — " ("Additive merge — adds new…"); replace with a colon or "that": `Additive merge: adds new and updates matches by id. Nothing is deleted.` Re-run until clean. (Pre-existing `"— none —"` selects elsewhere are exempt.)

- [ ] **Step 2: Full test suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: ALL pass (1135 from P4 + the new tests; ~1150+). A Windows "Worker exited unexpectedly" is flaky → re-run once.

- [ ] **Step 3: Typecheck + build**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
npx tsc -b && npx vite build
```

Expected: both succeed.

- [ ] **Step 4: Commit any em-dash fixes**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add -- src/components/admin/ui/ImportDrawer.tsx
git commit -m "chore(admin): drop em-dash from ImportDrawer copy"
```

(Skip if nothing changed.)

---

## Deferred to a later phase (record, do not silently drop)

- **Roving arrow-key navigation** in `SearchableList`/`LessonTree` rows and `CourseSwitcher`/`AdminRail` options (keyboard nav polish). Substantial; not blocking. Note in the epic memory.
- **Per-row inactive-course counts** in `CoursesTab` (needs a lazy fetch per inactive course).
- **Field-level diff captions** in the ImportDrawer ("TH hint changed", "+1 distractor") — explicitly dropped for P5 (generic status only, per product decision 2026-06-30). The change rows show id + kind + content preview + new/upd badge.
- `eligibleItemIds` (`JourneyTab.tsx`) remains module API used only by its test — candidate for removal if nothing else consumes it.

---

## After P5: promote the epic to main

Once Task 10 is green:

1. `cd /d/ai_projects/AI_design_thinking/sentence-pet && git checkout main && git pull` (confirm main tip).
2. `git merge --no-ff admin-uiux-revise -m "merge: admin UI/UX revise epic (P1-P5)"` (one release, like the prior admin-uiux line `db614d1`).
3. Re-verify on main: `npx vitest run && npx tsc -b && npx vite build`.
4. Push `main`; delete the `admin-uiux-revise` branch.
5. Update memory [[admin-uiux-revise-epic]] to DONE+MERGED with the merge sha.

---

## Self-Review (completed by plan author)

- **Spec coverage:** ImportDrawer + mergeById + delete ImportTab (Tasks 1,3,4,5,6,7,9) ✓; AssignList.headerNote fold-in (Task 7) ✓; add/delete unit+lesson tests (Task 8) ✓; CoursesTab error surfacing (Task 9) ✓; ValidationSummary-on-Pets (Task 9) ✓; em-dash sweep (Task 10) ✓; all-three-surfaces ✓; generic-status-only ✓; tolerant single parser ("better idea") (Task 2) ✓. Deferred items recorded.
- **Type consistency:** `mergeById`/`MergeResult`/`MergeChange` used identically across Tasks 1,4. `parseWorkbookSlices`/`WorkbookSlices` (Task 2) consumed by `surfaceImport` (Task 3). `SurfaceImport<T>` shape `{entities, errors}` matches the drawer's `parseFile` return + each tab's `parse*File` prop (Tasks 4-7). Apply signatures: Items `Object.fromEntries`, Bosses split gates/finalBoss, Journey `units` — all return `Course`.
- **Placeholders:** none — every code step has full code. AdminShell test (Task 9 Step 6) is described not coded because its harness is file-local; flagged for the worker to match the existing setup.
