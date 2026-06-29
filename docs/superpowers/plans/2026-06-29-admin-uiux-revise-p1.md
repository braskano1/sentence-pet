# Admin UI/UX Revise — Phase 1: SearchableList primitive + Items surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `SearchableList` + `FilterChips` kit primitive and migrate the Items (Pool) admin surface onto it, so a content author can find items by sentence content instead of scrolling a wall of opaque `item-N` ids.

**Architecture:** Two new presentational components in the admin UI kit (`src/components/admin/ui/`). `SearchableList<T>` is generic, controlled (caller owns query + selection state), and renders search box → optional filter slot → "N of M" count → scrollable rows → optional footer, with a built-in empty state. `FilterChips<T>` is a small `role="group"` of `aria-pressed` toggle buttons. `PoolTab` is rewritten to compose them, deriving a human label per item via a tested `itemLabel` helper (pool items have no title field). No data-model or store changes; all existing tests stay green.

**Tech Stack:** React + TypeScript, Tailwind, Vitest + @testing-library/react. Admin tokens stay scoped to `.admin-root`.

**Design reference:** `temp/admin-mockup/index.html` (Items view) — approved mockup. 2-line content-first rows, neutral kind/level tags, search + kind chips, count line.

**Whole-epic roadmap (each phase = its own plan, written at that phase's handoff):**
- **P1 (this plan):** `SearchableList` + `FilterChips`; migrate Items/Pool. ← tracer bullet
- **P2:** Full-width `AdminShell` with left tab rail + header course switcher + new **Courses** surface (wires `coursesIndex` / `activeCourseId`). Establishes where whole-course import lives.
- **P3:** Migrate **Pets** onto `SearchableList`; unify per-surface SaveBar dirty model.
- **P4:** Convert **Bosses** and **Journey** to master-detail with the searchable assign-list (kills the checkbox walls).
- **P5:** `mergeById` diff util + `ImportDrawer` (additive merge); add per-surface import; delete the standalone **Import** tab. Polish: empty states, color discipline, a11y, copy (no em-dashes).

**Conventions (carry forward, from handoff):**
- Run from Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool resolves the wrong cwd).
- Verify gate per task: `npx vitest run <file>` then `npx tsc -b` (NOT `--noEmit` — vitest does not typecheck). `npx vite build` before the final commit.
- Windows vitest "Worker exited unexpectedly" flake → re-run.
- Stage explicit files; never `git add -A`. **Append** to `*.test.tsx`; never overwrite existing test bodies.
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never leak into global `@theme`.

---

## File Structure

- **Create** `src/components/admin/ui/FilterChips.tsx` — `role="group"` of `aria-pressed` toggle chips. One responsibility: render a controlled set of mutually-exclusive filter chips.
- **Create** `src/components/admin/ui/FilterChips.test.tsx` — unit tests.
- **Create** `src/components/admin/ui/SearchableList.tsx` — generic controlled list: search + filter slot + count + rows + empty state + footer.
- **Create** `src/components/admin/ui/SearchableList.test.tsx` — unit tests.
- **Create** `src/components/admin/poolTab/itemLabel.ts` — `itemLabel` + `itemSearchText` pure helpers (pool items lack a title; derive one).
- **Create** `src/components/admin/poolTab/itemLabel.test.ts` — unit tests.
- **Modify** `src/components/admin/ui/index.ts` — export the two new components + their types.
- **Modify** `src/components/admin/PoolTab.tsx` — compose `SearchableList` + `FilterChips`; content-first rows.
- **Modify** `src/components/admin/PoolTab.test.tsx` — adjust the one id-based assertion to the new row structure; add search/filter assertions. (Append; do not clobber the two add-item tests.)

---

## Task 1: `FilterChips` component

**Files:**
- Create: `src/components/admin/ui/FilterChips.tsx`
- Test: `src/components/admin/ui/FilterChips.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/FilterChips.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips } from './FilterChips';

const CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'dragdrop', label: 'dragdrop' },
  { id: 'matching', label: 'matching' },
] as const;

describe('FilterChips', () => {
  it('renders one button per chip inside a labelled group', () => {
    render(<FilterChips chips={CHIPS} active="all" onChange={() => {}} label="Filter by kind" />);
    expect(screen.getByRole('group', { name: /filter by kind/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks the active chip with aria-pressed', () => {
    render(<FilterChips chips={CHIPS} active="dragdrop" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'dragdrop' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onChange with the chip id when clicked', () => {
    const onChange = vi.fn();
    render(<FilterChips chips={CHIPS} active="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'matching' }));
    expect(onChange).toHaveBeenCalledWith('matching');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/FilterChips.test.tsx`
