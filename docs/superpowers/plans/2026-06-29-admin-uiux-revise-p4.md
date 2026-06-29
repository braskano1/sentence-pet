# Admin UI/UX Revise — Phase 4 (Bosses + Journey → master-detail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BossesTab and JourneyTab checkbox-wall UIs with the proven searchable master-detail pattern (PoolTab/PetsTab/CoursesTab), preserving every existing behaviour.

**Architecture:** Two new presentational pieces — `AssignList` (a searchable multi-select that kills the checkbox walls for boss pins + lesson items) and `LessonTree` (a two-level selectable units→lessons navigator). BossesTab becomes a `SearchableList` (gates + final unified) + a detail editor. JourneyTab becomes `LessonTree` + a discriminated detail panel (unit editor when a unit is selected, lesson editor when a lesson is selected — "Option A", user-approved 2026-06-29). Both tabs stay `{ course, onChange }` course surfaces; the shell's course SaveBar is theirs (no second SaveBar).

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react, Tailwind, the existing admin kit (`src/components/admin/ui`).

---

## Context the executor must read first

Read these before starting (they define the patterns this plan copies):
- `src/components/admin/PoolTab.tsx` — cleanest master-detail reference (`SearchableList` + `FilterChips` + footer add + detail editor + danger delete).
- `src/components/admin/PetsTab.tsx` — confirm-delete in the detail panel (`confirming` state reset on selection change).
- `src/components/admin/CoursesTab.tsx` — confirm-delete danger zone copy.
- `src/components/admin/ui/SearchableList.tsx`, `ui/FilterChips.tsx`, `ui/index.ts` — the kit. `SearchableList` is **flat**; it owns search internally over `searchText`, the caller pre-filters with chips and passes `total`.
- `src/components/admin/BossesTab.tsx`, `BossesTab.test.tsx` — the file to rewrite + its label-sensitive suite.
- `src/components/admin/JourneyTab.tsx`, `JourneyTab.test.tsx` — same.

Design reference (approved): `temp/admin-mockup/index.html` (Bosses + Journey views) and `temp/admin-mockup/journey-options.png` (Option A is the chosen unit-editing model).

### Kit facts that bite (from the P4 handoff)
- `TextInput`/`NumberInput`/`Select` use **native** `onChange` (`(e) => …e.target.value`); `NumberInput` also exposes `onValueChange: (n: number | null) => void`.
- `Button` variants: `primary` (default), `danger`, `ghost`. `Checkbox` is `{ label, checked, onChange }` with native `onChange` (`e.target.checked`).
- `Field` wraps its child in a `<label>` — the visible label text is queryable with `getByText`.
- A `SearchableList` row is a single `<button aria-current>`; its accessible name is the rendered row text. Select rows by content, not an aria-label.
- Run from Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool cwd resolves wrong). Use `npx tsc -b` (NOT `--noEmit`). Windows vitest "Worker exited unexpectedly" → re-run.
- Stage explicit files; never `git add -A`. **Adjust** `*.test.tsx`; never clobber an existing test body.
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`. No em-dashes in UI copy.

---

## File Structure

- **Create** `src/components/admin/ui/AssignList.tsx` — generic searchable multi-select (checkbox rows + internal search). Replaces the pins wall (Bosses) and the items-in-lesson wall (Journey). One responsibility: pick a subset of a list.
- **Create** `src/components/admin/ui/AssignList.test.tsx`.
- **Modify** `src/components/admin/ui/index.ts` — export `AssignList`.
- **Create** `src/components/admin/journeyTab/LessonTree.tsx` — two-level units→lessons selectable navigator with search + a Checkpoints filter chip + a `+ Unit` action + a `+ Add lesson` footer. One responsibility: navigation/selection, no editing.
- **Create** `src/components/admin/journeyTab/LessonTree.test.tsx`.
- **Modify** `src/components/admin/BossesTab.tsx` — master-detail rewrite.
- **Modify** `src/components/admin/BossesTab.test.tsx` — adjust the delete test to the confirm flow; keep the rest.
- **Modify** `src/components/admin/JourneyTab.tsx` — master-detail rewrite (Option A).
- **Modify** `src/components/admin/JourneyTab.test.tsx` — adjust unit-l1 + renders tests to the new selection model; keep `eligibleItemIds` + item-toggle + kind tests.

Per-task gates: `npx vitest run <file>` green, then before the final phase commit `npx tsc -b` and `npx vite build` clean.

---

## Task 1: `AssignList` — searchable multi-select (kills the checkbox walls)

**Files:**
- Create: `src/components/admin/ui/AssignList.tsx`
- Create: `src/components/admin/ui/AssignList.test.tsx`
- Modify: `src/components/admin/ui/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/ui/AssignList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignList } from './AssignList';

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

function setup(selected: string[] = ['a']) {
  const onToggle = vi.fn();
  render(
    <AssignList
      items={rows}
      getKey={(r) => r.id}
      isSelected={(r) => selected.includes(r.id)}
      onToggle={onToggle}
      searchText={(r) => `${r.name} ${r.id}`}
      ariaLabel={(r) => `item ${r.id}`}
      renderLabel={(r) => `${r.name} · ${r.id}`}
      placeholder="Search pool…"
    />,
  );
  return { onToggle };
}

