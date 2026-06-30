# Import Templates — Design

**Date:** 2026-06-30
**Repo:** `sentence-pet` (`D:/ai_projects/AI_design_thinking/sentence-pet`). Branch `import-templates` off `main` (`f13dfd2`).
**Status:** Approved design, ready for an implementation plan.

## Goal

Let a content author download a correctly-structured `.xlsx` **template** for any import surface (Items, Bosses, Units, Pets) and for a whole new course, so they start from the right sheet + headers + a couple of valid example rows instead of a blank page or a hand-built workbook. Templates must **never drift** from what the importer actually accepts.

## Decisions (locked during brainstorming, via live visual companion)

- **Form = in-app download, shared spec, parity test.** A "Download template" affordance generates the `.xlsx` in the browser from one canonical column spec. The spec feeds the templates; a contract test guards parity with the real parsers. Parsers are **not** refactored to read the spec (smaller blast radius); the parity test is the drift guard.
- **Content = headers + example rows.** Each template ships its header row plus a few **valid** example rows (the guides' worked examples), not a blank grid.
- **Scope = per-surface in each drawer + one whole-course workbook.** Every `Import…` drawer downloads its own single-sheet template; the Courses tab downloads one 4-sheet course workbook (`Course`/`Units`/`Items`/`Bosses`). **Pets is excluded from the course workbook** (separate catalog + apply path); the Pets template is available only from the Pets drawer.

## Architecture

One canonical spec module, two consumers (template builder + the drift test). No second copy of the column list.

### `src/content/importTemplates.ts` (new, pure — no IO, no React)

```ts
export type TemplateSurface = 'Course' | 'Units' | 'Items' | 'Bosses' | 'Pets';

interface TemplateSpec {
  sheet: TemplateSurface;   // exact sheet name the importer expects
  columns: string[];        // header row, in order
  examples: string[][];     // valid example rows (cells as strings, in `columns` order)
}

export const SURFACE_TEMPLATES: Record<TemplateSurface, TemplateSpec>;

/** Sheets composing the whole-course workbook (Pets intentionally excluded). */
export const COURSE_WORKBOOK_SURFACES: TemplateSurface[]; // ['Course','Units','Items','Bosses']

/** Build a workbook with one sheet per requested surface (header + examples). Pure. */
export function buildWorkbook(surfaces: TemplateSurface[]): XLSX.WorkBook;
```

- `columns` + `examples` per surface come from the parser's column contract (`excelImport.ts` for Course/Units/Items/Bosses, `petImport.ts` for Pets) and the guides' worked examples under `docs/authoring/`.
- The **whole-course example set must be internally coherent**: every Items `unit` matches a Units `id`; the last `node` group in each unit is its checkpoint; Bosses `reviewsUnits`/`afterUnit`/`pinnedItemIds` reference real ids; exactly one `final` boss. (This is what `validateCourse` requires.) Reuse a minimal coherent slice (a `seed.ts`-style mini course is the reference).
- Pets examples: the `Spark`→`Blaze` gen-2 evolution pair from `docs/authoring/pets.md` (no starter; free `(gen,dexNo)`; imports clean merged with builtins).

### `src/content/downloadWorkbook.ts` (new, thin DOM shim)

```ts
/** Serialize a workbook and trigger a browser download. First xlsx WRITE in the app. */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void;
```

- `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` → `Blob` → object URL → programmatic `<a download>` click → **revoke the object URL** after click (no leak).
- No new dependency: `xlsx` is already bundled (used read-only today via `sheet_to_json`).

### UI touch points

- **`src/components/admin/ui/ImportDrawer.tsx`** — add an optional prop to render a download affordance under the file picker, above `ValidationSummary`:
  ```ts
  downloadTemplate?: { filename: string; build: () => XLSX.WorkBook };
  ```
  When present, render a ghost `<button aria-label="Download {noun} template">↳ Download template (with examples)</button>` that calls `downloadWorkbook(downloadTemplate.build(), downloadTemplate.filename)`. (A `<button>`, not an `<a href>`, because the blob is generated on click.) Drawers that don't pass the prop render nothing — fully backward-compatible.
- **`PoolTab` / `BossesTab` / `JourneyTab` / `PetsTab`** — each passes `downloadTemplate` for its surface: `{ filename: '{sheet-lower}-template.xlsx', build: () => buildWorkbook(['Items'|'Bosses'|'Units'|'Pets']) }`.
- **`src/components/admin/CoursesTab.tsx`** — a ghost "⬇ Download course template" button in the header → `downloadWorkbook(buildWorkbook(COURSE_WORKBOOK_SURFACES), 'course-template.xlsx')`.

### Filenames

`{sheet-lowercased}-template.xlsx`: `items-template.xlsx`, `bosses-template.xlsx`, `units-template.xlsx`, `pets-template.xlsx`; whole course → `course-template.xlsx`.

## Data flow (download)

```
click → buildWorkbook([surface])  (pure: header + example rows → sheets)
      → XLSX.write(array)
      → Blob → object URL → <a download> click → file on disk
      → revoke URL
```

Synchronous; no async, no network. `buildWorkbook` is unit-testable without a DOM; `downloadWorkbook` is the only DOM-touching piece.

## Testing

### `src/content/importTemplates.test.ts` (the drift guard)

For **each surface**, assert the template's own example rows import clean through the **real** adapter — same mechanism as the existing `authoring-guides.contract.test.ts`:

- **Pets:** `importPets(buildWorkbook(['Pets']))` → `errors: []`; then `validatePetDefs(mergeById([...BUILTIN_PET_DEFS], entities, d=>d.id).merged)` → `ok: true`.
- **Items:** `importItems(buildWorkbook(['Items']))` → `errors: []`.
- **Bosses:** `importBosses(buildWorkbook(['Bosses']))` → `errors: []` (note: a standalone Bosses sheet has no final-boss requirement at the adapter level; the *whole-course* check below covers final-boss validity).
- **Units:** `importUnits(buildWorkbook(['Units']))` → `errors: []`.
- **Whole course:** `parseWorkbookToCourse(buildWorkbook(COURSE_WORKBOOK_SURFACES))` → `course` non-null, `errors: []`; `validateCourse(course)` → `ok: true`.
- **Shape:** `buildWorkbook(['Pets'])` produces exactly one sheet named `Pets` whose first row equals `SURFACE_TEMPLATES.Pets.columns`.

**Why it catches drift:** if a parser renames/removes a **required** column, the template still emits the old header, the adapter reports a missing-required error, and the round-trip assertion fails — signalling the template (and likely the matching guide) went stale. Optional-column renames won't fail the round-trip (lower stakes; documented limitation).

### Other tests

- **`ImportDrawer` test (append):** when `downloadTemplate` is passed, the button renders and clicking it invokes the builder. Mock `downloadWorkbook` (or the DOM anchor) to avoid real file IO.
- **`downloadWorkbook` test:** one happy-path test with a mocked `document.createElement('a')` asserting `click()` is called and the object URL is revoked. (Trivial; acceptable to keep minimal.)
- **No existing test may be clobbered** — `ImportDrawer.test.tsx`, the tab tests, and `CoursesTab.test.tsx` already exist; APPEND.

## Edge cases & non-goals

- **Pets not in the course workbook** — separate apply path; only the Pets drawer offers the Pets template.
- **Bundle size** — no new dep; `XLSX.write` ships in the already-bundled lib.
- **Object URL leak** — revoked after click.
- **YAGNI:** no blank-template variant (content decision = examples), no template versioning, no settings, no server-side generation, no parser refactor to read the spec.

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/content/importTemplates.ts` | Create | Canonical specs + `buildWorkbook`. Pure. |
| `src/content/importTemplates.test.ts` | Create | Per-surface + whole-course parity round-trips + shape. |
| `src/content/downloadWorkbook.ts` | Create | Browser download shim (`XLSX.write` → blob → anchor). |
| `src/content/downloadWorkbook.test.ts` | Create | Minimal DOM-shim happy path. |
| `src/components/admin/ui/ImportDrawer.tsx` | Modify | Optional `downloadTemplate` prop → button. |
| `src/components/admin/ui/ImportDrawer.test.tsx` | Modify (append) | Button renders + invokes builder. |
| `src/components/admin/PoolTab.tsx` / `BossesTab.tsx` / `JourneyTab.tsx` / `PetsTab.tsx` | Modify | Pass `downloadTemplate` for the surface. |
| `src/components/admin/CoursesTab.tsx` | Modify | "Download course template" button. |

## Acceptance

- Each `Import…` drawer (Pool/Bosses/Journey/Pets) shows a working "Download template (with examples)" button that downloads a single-sheet `.xlsx` which re-imports through that same surface with zero validation errors.
- The Courses tab downloads a 4-sheet `course-template.xlsx` that imports via `parseWorkbookToCourse` + `validateCourse` with zero errors.
- `importTemplates.test.ts` proves every template round-trips clean (drift guard). Full unit suite + `tsc -b` + `vite build` green. No existing test clobbered.
