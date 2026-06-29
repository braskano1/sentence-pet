# Admin UI/UX Revise — Phase 3 Implementation Plan (Pets → SearchableList + reconcile the SaveBar seam)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Pets admin surface to the shared kit pattern (SearchableList + FilterChips master list, detail-panel delete) and remove the confusing double-SaveBar that Phase 2 exposed on the Pets surface.

**Architecture:** PetsTab keeps ALL its existing behaviour (live re-seed, reconcile/validate/save, add/delete/rename/setStarter/patch, PetForm, sprite upload). Only its master-LIST UI swaps from a hand-rolled `<ul>` (per-row Edit/Delete buttons + gen `<Select>`) to `SearchableList<PetDef>` + `FilterChips` (gen), with delete moved into the detail panel behind a confirm (mirrors `CoursesTab`). Separately, the shell's course-scoped SaveBar is hidden on the global Pets surface (Option A from the handoff) so each surface shows exactly ONE SaveBar acting on its own data.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Tailwind (admin tokens scoped to `.admin-root`). Existing kit: `src/components/admin/ui/{SearchableList,FilterChips,SaveBar,Card,Button}`.

---

## Context the implementer needs (read first)

- **Branch:** `admin-uiux-revise` (the epic INTEGRATION branch — do NOT branch off main; the whole epic merges to main after P5). Confirm with `git status -sb` → `## admin-uiux-revise`.
- **Repo:** `D:/ai_projects/AI_design_thinking/sentence-pet`. Run all shell commands via Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (the PowerShell tool resolves cwd wrong here).
- **Reference composition:** `src/components/admin/PoolTab.tsx` is the canonical `SearchableList` + `FilterChips` + footer-`+ New` + detail-panel `Delete` composition. `src/components/admin/CoursesTab.tsx` is the canonical delete-with-confirm-in-detail-panel composition. Build Pets to match these.
- **Kit contracts (already shipped, do not change):**
  - `SearchableList<T>` props: `items` (already gen-filtered), `total` (pre-filter count), `getKey`, `selectedKey`, `onSelect`, `renderRow(item, selected)`, `searchText`, `query`, `onQuery`, `placeholder`, `filterSlot`, `footer`, `countNoun`. It renders one `<li>` per shown row (each row is a `<button aria-current>` whose accessible name is its rendered text), an empty-state `<li>`, and a "N of M nouns" count. The caller owns `query` + selection state.
  - `FilterChips<T extends string>` props: `chips: {id:T,label:string}[]`, `active: T`, `onChange:(id:T)=>void`, `label`. Renders a `role="group"` of `aria-pressed` toggle buttons (accessible name = chip label).
  - `SaveBar` props: `valid`, `status`, `onSave`, `dirty?`, `errorCount?`, `saveLabel?` (default `"Save"`).
- **Hazards (carry forward):** `tsc -b` NOT `--noEmit`. Stage explicit files; never `git add -A`. **Adjust** existing `*.test.tsx` — never clobber test bodies (Pets has a large label-sensitive suite). Admin tokens stay scoped to `.admin-root`; no global `@theme`. No em-dashes in UI copy. Windows vitest "Worker exited unexpectedly" → just re-run.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/components/admin/PetsTab.tsx` | Pets master-detail surface | Modify: swap list UI to SearchableList+FilterChips; move delete to detail panel; keep its own SaveBar |
| `src/components/admin/PetsTab.test.tsx` | PetsTab behaviour suite | Modify: re-point list/edit/delete/gen-filter assertions to the new structure (never clobber) |
| `src/components/admin/AdminShell.tsx` | Admin shell (rail + header SaveBar + surfaces) | Modify: hide the course SaveBar when `surface === 'pets'` |
| `src/components/admin/AdminShell.test.tsx` | Shell behaviour suite | Modify: add a test that no "Save changes" bar renders on the Pets surface |

No new files. `petsTab/PetForm.tsx` and `petsTab/helpers.ts` are untouched.

---

## Task 1: Migrate PetsTab list → SearchableList + FilterChips, move delete to the detail panel

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

The current PetsTab (`PetsTab.tsx:116-175`) renders a header row (`<h2>` + gen `<Select>` in a `Field label="filter by gen"` + `+ Add pet` `Button` + its `SaveBar`), then a two-column body: a hand-rolled `<ul>` of rows (each row: `#dexNo`, name, `· element · [types]`, `⭐ starter`/`(disabled)`, an `edit ${name}` button, a `delete ${name}` button) beside the `PetForm` detail panel.