Expected: FAIL — `Failed to resolve import './FilterChips'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/FilterChips.tsx
export type FilterChip<T extends string> = { id: T; label: string };

/**
 * A controlled row of mutually-exclusive filter chips. `role="group"` of
 * `aria-pressed` toggle buttons — the active chip is pressed. Presentational;
 * the caller owns the active value and applies the filter.
 */
export function FilterChips<T extends string>({
  chips,
  active,
  onChange,
  label = 'Filter',
}: {
  chips: readonly FilterChip<T>[];
  active: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => {
        const on = c.id === active;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              on
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 text-slate-500 hover:text-slate-800'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/FilterChips.test.tsx && npx tsc -b`
Expected: PASS (3 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ui/FilterChips.tsx src/components/admin/ui/FilterChips.test.tsx
git commit -m "feat(admin): add FilterChips kit primitive"
```

---

## Task 2: `SearchableList` primitive

**Files:**
- Create: `src/components/admin/ui/SearchableList.tsx`
- Test: `src/components/admin/ui/SearchableList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/SearchableList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SearchableList } from './SearchableList';

type Row = { id: string; text: string };
const ROWS: Row[] = [
  { id: 'a', text: 'order food now' },
  { id: 'b', text: 'where is the toilet' },
  { id: 'c', text: 'order the soup' },
];

/** Wrapper so the controlled query/selection have real state in tests. */
function Harness({ items = ROWS }: { items?: Row[] }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  return (
    <SearchableList
      items={items}
      total={items.length}
      getKey={(r) => r.id}
      selectedKey={sel}
      onSelect={setSel}
      searchText={(r) => `${r.text} ${r.id}`}
      query={q}
      onQuery={setQ}
      renderRow={(r) => <span>{r.text}</span>}
    />
  );
}

