# Import Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add downloadable, always-valid `.xlsx` import templates — one per surface (Items/Bosses/Units/Pets) from each `Import…` drawer, plus a whole-course workbook from the Courses tab — generated in-browser from a single canonical column spec.

**Architecture:** A new pure module `src/content/importTemplates.ts` holds the canonical per-surface column lists + valid example rows and a `buildWorkbook(surfaces[])` that turns them into a SheetJS workbook. A thin `src/content/downloadWorkbook.ts` serializes a workbook and triggers a browser download (the app's first xlsx *write*). `ImportDrawer` gains an optional `downloadTemplate` prop rendering a "Download template" button; the four surface tabs pass their template, and `CoursesTab` gets a whole-course download button. A round-trip parity test imports every generated template back through the real adapter (and `validateCourse`/`validatePetDefs`) so a template can never silently drift from the importer.

**Tech Stack:** TypeScript, React 19, vitest, @testing-library/react, xlsx (SheetJS — already a dep, used read-only today). Build gate: `npx tsc -b`. Test: `npx vitest run <file>`.

**Spec:** `docs/superpowers/specs/2026-06-30-import-templates-design.md`.

**Locked decisions:** in-app download from a shared spec (parsers NOT refactored — a parity test guards drift); templates carry headers + valid example rows; per-surface download in each drawer + one whole-course workbook (Pets excluded from the course workbook).

**Hazards (carry into every task):**
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet &&` on EVERY command (the PowerShell tool's cwd resolves wrong + resets each call).
- In Bash, `@'...'@` is NOT a heredoc — use `git commit -F- <<'EOF' ... EOF`.
- `npx tsc -b`, never `--noEmit`. Stage explicit files only, never `git add -A`.
- **Append** to existing `*.test.*` files; never overwrite. These already exist: `ImportDrawer.test.tsx`, `PoolTab.test.tsx`, `BossesTab.test.tsx`, `JourneyTab.test.tsx`, `PetsTab.test.tsx`, `CoursesTab.test.tsx`.
- Admin tokens stay scoped to `.admin-root`; don't touch global theme.
- Work on a NEW branch `import-templates` off `main` (already created; the spec is committed there).

---

## Ground truth (verified 2026-06-30)

- **Column contracts:** `src/content/excelImport.ts` (Course/Units/Items/Bosses), `src/content/petImport.ts` (Pets).
- **Adapters:** `src/content/surfaceImport.ts` (`importItems`/`importBosses`/`importUnits`), `src/content/petImport.ts` (`importPets`), `src/content/excelImport.ts` (`parseWorkbookToCourse`).
- **Validators:** `src/content/validate.ts` (`validateCourse`, `validatePetDefs`); `src/domain/petDef.ts` (`BUILTIN_PET_DEFS`); `src/content/mergeById.ts` (`mergeById`).
- **Drawer:** `src/components/admin/ui/ImportDrawer.tsx` (props `open,title,noun,existing,getId,parseFile,onApply,onClose,renderChange`); the file-picker `<label>` text is "Choose a file (.xlsx)".
- **Tabs:** `PoolTab.tsx` (`importItems`), `BossesTab.tsx` (`importBosses`), `JourneyTab.tsx` (`importUnits`), `PetsTab.tsx` (`importPets`) each render `<ImportDrawer<T> … />`. `CoursesTab.tsx` has a footer with a "New from file…" `<label>` — add the course-template button beside it.
- **Standalone-adapter tolerance:** `parseWorkbookSlices` is tolerant when a sheet is absent (e.g. an Items-only workbook with `unit` references and no `Units` sheet does NOT error; pinned/review item-id resolution is a `validateCourse` concern, not an adapter concern). So a single-surface template round-trips through its adapter with zero errors even though it references ids that live only in other sheets.

---

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/content/importTemplates.ts` | Create | Canonical `SURFACE_TEMPLATES`, `COURSE_WORKBOOK_SURFACES`, `buildWorkbook`. Pure. |
| `src/content/importTemplates.test.ts` | Create | Header-parity shape + per-surface round-trips + whole-course `validateCourse`. |
| `src/content/downloadWorkbook.ts` | Create | `XLSX.write` → Blob → anchor download. |
| `src/content/downloadWorkbook.test.ts` | Create | Minimal DOM-shim happy path. |
| `src/components/admin/ui/ImportDrawer.tsx` | Modify | Optional `downloadTemplate` prop → button. |
| `src/components/admin/ui/ImportDrawer.test.tsx` | Modify (append) | Button renders + invokes the builder. |
| `src/components/admin/PoolTab.tsx` / `BossesTab.tsx` / `JourneyTab.tsx` / `PetsTab.tsx` | Modify | Pass `downloadTemplate`. |
| `src/components/admin/CoursesTab.tsx` | Modify | "Download course template" button. |
| `src/components/admin/CoursesTab.test.tsx` | Modify (append) | Button triggers a whole-course download. |

---

## Task 1: Canonical template spec + `buildWorkbook`

**Files:**
- Create: `src/content/importTemplates.ts`
- Test: `src/content/importTemplates.test.ts`

The example rows are **shared** between the standalone single-surface template and the whole-course workbook, so they are crafted to be internally coherent (Items reference the Units ids; the last `node` group per unit is its checkpoint; Bosses reference real unit/item ids; exactly one `final` boss). That makes both the per-surface round-trips AND `validateCourse` pass with one example set.

- [ ] **Step 1: Write the failing tests** — create `src/content/importTemplates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SURFACE_TEMPLATES, COURSE_WORKBOOK_SURFACES, buildWorkbook } from './importTemplates';
import { importItems, importBosses, importUnits } from './surfaceImport';
import { importPets } from './petImport';
import { parseWorkbookToCourse } from './excelImport';
import { validateCourse, validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import { mergeById } from './mergeById';

describe('buildWorkbook', () => {
  it('emits one sheet per requested surface, header row = the spec columns', () => {
    const wb = buildWorkbook(['Pets']);
    expect(wb.SheetNames).toEqual(['Pets']);
    const aoa = (await import('xlsx')).utils.sheet_to_json(wb.Sheets['Pets'], { header: 1 }) as string[][];
    expect(aoa[0]).toEqual(SURFACE_TEMPLATES.Pets.columns);
  });

  it('Items template round-trips through importItems with no errors', () => {
    expect(importItems(buildWorkbook(['Items'])).errors).toEqual([]);
  });
  it('Bosses template round-trips through importBosses with no errors', () => {
    expect(importBosses(buildWorkbook(['Bosses'])).errors).toEqual([]);
  });
  it('Units template round-trips through importUnits with no errors', () => {
    expect(importUnits(buildWorkbook(['Units'])).errors).toEqual([]);
  });
  it('Pets template imports + merges into a validatePetDefs-clean catalog', () => {
    const { entities, errors } = importPets(buildWorkbook(['Pets']));
    expect(errors).toEqual([]);
    const merged = mergeById([...BUILTIN_PET_DEFS], entities, (d) => d.id).merged;
    expect(validatePetDefs(merged)).toEqual({ ok: true, errors: [] });
  });

  it('whole-course workbook parses + passes validateCourse', () => {
    expect(COURSE_WORKBOOK_SURFACES).toEqual(['Course', 'Units', 'Items', 'Bosses']);
    const { course, errors } = parseWorkbookToCourse(buildWorkbook(COURSE_WORKBOOK_SURFACES));
    expect(errors).toEqual([]);
    expect(course).not.toBeNull();
    expect(validateCourse(course!)).toEqual({ ok: true, errors: [] });
  });
});
```

> The first test uses a dynamic `import('xlsx')`; if your vitest setup disallows top-level await in the test body, hoist `import * as XLSX from 'xlsx';` to the file top and use `XLSX.utils.sheet_to_json` directly. Prefer the hoisted import.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/importTemplates.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement** — create `src/content/importTemplates.ts`:

```ts
import * as XLSX from 'xlsx';

export type TemplateSurface = 'Course' | 'Units' | 'Items' | 'Bosses' | 'Pets';

interface TemplateSpec {
  sheet: TemplateSurface; // exact sheet name the importer expects
  columns: string[];      // header row, in order
  examples: string[][];   // valid example rows, cells in `columns` order
}

// Items header is the UNION of all per-kind columns; each row fills only its kind's cells.
const ITEM_COLUMNS = [
  'id', 'kind', 'unit', 'node', 'level', 'variant', 'thaiHint', 'slots', 'answer',
  'distractors', 'front', 'back', 'template', 'alternates', 'l1_th', 'pair1', 'pair2',
];

// One coherent mini course shared by the standalone Items/Units/Bosses templates AND the
// whole-course workbook. Units u1-basics / u2-next-steps; each unit's LAST node = checkpoint.
export const SURFACE_TEMPLATES: Record<TemplateSurface, TemplateSpec> = {
  Course: {
    sheet: 'Course',
    columns: ['id', 'title', 'emoji', 'l1Ready'],
    examples: [['template-course', 'Template Course', '📘', 'false']],
  },
  Units: {
    sheet: 'Units',
    columns: ['id', 'title', 'emoji', 'order', 'l1Enabled'],
    examples: [
      ['u1-basics', 'Basics', '🐣', '1', 'true'],
      ['u2-next-steps', 'Next Steps', '🌱', '2', 'false'],
    ],
  },
  Items: {
    sheet: 'Items',
    columns: ITEM_COLUMNS,
    // Order matters: per unit, the checkpoint node must be the LAST node group to appear.
    examples: [
      // u1-basics: u1-pattern, u1-words, u1-checkpoint(last)
      ['it1', 'dragdrop', 'u1-basics', 'u1-pattern', '1', 'pattern', 'ฉันวิ่ง', 'Pronoun,Verb', 'I,run', '', '', '', '', '', '', '', ''],
      ['it2', 'flashcard', 'u1-basics', 'u1-words', '1', '', '', '', '', '', 'dog', 'หมา', '', '', 'หมา', '', ''],
      ['it3', 'fillblank', 'u1-basics', 'u1-words', '1', '', '', '', 'eat', '', '', '', 'I ___ rice every day', 'eats', 'ฉันกินข้าว', '', ''],
      ['it4', 'dragdrop', 'u1-basics', 'u1-checkpoint', '1', 'mixed', 'ฉันกินข้าว', 'Pronoun,Verb,Object', 'I,eat,rice', 'bread', '', '', '', '', '', '', ''],
      // u2-next-steps: u2-pattern, u2-checkpoint(last)
      ['it5', 'matching', 'u2-next-steps', 'u2-pattern', '1', '', '', '', '', '', '', '', '', '', '', 'dog|หมา|หมา', 'cat|แมว|แมว'],
      ['it6', 'dragdrop', 'u2-next-steps', 'u2-checkpoint', '2', 'pattern', 'เธอเดิน', 'Pronoun,Verb', 'she,walks', '', '', '', '', '', '', '', ''],
    ],
  },
  Bosses: {
    sheet: 'Bosses',
    columns: ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds', 'rewardPetDefId'],
    examples: [
      ['gate-1', 'gated', 'u1-basics', 'u1-basics', '2', 'it1', ''],
      ['final-1', 'final', '', 'u1-basics,u2-next-steps', '3', 'it4', ''],
    ],
  },
  Pets: {
    sheet: 'Pets',
    columns: [
      'id', 'name', 'gen', 'dexNo', 'types', 'element', 'base_min', 'base_max',
      'enabled', 'starter', 'rarity', 'gachaObtainable', 'evolvesFromId', 'evolvesToId', 'evolutionStage', 'spriteDefault',
    ],
    // gen-2 evolution pair (no starter; free (gen,dexNo); imports clean merged with builtins).
    examples: [
      ['def-spark', 'Spark', '2', '1', 'fire', 'fire', '', '', 'true', '', '', '', '', 'def-blaze', '1', ''],
      ['def-blaze', 'Blaze', '2', '2', 'fire', 'fire', '50', '70', 'true', '', '', '', 'def-spark', '', '2', ''],
    ],
  },
};

/** Sheets composing the whole-course workbook (Pets intentionally excluded). */
export const COURSE_WORKBOOK_SURFACES: TemplateSurface[] = ['Course', 'Units', 'Items', 'Bosses'];

/** Build a workbook with one sheet per requested surface (header row + example rows). Pure. */
export function buildWorkbook(surfaces: TemplateSurface[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const surface of surfaces) {
    const spec = SURFACE_TEMPLATES[surface];
    const aoa = [spec.columns, ...spec.examples];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), spec.sheet);
  }
  return wb;
}
```

If hoisting `XLSX` into the test (recommended), the first test becomes:
```ts
import * as XLSX from 'xlsx';
// ...
const aoa = XLSX.utils.sheet_to_json(buildWorkbook(['Pets']).Sheets['Pets'], { header: 1 }) as string[][];
expect(aoa[0]).toEqual(SURFACE_TEMPLATES.Pets.columns);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/importTemplates.test.ts`
Expected: PASS (all). If the whole-course test fails on a `validateCourse` error, the example set is incoherent — re-read the error (it names the broken invariant: checkpoint-not-last, unknown unit/item, missing final boss) and fix the example rows, not the validator.

- [ ] **Step 5: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/content/importTemplates.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/content/importTemplates.ts src/content/importTemplates.test.ts && git commit -F- <<'EOF'
feat(templates): canonical import-template spec + buildWorkbook

One coherent example set per surface (shared by the standalone
single-surface templates and the whole-course workbook). Round-trip
tests import every template back through its real adapter and
validateCourse/validatePetDefs — the drift guard.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 2: `downloadWorkbook` browser shim

**Files:**
- Create: `src/content/downloadWorkbook.ts`
- Test: `src/content/downloadWorkbook.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/content/downloadWorkbook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { downloadWorkbook } from './downloadWorkbook';

describe('downloadWorkbook', () => {
  beforeEach(() => {
    // jsdom lacks these — stub them.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:fake');
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = vi.fn();
  });

  it('serializes the workbook, clicks an anchor, and revokes the url', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id'], ['x']]), 'Items');

    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = click;
      return el;
    });

    downloadWorkbook(wb, 'items-template.xlsx');

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/downloadWorkbook.test.ts`
Expected: FAIL — `downloadWorkbook` not found.

- [ ] **Step 3: Implement** — create `src/content/downloadWorkbook.ts`:

```ts
import * as XLSX from 'xlsx';

/** Serialize a workbook to .xlsx and trigger a browser download. The app's first xlsx WRITE. */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/content/downloadWorkbook.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/content/downloadWorkbook.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/content/downloadWorkbook.ts src/content/downloadWorkbook.test.ts && git commit -F- <<'EOF'
feat(templates): downloadWorkbook browser shim

XLSX.write -> Blob -> anchor click -> revoke URL. First xlsx write
in the app (read-only until now).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 3: `ImportDrawer` download-template button

**Files:**
- Modify: `src/components/admin/ui/ImportDrawer.tsx`
- Test: `src/components/admin/ui/ImportDrawer.test.tsx` (APPEND — file exists)

- [ ] **Step 1: Write the failing test — APPEND to `src/components/admin/ui/ImportDrawer.test.tsx`** (it already imports `describe,it,expect,vi`, `render,screen,fireEvent`, and `ImportDrawer`; the `Row` type, `existing`, and `setup` helper are defined at the top — but `setup` does not pass `downloadTemplate`, so render directly in this test):

```ts
import * as XLSX from 'xlsx';
import { vi } from 'vitest';
vi.mock('../../../content/downloadWorkbook', () => ({ downloadWorkbook: vi.fn() }));
import { downloadWorkbook } from '../../../content/downloadWorkbook';

describe('ImportDrawer download template', () => {
  it('renders the button and downloads the built workbook on click', () => {
    const wb = XLSX.utils.book_new();
    const build = vi.fn(() => wb);
    render(
      <ImportDrawer<Row>
        open title="Import rows" noun="row" existing={existing}
        getId={(r) => r.id}
        parseFile={async () => ({ entities: [], errors: [] })}
        onApply={vi.fn()} onClose={vi.fn()} renderChange={() => null}
        downloadTemplate={{ filename: 'rows-template.xlsx', build }}
      />,
    );
    const btn = screen.getByRole('button', { name: /download .*template/i });
    fireEvent.click(btn);
    expect(build).toHaveBeenCalledTimes(1);
    expect(downloadWorkbook).toHaveBeenCalledWith(wb, 'rows-template.xlsx');
  });
});
```

> Place the `vi.mock(...)` call near the other top-of-file imports (vitest hoists `vi.mock`). If the file already imports `render`/`screen`/`fireEvent`/`ImportDrawer`/`vi`, reuse them — only add `XLSX`, the mock, and the `downloadWorkbook` import.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/ImportDrawer.test.tsx`
Expected: the new test FAILS (no `downloadTemplate` prop / no button); existing ImportDrawer tests still pass.

- [ ] **Step 3: Implement** — in `src/components/admin/ui/ImportDrawer.tsx`:

(a) Add imports at the top:
```ts
import type { WorkBook } from 'xlsx';
import { downloadWorkbook } from '../../../content/downloadWorkbook';
```

(b) Add the optional prop to the destructured props AND the props type:
```ts
  downloadTemplate,
```
and in the type literal:
```ts
  downloadTemplate?: { filename: string; build: () => WorkBook };
```

(c) Render the button inside the scrolling body, immediately AFTER the file-picker `<label>` and BEFORE `<ValidationSummary errors={errors} />`:
```tsx
{downloadTemplate && (
  <button
    type="button"
    aria-label={`Download ${noun} template`}
    onClick={() => downloadWorkbook(downloadTemplate.build(), downloadTemplate.filename)}
    className="self-start text-xs font-medium text-indigo-600 hover:underline"
  >
    ↳ Download template (with examples)
  </button>
)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/ImportDrawer.test.tsx`
Expected: PASS — new test + all pre-existing ImportDrawer tests.

- [ ] **Step 5: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/components/admin/ui/ImportDrawer.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/ui/ImportDrawer.tsx src/components/admin/ui/ImportDrawer.test.tsx && git commit -F- <<'EOF'
feat(templates): optional download-template button in ImportDrawer

Drawers that pass `downloadTemplate` render a button that builds a
workbook and downloads it. Backward-compatible: no prop -> no button.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 4: Wire the four surface tabs

**Files:**
- Modify: `src/components/admin/PoolTab.tsx`, `BossesTab.tsx`, `JourneyTab.tsx`, `PetsTab.tsx`

No new tests here (the prop wiring is a one-liner per tab; Task 3 proves the button behavior, Task 1 proves the workbook validity). This is integration glue.

- [ ] **Step 1: Implement** — in EACH of the four tabs:

(a) Add the import (merge with any existing import from `../../content/importTemplates` — there is none yet):
```ts
import { buildWorkbook } from '../../content/importTemplates';
```

(b) Add the `downloadTemplate` prop to that tab's `<ImportDrawer … />` element. Use the surface + filename per tab:

- `PoolTab.tsx` (Items): `downloadTemplate={{ filename: 'items-template.xlsx', build: () => buildWorkbook(['Items']) }}`
- `BossesTab.tsx` (Bosses): `downloadTemplate={{ filename: 'bosses-template.xlsx', build: () => buildWorkbook(['Bosses']) }}`
- `JourneyTab.tsx` (Units): `downloadTemplate={{ filename: 'units-template.xlsx', build: () => buildWorkbook(['Units']) }}`
- `PetsTab.tsx` (Pets): `downloadTemplate={{ filename: 'pets-template.xlsx', build: () => buildWorkbook(['Pets']) }}`

- [ ] **Step 2: Verify the suites for all four tabs still pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PoolTab.test.tsx src/components/admin/BossesTab.test.tsx src/components/admin/JourneyTab.test.tsx src/components/admin/PetsTab.test.tsx`
Expected: all green (no behavior change, just an added prop).

- [ ] **Step 3: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/components/admin/PoolTab.tsx src/components/admin/BossesTab.tsx src/components/admin/JourneyTab.tsx src/components/admin/PetsTab.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/PoolTab.tsx src/components/admin/BossesTab.tsx src/components/admin/JourneyTab.tsx src/components/admin/PetsTab.tsx && git commit -F- <<'EOF'
feat(templates): per-surface download buttons in Pool/Bosses/Journey/Pets

Each Import… drawer now offers a "Download template (with examples)"
button that emits its single-sheet .xlsx.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 5: Whole-course template button in CoursesTab

**Files:**
- Modify: `src/components/admin/CoursesTab.tsx`
- Test: `src/components/admin/CoursesTab.test.tsx` (APPEND — file exists)

- [ ] **Step 1: Write the failing test — APPEND to `src/components/admin/CoursesTab.test.tsx`** (reuse the file's existing render/setup conventions; the test needs a rendered `CoursesTab`). Mock the download shim and assert the button builds + downloads the 4-sheet workbook:

```ts
import { vi } from 'vitest';
vi.mock('../../content/downloadWorkbook', () => ({ downloadWorkbook: vi.fn() }));
import { downloadWorkbook } from '../../content/downloadWorkbook';

describe('CoursesTab course template', () => {
  it('downloads a 4-sheet course-template.xlsx', () => {
    // Render CoursesTab the same way the existing tests in this file do — reuse their
    // helper/fixtures (a Course + index + the on* callbacks). If they use a local
    // `renderCoursesTab()` helper, call it; otherwise mirror the existing render block.
    renderCoursesTabForTest(); // <- replace with this file's existing render approach

    fireEvent.click(screen.getByRole('button', { name: /download course template/i }));

    expect(downloadWorkbook).toHaveBeenCalledTimes(1);
    const [wb, filename] = (downloadWorkbook as unknown as { mock: { calls: [import('xlsx').WorkBook, string][] } }).mock.calls[0];
    expect(filename).toBe('course-template.xlsx');
    expect(wb.SheetNames).toEqual(['Course', 'Units', 'Items', 'Bosses']);
  });
});
```

> Adapt the render line to this test file's existing pattern (read the top of `CoursesTab.test.tsx` first; it already constructs a `course`, `index`, and the `onChange/onCreate/onDelete/onSwitch/onImport` props). Do not duplicate a second mock of `downloadWorkbook` if you place the test in a file that already mocks it.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx`
Expected: the new test FAILS (no button); existing CoursesTab tests still pass.

- [ ] **Step 3: Implement** — in `src/components/admin/CoursesTab.tsx`:

(a) Add imports:
```ts
import { buildWorkbook, COURSE_WORKBOOK_SURFACES } from '../../content/importTemplates';
import { downloadWorkbook } from '../../content/downloadWorkbook';
```

(b) In the `<SearchableList … footer={…}>` footer, add a button after the "New from file…" `<label>` and before `<ValidationSummary>`:
```tsx
<button
  type="button"
  onClick={() => downloadWorkbook(buildWorkbook(COURSE_WORKBOOK_SURFACES), 'course-template.xlsx')}
  className="self-start text-sm text-indigo-600 hover:underline"
>
  ⬇ Download course template
</button>
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/CoursesTab.test.tsx`
Expected: PASS — new test + all pre-existing CoursesTab tests.

- [ ] **Step 5: Type-check + lint**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx oxlint src/components/admin/CoursesTab.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet && git add src/components/admin/CoursesTab.tsx src/components/admin/CoursesTab.test.tsx && git commit -F- <<'EOF'
feat(templates): whole-course template download in CoursesTab

A 4-sheet course-template.xlsx (Course/Units/Items/Bosses) for the
new-course-from-scratch flow. Pets stay their own surface.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Task 6: Whole-feature verification + review

**Files:** none (gates only).

- [ ] **Step 1: Full unit suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: all green (prior ~1194 + the new importTemplates/downloadWorkbook/drawer/courses tests). Investigate any red; don't proceed on failure.

- [ ] **Step 2: Type-check + build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx vite build`
Expected: clean tsc; successful build (the existing >500 kB chunk-size warning is pre-existing, ignore).

- [ ] **Step 3: Manual smoke (admin)**

Run `npm run dev`, open `#admin`. For each of Pool/Bosses/Journey/Pets → `Import…` → click "Download template (with examples)" → confirm a correctly-named `.xlsx` downloads, then re-import that exact file through the same drawer and confirm the preview shows changes with zero validation errors. On the Courses tab → "Download course template" → import the 4-sheet file via "New from file…" and confirm it creates a valid course. Note explicitly if any step is skipped/deferred.

- [ ] **Step 4: Final code review**

Use `superpowers:requesting-code-review` for a whole-feature review. Focus: the example set's coherence (does the drift test truly cover a renamed required column?), the `downloadWorkbook` DOM shim (URL revoke, no leak), backward-compatibility of the new `ImportDrawer` prop, and that no existing test was clobbered.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch`. When green, promote `import-templates` to `main` with a `--no-ff` merge (matching the prior lines), then push.

---

## Self-Review (done at plan-writing time)

**Spec coverage:** canonical spec + `buildWorkbook` → Task 1; `downloadWorkbook` shim → Task 2; `ImportDrawer` button → Task 3; per-surface wiring → Task 4; whole-course button → Task 5; parity/drift test → Task 1 (round-trips) ; manual smoke + final review + finish → Task 6. Content decision (examples) → the `examples` arrays in Task 1. Scope decision (per-surface + course, Pets excluded) → `buildWorkbook` per-surface (Task 4) + `COURSE_WORKBOOK_SURFACES` (Task 1/5). Filenames → Tasks 4/5.

**Placeholder scan:** every code step carries complete code. The one adaptation point is Task 5 Step 1's render line (`renderCoursesTabForTest()`), explicitly flagged to mirror the existing `CoursesTab.test.tsx` render block — necessary because that file's fixture/harness is local and must be reused, not duplicated.

**Type consistency:** `buildWorkbook(surfaces: TemplateSurface[]): XLSX.WorkBook` used identically in Tasks 1/3/4/5; `downloadTemplate?: { filename: string; build: () => WorkBook }` defined in Task 3 and supplied verbatim in Tasks 4/5; `downloadWorkbook(wb, filename)` signature consistent across Tasks 2/3/5; `COURSE_WORKBOOK_SURFACES` = `['Course','Units','Items','Bosses']` asserted in Task 1 and consumed in Task 5.

**Known risk flagged for review:** the round-trip drift test catches renamed/removed REQUIRED columns (the template emits the stale header → adapter errors). It does NOT catch a renamed OPTIONAL column (the example may not exercise it). Documented in the spec as an accepted v1 limit; the reviewer should confirm the example set exercises each surface's required columns at minimum.