Target structure (mirror PoolTab + CoursesTab):
- **Header row:** `<h2>Pets</h2>` + spacer + the existing `SaveBar` (unchanged props: `valid`, `status`, `onSave`, `errorCount` — no `saveLabel`, so it reads "Save"). Remove the gen `<Select>`/`Field` and the `+ Add pet` button from here.
- **Body:** `SearchableList<PetDef>` (left) + detail panel (right).
  - `items={shown}` (gen-filtered, existing `shown` memo), `total={draft.length}`, `countNoun="pet"`.
  - `getKey={(d) => d.id}`, `selectedKey={editingId}`, `onSelect={setEditingId}`.
  - `searchText={(d) => `${d.name} ${d.id} ${d.element} ${d.types.join(' ')}`}`.
  - `query`/`onQuery` from new `query` state.
  - `placeholder="Search pets by name, id, element..."` (three dots, NOT an ellipsis char; no em-dash).
  - `filterSlot`: a `FilterChips` whose chips are `[{id:'all',label:'All'}, ...gens.map(g => ({id:String(g),label:`Gen ${g}`}))]`, `active={String(genFilter)}`, `onChange={(id)=> setGenFilter(id === 'all' ? 'all' : Number(id))}`, `label="Filter by gen"`.
  - `footer`: `<Button onClick={addPet} className="w-full">+ Add pet</Button>`.
  - `renderRow={(d) => (...)}` showing `#{d.dexNo}` (mono), `{d.name}` (bold), `· {d.element} · [{d.types.join(', ')}]`, and `⭐ starter` / `(disabled)` badges. Keep the `#{dexNo}` and `{types.join(', ')}` text formats — tests match `/#5/` and `/leaf, fire/`.
  - **Detail panel** (right, `flex-1`): when a pet is selected, render `PetForm` (unchanged props) followed by a delete block mirroring CoursesTab's confirm flow, guarded by the existing `canDelete`:
    - primary `Button variant="danger"` labelled `Delete pet`, `disabled={!canDelete(editing)}`; clicking sets a local `confirming` boolean.
    - when `confirming`: `Button variant="danger"` `Confirm delete` (calls `deletePet(editing.id)`) + `Button variant="ghost"` `Cancel` (clears `confirming`).
    - when no pet selected: the existing `<Card>` "Select a pet to edit, or add a new one." empty state.