describe('SearchableList', () => {
  it('renders all rows and a "N of M" count when query is empty', () => {
    render(<Harness />);
    expect(screen.getByText('order food now')).toBeInTheDocument();
    expect(screen.getByText('where is the toilet')).toBeInTheDocument();
    expect(screen.getByText(/3 of 3/i)).toBeInTheDocument();
  });

  it('filters rows by searchText as the user types', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'order' } });
    expect(screen.getByText('order food now')).toBeInTheDocument();
    expect(screen.getByText('order the soup')).toBeInTheDocument();
    expect(screen.queryByText('where is the toilet')).not.toBeInTheDocument();
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it('marks the selected row with aria-current and fires onSelect', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('order the soup'));
    const row = screen.getByText('order the soup').closest('button')!;
    expect(row).toHaveAttribute('aria-current', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/SearchableList.test.tsx`
Expected: FAIL — `Failed to resolve import './SearchableList'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/SearchableList.tsx
import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Generic, controlled master-list for admin surfaces. Renders a search box, an
 * optional filter slot, a "N of M" count, scrollable rows (with a built-in
 * empty state), and an optional footer. The caller owns query + selection state
 * and supplies `searchText` (the haystack each row is matched against) and
 * `renderRow`. Text search is substring, case-insensitive. Filtering by chips is
 * the caller's job — pass already-filtered `items` and the pre-filter `total`.
 *
 * The 2px left border on the selected row is a selection STATE, not a
 * decorative side-stripe.
 */
export function SearchableList<T>({
  items,
  getKey,
  selectedKey,
  onSelect,
  renderRow,
  searchText,
  query,
  onQuery,
  total,
  placeholder = 'Search…',
  filterSlot,
  footer,
  countNoun = 'item',
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  renderRow: (item: T, selected: boolean) => ReactNode;
  searchText: (item: T) => string;
  query: string;
  onQuery: (q: string) => void;
  total?: number;
  placeholder?: string;
  filterSlot?: ReactNode;
  footer?: ReactNode;
  countNoun?: string;
}) {
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => searchText(i).toLowerCase().includes(q)) : items;
  const totalN = total ?? items.length;
  const searchId = useId();

  return (
    <div className="flex w-80 shrink-0 flex-col self-start rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
        <label htmlFor={searchId} className="sr-only">Search</label>
        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-400 focus-within:border-indigo-400">
          <span aria-hidden>🔎</span>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none"
          />
        </div>
        {filterSlot}
      </div>

      <div className="px-3 py-1.5 text-xs text-slate-500">
        {shown.length} of {totalN} {countNoun}{totalN === 1 ? '' : 's'}
      </div>

      <ul className="max-h-[28rem] flex-1 overflow-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            No matches{query ? <> for “{query}”</> : null}.
          </li>
        ) : (
          shown.map((item) => {
            const key = getKey(item);
            const selected = key === selectedKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-current={selected}
                  onClick={() => onSelect(key)}
                  className={`block w-full border-l-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {renderRow(item, selected)}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {footer && <div className="border-t border-slate-200 p-3">{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/SearchableList.test.tsx && npx tsc -b`
Expected: PASS (4 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ui/SearchableList.tsx src/components/admin/ui/SearchableList.test.tsx
git commit -m "feat(admin): add SearchableList kit primitive"
```

---

## Task 3: Export the new primitives from the kit index

**Files:**
- Modify: `src/components/admin/ui/index.ts`

- [ ] **Step 1: Add the exports**

Add these lines to `src/components/admin/ui/index.ts` after the existing `Tabs` exports (lines 12-13):

```ts
export { SearchableList } from './SearchableList';
export { FilterChips } from './FilterChips';
export type { FilterChip } from './FilterChips';
```

- [ ] **Step 2: Verify the barrel typechecks**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: clean (no output, exit 0).

- [ ] **Step 3: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ui/index.ts
git commit -m "feat(admin): export SearchableList and FilterChips from ui kit"
```

---

## Task 4: `itemLabel` + `itemSearchText` helpers

**Files:**
- Create: `src/components/admin/poolTab/itemLabel.ts`
- Test: `src/components/admin/poolTab/itemLabel.test.ts`

Context: pool items (`ContentItem`) have no title field. Each kind carries different content (`flashcard.front`, `matching.pairs`, `dragdrop.answer`/`thaiHint`, `fillblank.template`). These helpers derive a human label and a search haystack. Field names are confirmed against `src/components/admin/ItemEditor.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/admin/poolTab/itemLabel.test.ts
import { describe, it, expect } from 'vitest';
import { itemLabel, itemSearchText } from './itemLabel';
import type {
  FlashcardItem, MatchingItem, DragDropItem, FillBlankItem,
} from '../../../data/types';

const flash: FlashcardItem = { id: 'f1', kind: 'flashcard', level: 1, front: 'hello', back: 'สวัสดี' };
const match: MatchingItem = { id: 'm1', kind: 'matching', level: 2, pairs: [{ left: 'cat', right: 'แมว' }] };
const drag: DragDropItem = { id: 'd1', kind: 'dragdrop', level: 1, drill: 'pattern', thaiHint: 'ฉันสั่ง', slots: ['Verb'], answer: ['I', 'order'] };
const fill: FillBlankItem = { id: 'fb1', kind: 'fillblank', level: 3, template: 'I ___ rice', answer: 'eat' };

describe('itemLabel', () => {
  it('uses front for flashcards', () => expect(itemLabel(flash)).toBe('hello'));
  it('uses the first pair for matching', () => expect(itemLabel(match)).toBe('cat → แมว'));
  it('joins the answer for dragdrop', () => expect(itemLabel(drag)).toBe('I order'));
  it('uses the template for fillblank', () => expect(itemLabel(fill)).toBe('I ___ rice'));
  it('falls back to id when content is empty', () =>
    expect(itemLabel({ id: 'x', kind: 'flashcard', level: 1, front: '', back: '' })).toBe('x'));
});

describe('itemSearchText', () => {
  it('includes label, id, kind and drill/kind meta, lowercased haystack', () => {
    const hay = itemSearchText(drag);
    expect(hay).toContain('i order');
    expect(hay).toContain('d1');
    expect(hay).toContain('dragdrop');
    expect(hay).toContain('pattern');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/poolTab/itemLabel.test.ts`
Expected: FAIL — `Failed to resolve import './itemLabel'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/admin/poolTab/itemLabel.ts
import type { ContentItem } from '../../../data/types';
import { isDragDrop } from '../../../data/types';

/** Best-effort human label for a pool item (items have no title field). */
export function itemLabel(it: ContentItem): string {
  switch (it.kind) {
    case 'flashcard':
      return it.front || it.back || it.id;
    case 'matching':
      return it.pairs[0] ? `${it.pairs[0].left} → ${it.pairs[0].right}` : it.id;
    case 'dragdrop':
      return it.answer.join(' ') || it.thaiHint || it.id;
    case 'fillblank':
      return it.template || it.id;
  }
}

/** Lowercase search haystack: label + id + kind + drill/kind meta. */
export function itemSearchText(it: ContentItem): string {
  const meta = isDragDrop(it) ? it.drill : it.kind;
  return `${itemLabel(it)} ${it.id} ${it.kind} ${meta}`.toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/poolTab/itemLabel.test.ts && npx tsc -b`
Expected: PASS (6 tests); tsc clean.

If any `ContentItem` field name in the test mismatches the real type, fix the **test literal** to match `src/data/types.ts` (do not change the type). Re-run.

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/poolTab/itemLabel.ts src/components/admin/poolTab/itemLabel.test.ts
git commit -m "feat(admin): add itemLabel/itemSearchText pool helpers"
```

---

## Task 5: Migrate `PoolTab` onto `SearchableList` + `FilterChips`

**Files:**
- Modify: `src/components/admin/PoolTab.tsx` (full rewrite of the render + add search/filter state)
- Modify: `src/components/admin/PoolTab.test.tsx` (adjust one assertion; append two)

- [ ] **Step 1: Update the existing tests first (red)**

In `src/components/admin/PoolTab.test.tsx`, the first test asserts the id `'a'` is shown as standalone text. After the redesign the row leads with the derived label (`'I run'`) and the id appears in a combined `id · meta` line. Replace the first test body and append search/filter coverage. Replace lines 18-22 (the `describe` opener through the end of the first `it`) with:

```tsx
describe('PoolTab', () => {
  it('lists pool items by their content label', () => {
    render(<PoolTab course={course()} onChange={() => {}} />);
    // item 'a' is a dragdrop with answer ['I','run'] -> label "I run"
    expect(screen.getByText('I run')).toBeInTheDocument();
    // id is still visible (in the meta line)
    expect(screen.getByText(/\ba\b/)).toBeInTheDocument();
  });

  it('filters the list by search query', () => {
    const c = course();
    c.pool = {
      a: item('a'),
      b: { id: 'b', kind: 'flashcard', level: 1, front: 'hello', back: 'hi' },
    };
    render(<PoolTab course={c} onChange={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hello' } });
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByText('I run')).not.toBeInTheDocument();
  });
```

(The two existing add-item tests — "adding a new item…" and "new-item id does not collide…" — stay unchanged; they query `/new item/i` which the footer button still satisfies.)

- [ ] **Step 2: Run tests to verify the first/new ones fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PoolTab.test.tsx`
Expected: FAIL — `getByText('I run')` / `getByRole('searchbox')` not found (old PoolTab still renders the id list).

- [ ] **Step 3: Rewrite `PoolTab.tsx`**

Replace the entire contents of `src/components/admin/PoolTab.tsx` with:

```tsx
import { useState } from 'react';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { ItemEditor } from './ItemEditor';
import { Button, SearchableList, FilterChips } from './ui';
import type { FilterChip } from './ui';
import { itemLabel, itemSearchText } from './poolTab/itemLabel';

const KIND_CHIPS: readonly FilterChip<'all' | ContentItem['kind']>[] = [
  { id: 'all', label: 'All' },
  { id: 'flashcard', label: 'flashcard' },
  { id: 'matching', label: 'matching' },
  { id: 'dragdrop', label: 'dragdrop' },
  { id: 'fillblank', label: 'fillblank' },
];
type KindFilter = (typeof KIND_CHIPS)[number]['id'];

export function PoolTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const all = Object.values(course.pool);
  const [selected, setSelected] = useState<string | null>(all[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');

  const filtered = kind === 'all' ? all : all.filter((it) => it.kind === kind);

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

  return (
    <div className="flex gap-4">
      <SearchableList
        items={filtered}
        total={all.length}
        getKey={(it) => it.id}
        selectedKey={selected}
        onSelect={setSelected}
        searchText={itemSearchText}
        query={query}
        onQuery={setQuery}
        placeholder="Search items by content or id…"
        filterSlot={<FilterChips chips={KIND_CHIPS} active={kind} onChange={setKind} label="Filter by kind" />}
        footer={<Button onClick={addItem} className="w-full">+ New item</Button>}
        renderRow={(it) => {
          const meta = isDragDrop(it) ? it.drill : it.kind;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-900">{itemLabel(it)}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{it.kind}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">L{it.level}</span>
              </div>
              <span className="font-mono text-xs text-slate-400">{it.id} · {meta}</span>
            </div>
          );
        }}
      />

      <div className="flex-1">
        {selected && course.pool[selected] && (
          <div className="flex flex-col gap-3">
            <ItemEditor item={course.pool[selected]} onChange={updateItem} />
            <Button variant="danger" className="self-start" onClick={() => removeItem(selected)}>Delete item</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PoolTab.test.tsx && npx tsc -b`
Expected: PASS (4 tests: 2 updated/new + 2 unchanged add-item tests); tsc clean.

- [ ] **Step 5: Run the full admin suite + build to confirm nothing regressed**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin && npx vite build`
Expected: all admin tests green; build succeeds. (Re-run vitest once if it hits the Windows "Worker exited unexpectedly" flake.)

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/PoolTab.tsx src/components/admin/PoolTab.test.tsx
git commit -m "feat(admin): migrate Items/Pool surface to SearchableList"
```

---

## Done criteria for Phase 1

- `FilterChips`, `SearchableList`, `itemLabel`/`itemSearchText` exist with passing unit tests.
- The Items (Pool) surface shows content-first rows, a working search box, kind filter chips, and an "N of M" count, with an empty state on no match.
- `npx vitest run`, `npx tsc -b`, and `npx vite build` all green.
- No changes to the data model, content store, or any non-Pool surface. All pre-existing tests still pass.
- Hand off to **Phase 2** (full-width shell + rail + course switcher + Courses surface) in a fresh session.