describe('AssignList', () => {
  it('renders a checkbox per item with its selected state', () => {
    setup(['a']);
    expect(screen.getByRole('checkbox', { name: 'item a' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'item b' })).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles an item on click', () => {
    const { onToggle } = setup([]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'item b' }));
    expect(onToggle).toHaveBeenCalledWith(rows[1]);
  });

  it('filters rows by the search query', () => {
    setup([]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'brav' } });
    expect(screen.getByRole('checkbox', { name: 'item b' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'item a' })).toBeNull();
  });

  it('shows the empty hint when nothing matches', () => {
    setup([]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/AssignList.test.tsx`
Expected: FAIL — cannot resolve `./AssignList`.

- [ ] **Step 3: Write the component**

Create `src/components/admin/ui/AssignList.tsx`:

```tsx
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Searchable multi-select. Replaces admin checkbox walls: an internal search box
 * filters `items` by `searchText`, each row is a `role="checkbox"` button whose
 * accessible name comes from `ariaLabel`. Selection is owned by the caller
 * (`isSelected` + `onToggle`); this component holds only the query.
 */
export function AssignList<T>({
  items,
  getKey,
  isSelected,
  onToggle,
  renderLabel,
  searchText,
  ariaLabel,
  placeholder = 'Search…',
  emptyHint = 'No items.',
  headerNote,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  renderLabel: (item: T) => ReactNode;
  searchText: (item: T) => string;
  ariaLabel?: (item: T) => string;
  placeholder?: string;
  emptyHint?: string;
  headerNote?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => searchText(i).toLowerCase().includes(q)) : items;
  const searchId = useId();

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span aria-hidden>🔎</span>
        <label htmlFor={searchId} className="sr-only">Filter items</label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-700 outline-none"
        />
        {headerNote && <span className="ml-auto shrink-0 text-slate-400">{headerNote}</span>}
      </div>
      <ul className="max-h-72 overflow-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-slate-400">{emptyHint}</li>
        ) : (
          shown.map((item) => {
            const key = getKey(item);
            const selected = isSelected(item);
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={ariaLabel ? ariaLabel(item) : key}
                  onClick={() => onToggle(item)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[11px] text-white ${
                      selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                    }`}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{renderLabel(item)}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Export it** — add to `src/components/admin/ui/index.ts` after the `SearchableList` export line:

```ts
export { AssignList } from './AssignList';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/ui/AssignList.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/ui/AssignList.tsx src/components/admin/ui/AssignList.test.tsx src/components/admin/ui/index.ts
git commit -m "feat(admin): AssignList searchable multi-select (kit)"
```

---

## Task 2: BossesTab → master-detail

**Files:**
- Modify: `src/components/admin/BossesTab.tsx` (full rewrite)
- Modify: `src/components/admin/BossesTab.test.tsx` (adjust the delete test only)

**Design:** one unified list = `[...course.gates, finalBoss?]`. Search by name/id/scope; chips All/Gated/Final. Row shows name + a `gate-N` or `final` badge + a subtitle (`after <unit> · <element> · reward: <name|random>` for gated, `completes course · <element>` for final). Footer `+ Add gate`, plus `+ Add final boss` when `course.finalBoss` is absent. Detail editor for the selected node reuses the boss/sprite/reward/reviews fields, moves **After unit** into the editor (gated only), renders **pins** via `AssignList`, and deletes a gated boss behind a confirm. **Every existing aria-label and visible label is preserved** (`gate <id> name`, `final boss name`, tier, element, sprite species/stage, reward, reviewCount, reviews `<unitId>`, pins `<itemId>`, `gate <id> afterUnit`).

- [ ] **Step 1: Adjust the delete test to the confirm flow**

In `src/components/admin/BossesTab.test.tsx`, replace the body of the `'deletes a gated boss'` test (only that test) with:

```tsx
  it('deletes a gated boss via confirm', () => {
    const onChange = vi.fn();
    const c = course();
    c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
      boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
    render(<BossesTab course={c} onChange={onChange} />);
    // g1 is the first row, selected by default → its editor is shown.
    fireEvent.click(screen.getByRole('button', { name: /delete gate/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(onChange.mock.calls.at(-1)![0].gates).toHaveLength(0);
  });
```

Leave every other test in the file unchanged (the `course()` fixture has no gates, so the final boss is the default selection and `final boss …` labels remain reachable; the gate-reward and gate-afterUnit tests add a gate, which becomes the first/selected row).

- [ ] **Step 2: Run the suite to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: FAIL — the new confirm test (and others) fail against the old checkbox-wall UI (no "Delete gate" until selected, etc.).

- [ ] **Step 3: Rewrite `BossesTab.tsx`**

Replace the **entire** contents of `src/components/admin/BossesTab.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';
import { usePetDefs } from '../../state/usePetDefs';
import {
  Card, SectionLabel, Field, TextInput, NumberInput, Select, Checkbox, Button,
  SearchableList, FilterChips, AssignList,
} from './ui';
import type { FilterChip } from './ui';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

const SCOPE_CHIPS: readonly FilterChip<'all' | 'gated' | 'final'>[] = [
  { id: 'all', label: 'All' },
  { id: 'gated', label: 'Gated' },
  { id: 'final', label: 'Final' },
];
type ScopeFilter = (typeof SCOPE_CHIPS)[number]['id'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Boss/sprite/reward/reviews/pins editor for one node. After-unit is gated-only. */
function BossFields({ node, units, pool, onPatch }: {
  node: BossNode;
  units: { id: string; title?: string }[];
  pool: Record<string, { id: string }>;
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const petDefs = usePetDefs();
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  const poolItems = Object.values(pool);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <SectionLabel>Boss</SectionLabel>
          <div className="flex flex-col gap-3">
            <Field label="Name">
              <TextInput aria-label={`${labelPrefix} name`} value={node.boss.name}
                onChange={(e) => onPatch({ boss: { ...node.boss, name: e.target.value } })} />
            </Field>
            <Field label="Tier">
              <TextInput aria-label={`${labelPrefix} tierId`} value={node.boss.tierId}
                onChange={(e) => onPatch({ boss: { ...node.boss, tierId: e.target.value } })} />
            </Field>
            <Field label="Element">
              <Select aria-label={`${labelPrefix} element`} value={node.boss.element}
                onChange={(e) => onPatch({ boss: { ...node.boss, element: e.target.value as Species } })}>
                {SPECIES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            {node.scope !== 'final' && (
              <Field label="After unit">
                <Select aria-label={`gate ${node.id} afterUnit`} value={node.afterUnitId ?? ''}
                  onChange={(e) => onPatch({ afterUnitId: e.target.value })}>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.title ?? u.id} ({u.id})</option>)}
                </Select>
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <SectionLabel>Sprite</SectionLabel>
          <div className="flex flex-col gap-3">
            <Field label="Sprite species">
              <Select aria-label={`${labelPrefix} sprite species`} value={node.boss.rivalSprite.species}
                onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, species: e.target.value as Species } } })}>
                {SPECIES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Sprite stage">
              <Select aria-label={`${labelPrefix} sprite stage`} value={node.boss.rivalSprite.stage}
                onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, stage: e.target.value as Exclude<PetStage, 'egg'> } } })}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <SectionLabel>Reward</SectionLabel>
          <Field label="Reward pet" hint="Lists all pet defs — an authored reward may grant a non-gacha def.">
            <Select aria-label={`${labelPrefix} reward`} value={node.rewardPetDefId ?? ''}
              onChange={(e) => onPatch({ rewardPetDefId: e.target.value || undefined })}>
              <option value="">— none (random) —</option>
              {petDefs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        </Card>

        <Card>
          <SectionLabel>Reviews</SectionLabel>
          <div className="flex flex-col gap-3">
            <Field label="Review count">
              <NumberInput aria-label={`${labelPrefix} reviewCount`} value={node.reviewCount ?? 0}
                onValueChange={(n) => { if (n !== null) onPatch({ reviewCount: n }); }} />
            </Field>
            <div className="flex flex-wrap gap-3">
              {units.map((u) => (
                <Checkbox key={u.id} label={u.title ?? u.id} aria-label={`${labelPrefix} reviews ${u.id}`}
                  checked={reviews.includes(u.id)}
                  onChange={() => onPatch({ reviewsUnitIds: reviews.includes(u.id) ? reviews.filter((x) => x !== u.id) : [...reviews, u.id] })} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionLabel>Pinned items</SectionLabel>
        <AssignList
          items={poolItems}
          getKey={(it) => it.id}
          ariaLabel={(it) => `${labelPrefix} pins ${it.id}`}
          isSelected={(it) => pinned.includes(it.id)}
          onToggle={(it) => onPatch({ pinnedItemIds: pinned.includes(it.id) ? pinned.filter((x) => x !== it.id) : [...pinned, it.id] })}
          searchText={(it) => it.id}
          renderLabel={(it) => it.id}
          placeholder="Search items by id…"
          emptyHint="No items in this course pool."
        />
      </Card>
    </div>
  );
}

export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const list: BossNode[] = [...course.gates, ...(course.finalBoss ? [course.finalBoss] : [])];
  const petDefs = usePetDefs();
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { setConfirming(false); }, [selectedId]);

  const filtered = scope === 'all' ? list : list.filter((n) => (scope === 'final' ? n.scope === 'final' : n.scope !== 'final'));
  const unitTitle = (id?: string) => course.units.find((u) => u.id === id)?.title ?? id ?? '—';
  const rewardName = (n: BossNode) => (n.rewardPetDefId ? petDefs.find((d) => d.id === n.rewardPetDefId)?.name ?? n.rewardPetDefId : 'random');

  function patchGate(id: string, patch: Partial<BossNode>) {
    onChange({ ...course, gates: course.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function patchFinal(patch: Partial<BossNode>) {
    const base: BossNode = course.finalBoss ?? {
      id: `${course.id}-final`, title: 'Final Boss', scope: 'final', reviewsUnitIds: [], reviewCount: 6,
      boss: emptyBoss(), onClear: 'completeCourse',
    };
    onChange({ ...course, finalBoss: { ...base, ...patch, scope: 'final', onClear: 'completeCourse' } });
  }
  function patchNode(node: BossNode, patch: Partial<BossNode>) {
    if (node.scope === 'final') patchFinal(patch); else patchGate(node.id, patch);
  }
  function addGate() {
    let n = 1;
    while (course.gates.some((g) => g.id === `gate-${n}`)) n++;
    const id = `gate-${n}`;
    const gate: BossNode = {
      id, title: `Gate ${n}`, scope: 'gated',
      afterUnitId: course.units[0]?.id, reviewsUnitIds: [], reviewCount: 5, boss: emptyBoss(),
    };
    onChange({ ...course, gates: [...course.gates, gate] });
    setSelectedId(id);
  }
  function addFinal() {
    patchFinal({});
    setSelectedId(`${course.id}-final`);
  }
  function deleteGate(id: string) {
    const rest = course.gates.filter((g) => g.id !== id);
    onChange({ ...course, gates: rest });
    setSelectedId((rest[0]?.id) ?? (course.finalBoss?.id ?? null));
    setConfirming(false);
  }

  const selected = list.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex gap-4 text-sm">
      <SearchableList
        items={filtered}
        total={list.length}
        countNoun="boss"
        getKey={(n) => n.id}
        selectedKey={selectedId}
        onSelect={setSelectedId}
        searchText={(n) => `${n.boss.name} ${n.id} ${n.scope}`}
        query={query}
        onQuery={setQuery}
        placeholder="Search bosses by name or id…"
        filterSlot={<FilterChips chips={SCOPE_CHIPS} active={scope} onChange={setScope} label="Filter by scope" />}
        footer={
          <div className="flex flex-col gap-2">
            <Button onClick={addGate} className="w-full">+ Add gate</Button>
            {!course.finalBoss && <Button variant="ghost" onClick={addFinal} className="w-full">+ Add final boss</Button>}
          </div>
        }
        renderRow={(n) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-slate-900">{n.boss.name}</span>
              <span className={`shrink-0 rounded px-1.5 text-[11px] font-semibold ${n.scope === 'final' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {n.scope === 'final' ? 'final' : n.id}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {n.scope === 'final'
                ? `completes course · ${n.boss.element}`
                : `after ${unitTitle(n.afterUnitId)} · ${n.boss.element} · reward: ${rewardName(n)}`}
            </span>
          </div>
        )}
      />

      <div className="flex-1">
        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800">{selected.boss.name}</h2>
              <span className="font-mono text-xs text-slate-400">{selected.scope === 'final' ? 'final' : selected.id}</span>
            </div>
            <BossFields node={selected} units={course.units} pool={course.pool} onPatch={(p) => patchNode(selected, p)} />
            {selected.scope !== 'final' && (
              confirming ? (
                <div className="flex gap-2">
                  <Button variant="danger" aria-label={`delete gate ${selected.id}`} onClick={() => deleteGate(selected.id)}>Confirm delete</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete gate</Button>
              )
            )}
          </div>
        ) : (
          <Card><p className="text-slate-500">Add a gate or a final boss to begin.</p></Card>
        )}
      </div>
    </div>
  );
}
```

Notes for the executor:
- `course.pool` values carry an `id`; `AssignList` only reads `.id` here, so the loose `Record<string, { id: string }>` prop type is intentional and avoids importing `ContentItem` just for this.
- The delete button keeps the `delete gate <id>` aria-label on the **confirm** button so the adjusted test's `/delete gate/i` (the trigger) and `/confirm delete/i` both resolve; if you prefer, query the trigger by `/delete gate/i` and the confirm by `/confirm delete/i` as written.
- Default selection is the first list row; with the `course()` fixture (no gates, one final) that is the final boss, so `final boss …` labels are reachable on render exactly as the unchanged tests expect.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: PASS (all tests, including the new confirm-delete).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/BossesTab.tsx src/components/admin/BossesTab.test.tsx
git commit -m "feat(admin): BossesTab master-detail (SearchableList + AssignList pins)"
```

---

## Task 3: `LessonTree` — two-level units→lessons navigator

**Files:**
- Create: `src/components/admin/journeyTab/LessonTree.tsx`
- Create: `src/components/admin/journeyTab/LessonTree.test.tsx`

**Design:** the left panel for Journey. Search box (filters lessons by id/title), a Checkpoints filter chip, a `+ Unit` action in the count row, unit headers (selectable buttons) interleaved with their lesson rows (selectable buttons), and a `+ Add lesson` footer. Pure navigation: selection is a discriminated `{ type: 'unit' | 'lesson'; id: string }`; the caller owns it. A unit header stays visible whenever any of its lessons pass the active filter (so context is never lost), and always when the query is empty.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/journeyTab/LessonTree.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonTree } from './LessonTree';
import type { Unit } from '../../../content/model';

const units: Unit[] = [
  { id: 'u1', title: 'Greetings', emoji: '👋', order: 1, lessons: [
    { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: [] },
    { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: [], isCheckpoint: true },
  ] },
  { id: 'u2', title: 'Ordering', emoji: '🍜', order: 2, lessons: [
    { id: 'u2-l1', drill: 'pattern', level: 1, itemIds: [] },
  ] },
];

function setup(sel: { type: 'unit' | 'lesson'; id: string } | null = null) {
  const onSelect = vi.fn();
  const onAddUnit = vi.fn();
  const onAddLesson = vi.fn();
  render(
    <LessonTree units={units} selected={sel} onSelect={onSelect}
      onAddUnit={onAddUnit} onAddLesson={onAddLesson} />,
  );
  return { onSelect, onAddUnit, onAddLesson };
}

describe('LessonTree', () => {
  it('renders unit headers and lesson rows', () => {
    setup();
    expect(screen.getByRole('button', { name: /Greetings/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u1-l1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u2-l1' })).toBeInTheDocument();
  });

  it('selects a unit when its header is clicked', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Greetings/ }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'unit', id: 'u1' });
  });

  it('selects a lesson when its row is clicked', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'u1-l1' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'lesson', id: 'u1-l1' });
  });

  it('filters to checkpoint lessons when the Checkpoints chip is active', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /checkpoints/i }));
    expect(screen.getByRole('button', { name: 'u1-cp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'u1-l1' })).toBeNull();
  });

  it('filters lessons by the search query', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'u2-l1' } });
    expect(screen.getByRole('button', { name: 'u2-l1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'u1-l1' })).toBeNull();
  });

  it('fires onAddUnit and onAddLesson', () => {
    const { onAddUnit, onAddLesson } = setup();
    fireEvent.click(screen.getByRole('button', { name: /\+ unit/i }));
    fireEvent.click(screen.getByRole('button', { name: /add lesson/i }));
    expect(onAddUnit).toHaveBeenCalled();
    expect(onAddLesson).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/journeyTab/LessonTree.test.tsx`
Expected: FAIL — cannot resolve `./LessonTree`.

- [ ] **Step 3: Write the component**

Create `src/components/admin/journeyTab/LessonTree.tsx`:

```tsx
import { useId, useState } from 'react';
import type { Unit } from '../../../content/model';
import { Button, FilterChips } from '../ui';
import type { FilterChip } from '../ui';

export type TreeSelection = { type: 'unit' | 'lesson'; id: string };

const FILTERS: readonly FilterChip<'all' | 'checkpoints'>[] = [
  { id: 'all', label: 'All' },
  { id: 'checkpoints', label: 'Checkpoints ★' },
];
type TreeFilter = (typeof FILTERS)[number]['id'];

function lessonText(l: { id: string; title?: string }): string {
  return `${l.title ?? ''} ${l.id}`.toLowerCase();
}

export function LessonTree({ units, selected, onSelect, onAddUnit, onAddLesson }: {
  units: Unit[];
  selected: TreeSelection | null;
  onSelect: (s: TreeSelection) => void;
  onAddUnit: () => void;
  onAddLesson: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TreeFilter>('all');
  const searchId = useId();
  const q = query.trim().toLowerCase();

  const lessonCount = units.reduce((n, u) => n + u.lessons.length, 0);
  const isUnit = (id: string) => selected?.type === 'unit' && selected.id === id;
  const isLesson = (id: string) => selected?.type === 'lesson' && selected.id === id;

  function visibleLessons(u: Unit) {
    return u.lessons.filter((l) => {
      if (filter === 'checkpoints' && !l.isCheckpoint) return false;
      if (q && !lessonText(l).includes(q)) return false;
      return true;
    });
  }

  return (
    <div className="flex w-80 shrink-0 flex-col self-start rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
        <label htmlFor={searchId} className="sr-only">Search lessons</label>
        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-400 focus-within:border-indigo-400">
          <span aria-hidden>🔎</span>
          <input id={searchId} type="search" value={query} placeholder="Search lessons…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none" />
        </div>
        <FilterChips chips={FILTERS} active={filter} onChange={setFilter} label="Filter lessons" />
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
        <span>{units.length} units · {lessonCount} lessons</span>
        <button type="button" onClick={onAddUnit} className="font-semibold text-indigo-600 hover:underline">+ Unit</button>
      </div>

      <ul className="max-h-[28rem] flex-1 overflow-auto">
        {units.map((u) => {
          const lessons = visibleLessons(u);
          if (q || filter === 'checkpoints') {
            if (lessons.length === 0) return null; // hide units with no matching lessons while filtering
          }
          return (
            <li key={u.id}>
              <button type="button" aria-current={isUnit(u.id)} onClick={() => onSelect({ type: 'unit', id: u.id })}
                className={`flex w-full items-center gap-2 border-l-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 ${
                  isUnit(u.id) ? 'border-l-indigo-500 bg-indigo-50' : 'border-l-transparent hover:bg-slate-100'
                }`}>
                <span aria-hidden>{u.emoji}</span>
                <span className="truncate">{u.title}</span>
                <span className="ml-auto text-xs font-normal text-slate-400">{u.lessons.length}</span>
              </button>
              <ul>
                {lessons.map((l) => (
                  <li key={l.id}>
                    <button type="button" aria-current={isLesson(l.id)} onClick={() => onSelect({ type: 'lesson', id: l.id })}
                      className={`flex w-full items-center gap-2 border-l-2 border-b border-slate-100 py-2 pl-8 pr-3 text-left text-sm ${
                        isLesson(l.id) ? 'border-l-indigo-500 bg-indigo-50 text-indigo-900' : 'border-l-transparent hover:bg-slate-50'
                      }`}>
                      <span className="truncate">{l.title ?? l.id}</span>
                      {l.isCheckpoint && <span className="text-amber-500" aria-hidden>★</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-200 p-3">
        <Button onClick={onAddLesson} className="w-full">+ Add lesson</Button>
      </div>
    </div>
  );
}
```

Note: lesson rows whose `title` is unset show the `id` as their accessible name (the test fixtures and the existing JourneyTab fixtures have no lesson titles, so rows read as `u1-l1` etc.). Unit header accessible name includes the title (`Greetings`), so `getByRole('button', { name: /Greetings/ })` resolves.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/journeyTab/LessonTree.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/journeyTab/LessonTree.tsx src/components/admin/journeyTab/LessonTree.test.tsx
git commit -m "feat(admin): LessonTree two-level units/lessons navigator"
```

---

## Task 4: JourneyTab → master-detail (Option A)

**Files:**
- Modify: `src/components/admin/JourneyTab.tsx` (full rewrite; keep + re-export `eligibleItemIds`)
- Modify: `src/components/admin/JourneyTab.test.tsx` (adjust the two selection-dependent tests; keep `eligibleItemIds`, item-toggle, kind tests)

**Design (Option A):** `LessonTree` on the left; the detail panel is a **unit editor** when a unit is selected (Title, Emoji, Order, L1-enabled toggle, confirm Delete unit) and a **lesson editor** when a lesson is selected (Kind, Drill, Level, Checkpoint toggle, items via `AssignList`, confirm Delete lesson). `+ Unit` appends a unit; `+ Add lesson` appends a lesson to the currently-selected (or first) unit. Default selection is the first lesson of the first unit. The L1 toggle moves from the lesson editor to the unit editor (it is a unit property).

- [ ] **Step 1: Adjust the selection-dependent tests**

In `src/components/admin/JourneyTab.test.tsx`:

(a) Replace the `'renders units and their lessons'` test body with:

```tsx
  it('renders units and their lessons', () => {
    render(<JourneyTab course={course()} onChange={() => {}} />);
    // unit header in the tree + lesson row
    expect(screen.getByRole('button', { name: /One/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'u1-l1' })).toBeInTheDocument();
  });
```

(b) Replace the `'toggling unit l1Enabled writes unit.l1Enabled'` test body with (select the unit header, then toggle L1 in the unit editor):

```tsx
  it('toggling unit l1Enabled writes unit.l1Enabled', () => {
    const onChange = vi.fn();
    render(<JourneyTab course={course()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /One/ }));      // select the unit
    fireEvent.click(screen.getByRole('checkbox', { name: /l1 enabled/i }));
    const next = onChange.mock.calls.at(-1)![0] as Course;
    expect(next.units[0].l1Enabled).toBe(true);
  });
```

Leave `eligibleItemIds`, `'toggling an item id…'`, `'changing the lesson kind writes lesson.kind'`, and `'changing the lesson kind prunes itemIds…'` unchanged. Those click `getByText('u1-l1')` then operate on the lesson editor — `u1-l1` is still rendered text inside the lesson row button, so `getByText` still resolves, and the lesson is selected by default anyway.

- [ ] **Step 2: Run the suite to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/JourneyTab.test.tsx`
Expected: FAIL against the old UI (no unit-header button, L1 not in a unit editor).

- [ ] **Step 3: Rewrite `JourneyTab.tsx`**

Replace the **entire** contents of `src/components/admin/JourneyTab.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import type { Course } from '../../content/course';
import type { Lesson, Unit } from '../../content/model';
import type { ContentItem, ContentKind } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { Card, Field, TextInput, NumberInput, Select, Checkbox, Button, AssignList } from './ui';
import { LessonTree } from './journeyTab/LessonTree';
import type { TreeSelection } from './journeyTab/LessonTree';

/** Pool item ids whose kind matches a node's kind — the items admins may assign to it. */
export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}

export function JourneyTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const firstUnit = course.units[0];
  const [selected, setSelected] = useState<TreeSelection | null>(
    firstUnit?.lessons[0] ? { type: 'lesson', id: firstUnit.lessons[0].id }
    : firstUnit ? { type: 'unit', id: firstUnit.id }
    : null,
  );
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [selected]);

  function setUnits(units: Unit[]) { onChange({ ...course, units }); }
  function patchUnit(unitId: string, patch: Partial<Unit>) {
    setUnits(course.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  }
  function patchLesson(unitId: string, lessonId: string, patch: Partial<Lesson>) {
    setUnits(course.units.map((u) => u.id !== unitId ? u : {
      ...u, lessons: u.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    }));
  }
  function toggleItem(unitId: string, lesson: Lesson, itemId: string) {
    const itemIds = lesson.itemIds.includes(itemId)
      ? lesson.itemIds.filter((id) => id !== itemId)
      : [...lesson.itemIds, itemId];
    patchLesson(unitId, lesson.id, { itemIds });
  }

  function addUnit() {
    let n = 1;
    while (course.units.some((u) => u.id === `unit-${n}`)) n++;
    const id = `unit-${n}`;
    const unit: Unit = { id, title: `Unit ${n}`, emoji: '📘', order: course.units.length + 1, lessons: [] };
    setUnits([...course.units, unit]);
    setSelected({ type: 'unit', id });
  }
  function deleteUnit(unitId: string) {
    const rest = course.units.filter((u) => u.id !== unitId);
    setUnits(rest);
    setSelected(rest[0]?.lessons[0] ? { type: 'lesson', id: rest[0].lessons[0].id }
      : rest[0] ? { type: 'unit', id: rest[0].id } : null);
    setConfirming(false);
  }
  function targetUnit(): Unit | undefined {
    if (selected?.type === 'unit') return course.units.find((u) => u.id === selected.id);
    if (selected?.type === 'lesson') return course.units.find((u) => u.lessons.some((l) => l.id === selected.id));
    return course.units[0];
  }
  function addLesson() {
    const unit = targetUnit();
    if (!unit) return;
    let n = 1;
    const taken = new Set(course.units.flatMap((u) => u.lessons.map((l) => l.id)));
    while (taken.has(`${unit.id}-l${n}`)) n++;
    const id = `${unit.id}-l${n}`;
    const lesson: Lesson = { id, kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: [] };
    patchUnit(unit.id, { lessons: [...unit.lessons, lesson] });
    setSelected({ type: 'lesson', id });
  }
  function deleteLesson(unitId: string, lessonId: string) {
    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) return;
    const rest = unit.lessons.filter((l) => l.id !== lessonId);
    patchUnit(unitId, { lessons: rest });
    setSelected(rest[0] ? { type: 'lesson', id: rest[0].id } : { type: 'unit', id: unitId });
    setConfirming(false);
  }

  const unitSel = selected?.type === 'unit' ? course.units.find((u) => u.id === selected.id) ?? null : null;
  const lessonCtx = selected?.type === 'lesson'
    ? course.units.flatMap((u) => u.lessons.map((l) => ({ u, l }))).find(({ l }) => l.id === selected.id) ?? null
    : null;

  return (
    <div className="flex gap-4 text-sm">
      <LessonTree units={course.units} selected={selected} onSelect={setSelected}
        onAddUnit={addUnit} onAddLesson={addLesson} />

      <div className="flex-1">
        {unitSel && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800">{unitSel.title}</h2>
              <span className="font-mono text-xs text-slate-400">unit · {unitSel.id}</span>
            </div>
            <Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Title">
                  <TextInput aria-label={`unit ${unitSel.id} title`} value={unitSel.title}
                    onChange={(e) => patchUnit(unitSel.id, { title: e.target.value })} />
                </Field>
                <Field label="Emoji">
                  <TextInput aria-label={`unit ${unitSel.id} emoji`} value={unitSel.emoji}
                    onChange={(e) => patchUnit(unitSel.id, { emoji: e.target.value })} />
                </Field>
                <Field label="Order">
                  <NumberInput value={unitSel.order ?? 0}
                    onValueChange={(v) => { if (v !== null) patchUnit(unitSel.id, { order: v }); }} />
                </Field>
              </div>
            </Card>
            <Checkbox label="L1 enabled (TH/ENG toggle for the whole unit)" checked={!!unitSel.l1Enabled}
              onChange={(e) => patchUnit(unitSel.id, { l1Enabled: e.target.checked })} />
            {confirming ? (
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => deleteUnit(unitSel.id)}>Confirm delete</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete unit</Button>
            )}
          </div>
        )}

        {lessonCtx && (() => {
          const { u, l } = lessonCtx;
          const kind = l.kind ?? 'dragdrop';
          const eligible = Object.values(course.pool).filter((it) => it.kind === kind);
          return (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">{l.title ?? l.id}</h2>
                <span className="font-mono text-xs text-slate-400">{l.id} · {u.title}</span>
              </div>
              <Card>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Kind">
                    <Select value={kind}
                      onChange={(e) => {
                        const k = e.target.value as ContentKind;
                        patchLesson(u.id, l.id, { kind: k, itemIds: l.itemIds.filter((id) => course.pool[id]?.kind === k) });
                      }}>
                      {['flashcard', 'matching', 'dragdrop', 'fillblank'].map((k) => <option key={k}>{k}</option>)}
                    </Select>
                  </Field>
                  <Field label="Drill">
                    <Select value={l.drill}
                      onChange={(e) => patchLesson(u.id, l.id, { drill: e.target.value as Lesson['drill'] })}>
                      {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
                    </Select>
                  </Field>
                  <Field label="Level">
                    <NumberInput value={l.level}
                      onValueChange={(n) => { if (n !== null) patchLesson(u.id, l.id, { level: n }); }} />
                  </Field>
                </div>
              </Card>
              <Checkbox label="Checkpoint ★" checked={!!l.isCheckpoint}
                onChange={(e) => patchLesson(u.id, l.id, { isCheckpoint: e.target.checked })} />
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
              {confirming ? (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => deleteLesson(u.id, l.id)}>Confirm delete</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete lesson</Button>
              )}
            </div>
          );
        })()}

        {!unitSel && !lessonCtx && (
          <Card><p className="text-slate-500">Select a unit or lesson, or add one.</p></Card>
        )}
      </div>
    </div>
  );
}
```

Notes for the executor:
- `eligibleItemIds` is preserved and exported (its unit test in `JourneyTab.test.tsx` stays green).
- The item-toggle test clicks `getByText('u1-l1')` then `getByRole('checkbox', { name: /item b/i })`. The lesson row renders `u1-l1` as text, and `AssignList` rows are `role="checkbox"` with `aria-label="item b"` — both resolve.
- Confirm `Unit.order`, `Unit.emoji`, `Lesson.title`, `Lesson.kind` field names against `src/content/model.ts` before relying on them; if `order` is non-optional or named differently, adjust the unit editor accordingly. (The existing code already reads `unit.title`/`unit.emoji`/`unit.l1Enabled` and `lesson.kind`/`lesson.drill`/`lesson.level`/`lesson.isCheckpoint`/`lesson.itemIds`, so those are safe.)

- [ ] **Step 4: Run the suite to verify it passes**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/JourneyTab.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/JourneyTab.tsx src/components/admin/JourneyTab.test.tsx
git commit -m "feat(admin): JourneyTab master-detail (LessonTree + unit/lesson editors)"
```

---

## Task 5: Whole-phase verification + final commit

**Files:** none (verification only), unless a gap is found.

- [ ] **Step 1: Full unit suite green**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run`
Expected: PASS. Baseline before P4 is **166 admin + 1125 full**; expect a net increase from the new AssignList/LessonTree suites. On a Windows "Worker exited unexpectedly", re-run.

- [ ] **Step 2: Types clean**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Build clean**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (the executor describes, the reviewer runs if a dev server is available)**

Confirm in the admin shell: Bosses surface lists gates + final, search + scope chips work, selecting a node edits it, pins are searchable, add gate / add final / confirm-delete-gate work, the shell SaveBar (one per surface) still saves. Journey surface shows the units→lessons tree, selecting a unit edits title/emoji/order/L1, selecting a lesson edits kind/drill/level/checkpoint + searchable items, add unit / add lesson / confirm-delete work.

- [ ] **Step 5: Final whole-phase review + commit**

Request a code-quality + spec review of the full P4 diff (per subagent-driven-development). Address findings, then if any fixes were made:

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add -p   # stage explicit hunks only; never git add -A
git commit -m "chore(admin): P4 review fixes (Bosses + Journey master-detail)"
```

---

## Self-Review (run by the plan author against the P4 handoff scope)

**Spec coverage:**
- Handoff item 1 (BossesTab → master-detail, keep all boss behaviour: validateCourse cross-refs via rewardPetDefId/reviewsUnitIds, finalBoss synth/enforce, xlsx columns, tier/element/rivalSprite) → Task 2. All fields + `patchFinal` synth-with-`scope:'final'`/`onClear:'completeCourse'` preserved; reward/reviews/pins/tier/element/sprite aria-labels preserved.
- Handoff item 2 (JourneyTab → master-detail, keep lesson↔item assignment, checkpoint flags, ordering; two-level density) → Tasks 3 + 4 (LessonTree + Option A editors; AssignList for item assignment; checkpoint toggle + filter; unit order field).
- Handoff item 3 (per-row inactive-course counts) → explicitly deferred to P5 (left untouched).

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output.

**Type consistency:** `TreeSelection` defined in Task 3, imported in Task 4. `AssignList` prop names (`items/getKey/isSelected/onToggle/renderLabel/searchText/ariaLabel/placeholder/emptyHint/headerNote`) are identical across Task 1 (def), Task 2 (Bosses pins), Task 4 (Journey items). `BossNode`/`Unit`/`Lesson` fields read match the current code. One residual risk flagged inline for the executor: confirm `Unit.order`/`Unit.emoji` exact shape in `src/content/model.ts` before Task 4 Step 3.

**Deferred to P5 (carry forward):** per-row inactive-course counts; shell `ValidationSummary` rendering on Pets/non-course surfaces; `addItem`/`addPet`/`addGate` selecting a row hidden by an active query; per-surface `ImportDrawer` + `mergeById` + delete standalone `ImportTab.tsx`; keyboard nav polish; then promote the whole epic line to main.
```