Behaviour changes (small, required):
- `addPet` should select the new def: capture the generated id and `setEditingId(id)` after appending (mirrors PoolTab's `setSelected(id)`).
- `deletePet` must clear the selection when the deleted def was open: `if (editingId === id) setEditingId(null);` and reset the local `confirming` flag.
- Add `const [query, setQuery] = useState('')`. Add a local `const [confirming, setConfirming] = useState(false)` and reset it whenever `editingId` changes (e.g. `useEffect(() => setConfirming(false), [editingId])`) so a stale confirm never carries across pets.
- Imports: drop `Field`, `Select`; add `SearchableList`, `FilterChips` (and `import type { FilterChip } from './ui'` only if you type the chips array). Keep `Card`, `Button`, `SaveBar`, `ValidationSummary`, `useEffect`, `useMemo`, `useState`.
- Keep everything else verbatim: the `export { ... }` re-exports, `nextDexNo`/`genId`, `patch`/`setStarter`/`rename`, `gens`/`shown`/`reconciled`/`validation` memos, the mount-time `hydratePetDefs` effect + `loaded` gate + `loading pets...` status, `save()`, `canDelete`.

- [ ] **Step 1: Re-point the list/edit/gen-filter tests to the new structure (failing)**

In `PetsTab.test.tsx`, adjust these existing tests (edit bodies in place; do not delete other tests):

```tsx
// "Add creates a new def..." — selecting still works; #5 row text unchanged. Leave as-is
//   (uses getAllByRole('listitem') + getByText(/#5/), both still valid).

// openFirstEditor() in "PetsTab — edit form": replace the edit-button click with a row click.
async function openFirstEditor() {
  render(<PetsTab />);
  await screen.findByRole('button', { name: /add pet/i });
  fireEvent.click(screen.getByRole('button', { name: /leaflet/i })); // row button = pet name
}

// Everywhere a test selects a pet via `{ name: /edit .*<pet>/i }`, change to the row name:
//   /edit .*dewdrop/i  -> /dewdrop/i
//   /edit .*leaflet/i  -> /leaflet/i
//   /edit .*new pet/i  -> /new pet/i
// (Row buttons are uniquely named by pet name; PetForm renders <select>/<option>, not buttons,
//  so these stay unambiguous once the form is open.)

// "gen filter narrows the list": swap the <Select> change for a FilterChips click.
it('gen filter narrows the list (no defs shown for an empty gen)', async () => {
  render(<PetsTab />);
  await screen.findByRole('button', { name: /add pet/i });
  fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // adds gen-1 def #5
  fireEvent.click(screen.getByRole('button', { name: /^gen 1$/i }));  // FilterChips chip
  expect(screen.getAllByRole('listitem').length).toBe(5);
});
```

- [ ] **Step 2: Re-point the delete tests to the detail-panel confirm flow (failing)**

```tsx
it('Delete removes a def', async () => {
  render(<PetsTab />);
  await screen.findByRole('button', { name: /add pet/i });
  fireEvent.click(screen.getByRole('button', { name: /dewdrop/i }));        // select the row
  fireEvent.click(screen.getByRole('button', { name: /^delete pet$/i }));   // arm confirm
  fireEvent.click(screen.getByRole('button', { name: /^confirm delete$/i })); // confirm
  expect(screen.queryByText(/Dewdrop/)).not.toBeInTheDocument();
});

it('Delete is disabled for the sole starter', async () => {
  render(<PetsTab />);
  await screen.findByRole('button', { name: /add pet/i });
  fireEvent.click(screen.getByRole('button', { name: /leaflet/i }));
  expect(screen.getByRole('button', { name: /^delete pet$/i })).toBeDisabled();
});

it('Delete is disabled for the last enabled def', async () => {
  setActivePetDefs([
    { ...BUILTIN_PET_DEFS[0], enabled: false },
    { ...BUILTIN_PET_DEFS[1], starter: false },
    { ...BUILTIN_PET_DEFS[2], starter: false, enabled: false },
    { ...BUILTIN_PET_DEFS[3], starter: false, enabled: false },
  ]);
  render(<PetsTab />);
  await screen.findByRole('button', { name: /add pet/i });
  fireEvent.click(screen.getByRole('button', { name: /embers/i }));
  expect(screen.getByRole('button', { name: /^delete pet$/i })).toBeDisabled();
});
```

- [ ] **Step 3: Run the PetsTab tests to verify they fail**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — old structure gone / new roles not yet rendered (e.g. "Unable to find role button name /gen 1/", "/delete pet/").

- [ ] **Step 4: Implement the PetsTab migration**

Replace the `return (...)` block (and the small behaviour additions above) in `src/components/admin/PetsTab.tsx`. Reference shape (adapt, keep all existing handlers):

```tsx
const [query, setQuery] = useState('');
const [confirming, setConfirming] = useState(false);
useEffect(() => setConfirming(false), [editingId]);

// addPet: after building newDef, select it
function addPet() {
  const gen = genFilter === 'all' ? 1 : genFilter;
  const id = genId(draft);
  setDraft((prev) => {
    const base = defaultDefForElement('leaf', prev);
    const newDef: PetDef = { ...base, id, name: 'New Pet', gen, dexNo: nextDexNo(prev, gen),
      starter: false, enabled: true, evolvesFromId: undefined, evolvesToId: undefined, evolutionStage: undefined };
    return [...prev, newDef];
  });
  setEditingId(id);
}

function deletePet(id: string) {
  setDraft((prev) => prev.filter((d) => d.id !== id));
  if (editingId === id) setEditingId(null);
  setConfirming(false);
}

const genChips: FilterChip<string>[] = [
  { id: 'all', label: 'All' },
  ...gens.map((g) => ({ id: String(g), label: `Gen ${g}` })),
];

// ...inside return, after the loaded gate:
return (
  <div className="flex flex-col gap-4 text-sm text-slate-800">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold">Pets</h2>
      <span className="flex-1" />
      <SaveBar valid={validation.ok} status={status} onSave={save} errorCount={validation.errors.length} />
    </div>

    <ValidationSummary errors={validation.ok ? [] : validation.errors} />

    <div className="flex gap-4">
      <SearchableList
        items={shown}
        total={draft.length}
        countNoun="pet"
        getKey={(d) => d.id}
        selectedKey={editingId}
        onSelect={setEditingId}
        searchText={(d) => `${d.name} ${d.id} ${d.element} ${d.types.join(' ')}`}
        query={query}
        onQuery={setQuery}
        placeholder="Search pets by name, id, element..."
        filterSlot={<FilterChips chips={genChips} active={String(genFilter)}
          onChange={(id) => setGenFilter(id === 'all' ? 'all' : Number(id))} label="Filter by gen" />}
        footer={<Button onClick={addPet} className="w-full">+ Add pet</Button>}
        renderRow={(d) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-slate-500">#{d.dexNo}</span>
            <strong>{d.name}</strong>
            <span className="text-slate-500">· {d.element} · [{d.types.join(', ')}]</span>
            {d.starter && <span>· ⭐ starter</span>}
            {!d.enabled && <span className="text-slate-400">· (disabled)</span>}
          </span>
        )}
      />

      <div className="flex-1">
        {editing ? (
          <div className="flex flex-col gap-3">
            <PetForm def={editing} allDefs={draft}
              onPatch={(p) => patch(editing.id, p)}
              onRename={(newId) => rename(editing.id, newId)}
              onSetStarter={() => setStarter(editing.id)} />
            {confirming ? (
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => deletePet(editing.id)}>Confirm delete</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="danger" className="self-start" disabled={!canDelete(editing)}
                onClick={() => setConfirming(true)}>Delete pet</Button>
            )}
          </div>
        ) : (
          <Card><p className="text-slate-500">Select a pet to edit, or add a new one.</p></Card>
        )}
      </div>
    </div>
  </div>
);
```

Update the import line to drop `Field, Select` and add `SearchableList, FilterChips`, plus `import type { FilterChip } from './ui'`.

- [ ] **Step 5: Run the PetsTab tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS (all describe blocks, including sprite-upload and master-detail). If a sprite test selects via a pet name that now collides with PetForm text, narrow with `getAllByRole('button', { name: /leaflet/i })[0]` (the row is the first button).

- [ ] **Step 6: Typecheck**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b`
Expected: clean (no errors). Fix any `FilterChip<string>` / `genFilter` type mismatches.

- [ ] **Step 7: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): migrate Pets to SearchableList + FilterChips, delete in detail panel"
```

---

## Task 2: Reconcile the SaveBar seam — hide the course SaveBar on the Pets surface (Option A)

**Files:**
- Modify: `src/components/admin/AdminShell.tsx:87-94` (the header SaveBar)
- Test: `src/components/admin/AdminShell.test.tsx`

The shell renders a course-scoped `SaveBar` (`saveLabel="Save changes"`, acts on the course `draft`) in the header row for every surface. On the global Pets surface this bar does nothing for pets (pets are global, saved by PetsTab's own SaveBar) — two SaveBars, one inert. Option A: render the shell's SaveBar only for course/courses surfaces; hide it on `pets`. PetsTab keeps its own "Save" bar.

- [ ] **Step 1: Add the failing shell test**

In `AdminShell.test.tsx`, inside `describe('AdminShell', ...)`:

```tsx
it('hides the course Save changes bar on the global Pets surface (PetsTab owns its own SaveBar)', async () => {
  render(<AdminShell />);
  fireEvent.click(await screen.findByRole('tab', { name: /pets/i }));
  expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: FAIL — "Save changes" button still found on the Pets surface.

- [ ] **Step 3: Hide the shell SaveBar on the Pets surface**

In `AdminShell.tsx`, wrap the header `SaveBar` so it only renders off the Pets surface:

```tsx
<div className="flex flex-wrap items-center gap-3">
  <CourseSwitcher courses={index} activeId={activeCourseId} onSelect={(id) => runAction('switch', switchTo(id))} />
  <span className="flex-1" />
  {surface !== 'pets' && (
    <SaveBar
      valid={validation.ok}
      dirty={dirty}
      status={status}
      onSave={save}
      saveLabel="Save changes"
      errorCount={validation.errors.length}
    />
  )}
</div>
```

(Leave the `CourseSwitcher` and the spacer in place — the row stays populated, no jumpiness. The course `ValidationSummary` below the row stays; it is only non-empty when the course itself is invalid, which is independent of the Pets surface and out of scope for P3.)

- [ ] **Step 4: Run the shell tests to verify they pass**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: PASS (new test + all 7 existing — the other tests assert "Save changes" on the default Courses surface, which still renders it).

- [ ] **Step 5: Commit**

```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git add src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx
git commit -m "fix(admin): hide course SaveBar on global Pets surface (one SaveBar per surface)"
```

---

## Task 3: Whole-phase verification gate

**Files:** none (verification only).

- [ ] **Step 1: Full admin + full suite**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx vitest run src/components/admin && npx vitest run`
Expected: all green (Windows "Worker exited unexpectedly" → re-run). Baseline before P3: 165 admin / 1123 full.

- [ ] **Step 2: Typecheck + build**

Run: `cd /d/ai_projects/AI_design_thinking/sentence-pet && npx tsc -b && npx vite build`
Expected: both clean.

- [ ] **Step 3: Final whole-phase review**

Dispatch a fresh Opus review (spec + code-quality) over the P3 diff vs the pre-P3 tip. Confirm: exactly ONE visible SaveBar per surface acting on that surface's data; no clobbered tests; all prior Pets behaviour intact (live re-seed, reconcile/validate/save, sprite upload, evolution links, starter/canDelete guards). Fix findings, re-run Step 1-2, then commit any fixes.

---

## Self-Review

**Spec coverage** (handoff `2026-06-30-admin-uiux-revise-p3.md`):
- (1) Migrate PetsTab list → SearchableList + FilterChips → Task 1. ✓ (search by name/id/element/types; gen chips; footer `+ Add pet`; content-first rows; `total`=unfiltered length).
- (2) Reconcile per-surface SaveBar (Option A) → Task 2. ✓ (course SaveBar hidden on Pets; PetsTab keeps its own; exactly one per surface).
- (3) Rail/header render cleanly with the bar hidden → Task 2 Step 3 note (CourseSwitcher + spacer keep the row populated; Pets count still from `getActivePetDefs().length`, unchanged). ✓
- Delete moved to detail panel with confirm + `canDelete` guard (handoff "prefer CoursesTab confirm pattern") → Task 1. ✓
- Preserve all Pets behaviour + adjust (never clobber) label-sensitive tests → Task 1 Steps 1-2, Task 3. ✓

**Placeholder scan:** none — every code/test step shows concrete code; no "handle edge cases"/TBD.

**Type consistency:** `genChips: FilterChip<string>[]`, `FilterChips active={String(genFilter)}`, `onChange` maps back to `'all' | number`; `deletePet(id)`/`addPet()`/`canDelete(editing)` signatures match existing PetsTab; `SaveBar`/`SearchableList`/`FilterChips` props match the shipped kit contracts read from source.
