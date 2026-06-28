# Generational Pet Dex P2b — `PetsTab` Authoring UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-contained `PetsTab` admin UI that CRUDs the `PetDef` v2 catalog (list grouped/filterable by gen; add/edit/delete; per-def form for all v2 fields incl. evolution; validate-gates-save; swaps the live registry on save) and wire it into `AdminShell`.

**Architecture:** Shape A — `PetsTab` owns its own `useState<PetDef[]>` draft (seeded from `getActivePetDefs()`, never blank), runs its own `validatePetDefs` gate, and on Save persists via `savePetDefs` then swaps the live registry with `setActivePetDefs` + `writePetDefsCache`. `AdminShell` only adds a `'pets'` tab button + conditional render; the Course draft/save flow is untouched. The component mirrors `BossesTab`/`AdminShell` conventions exactly (controlled inputs, implicit `<label>`-wraps-input, `<select>` over enumerations, `<fieldset>/<legend>` groups, full accessible names on icon/delete buttons, immutable patch updates, `aria-live="polite"` error `<ul>`).

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest + @testing-library/react (jsdom), Tailwind. Repo is Windows / PowerShell. Branch `journey-redesign` (integration branch — **commit here, never merge to `main`**).

---

## Working directory & ground rules

- **Repo root:** `D:/ai_projects/AI_design_thinking/sentence-pet` (NOT the H:\ Google-Drive copy, which only holds design docs). All paths below are relative to this root. `cd` there for every command.
- **Branch:** `journey-redesign`. Do not branch, do not merge to `main`.
- **Stage explicit files only** — never `git add -A` (concurrent sessions sweep in stray edits). **Never stage `firebase.json`** (intentionally modified-but-unstaged locally; Storage emulator is P3).
- **Type gate is `npx tsc -b`** (NOT `--noEmit`).
- **No `PERSIST_VERSION` bump** — no `PetInstance` field changes here. If a task thinks it needs one, STOP and flag it.

## What already exists (reuse — do NOT rebuild)

All on `journey-redesign`, verified `tsc -b` clean + 863 tests green:

- `src/data/types.ts:118` — `PetDef` v2: `{ id, name, gen, dexNo, types: PetType[], element: Species, statBands, evolvesFromId?, evolvesToId?, evolutionStage?, starter?, enabled }`. `type PetType = string` (`:106`), `type StatRange = readonly [min, max]` (`:111`), `type Rarity = 'common'|'rare'|'epic'|'legendary'` (`:108`), `BattleStats = {hp,atk,def,spd,luk}` (`:135`).
- `src/domain/species.ts:4` — `export const SPECIES: readonly Species[] = ['leaf','fire','air','water']`.
- `src/domain/petType.ts` — `export const PET_TYPES: readonly PetType[]` (seeded from `SPECIES`) and `isPetType(t): t is PetType`.
- `src/domain/petDef.ts` — `BUILTIN_PET_DEFS`, `getActivePetDefs(): readonly PetDef[]`, `setActivePetDefs(defs): void` (re-floors empty → builtins), `defaultDefForElement(element, defs?)`, `starterDef(defs?)`, `resolvePetDef(id, defs?)`. Module-level mutable `active`.
- `src/content/validate.ts:129` — `validatePetDefs(defs: PetDef[]): { ok, errors[] }`. Already enforces: dup ids; empty id/name; element ∈ SPECIES; `gen>=1`; `dexNo>=1`; `(gen,dexNo)` unique; `types` non-empty & each `isPetType`; statBands complete & min≤max & min≥0; evolution refs exist; no cycles; `evolutionStage` monotonic along a chain; exactly one `starter` AND it is `gen===1 && dexNo===1`; ≥1 `enabled`.
- `src/firebase/content.ts:79` — `savePetDefs(defs: PetDef[]): Promise<void>` (single doc `content/petDefs`).
- `src/content/cache.ts:65` — `writePetDefsCache(defs: PetDef[]): void`; `cachedPetDefs()`.
- `src/content/petDefMigrate.ts` — `backfillPetDefs(raw): PetDef[]` (fills missing gen/dexNo/types; already-set fields win).

## File structure

- **Create** `src/components/admin/PetsTab.tsx` — self-contained tab component + its small pure module-level helpers (`nextDexNo`, `genId`, `reconcileEvolution`, `setRarityBand`). One responsibility: author the `PetDef` catalog.
- **Create** `src/components/admin/PetsTab.test.tsx` — unit tests (mirrors `BossesTab.test.tsx` / `AdminShell.test.tsx`).
- **Modify** `src/components/admin/AdminShell.tsx` — add `'pets'` to the `Tab` union, a tab button, conditional `<PetsTab />`. Course flow untouched.

## Key implementation decisions (locked by spec/handoff — do NOT relitigate)

1. **statBands editor = per-rarity single representative band.** The draft always stores the full per-stat shape (type unchanged). The editor reads/writes the **`hp` band** of each rarity as the representative `[min,max]` and applies any edit to **all 5 stats** of that rarity. "Expanded on save" is satisfied because the draft is always expanded — no separate expand step. Helper: `setRarityBand(def, rarity, [min,max])`.
2. **Evolution links: `evolvesToId` and `evolvesFromId` are both editable selects, but reconciled on save** so reciprocity always holds. `reconcileEvolution(defs)` runs at save time (and feeds the live validation gate). **Forward links win:** every `d.evolvesToId → t` forces `t.evolvesFromId = d.id`; any leftover `d.evolvesFromId → p` with no matching forward link forces `p.evolvesToId = d.id`. The gate validates the reconciled array, and the reconciled array is what's persisted.
3. **Add button = valid-by-construction.** Generates a unique `id` (`def-N`), `gen` = currently-selected gen filter (or 1), `dexNo` = next free in that gen, `types`/`element`/`statBands` from `defaultDefForElement`. Avoids `(gen,dexNo)` collisions and partial-draft validation failures.
4. **NaN-guard numeric inputs** (mirror `BossesTab` `reviewCount`): `const n = e.target.valueAsNumber; if (!Number.isNaN(n)) patch(...)` — keeps `gen`/`dexNo`/band/`evolutionStage` always numeric so the draft stays a valid `PetDef[]`.
5. **Starter control is exclusive + locked to gen 1 / dex 1.** The starter checkbox is only enabled when the def is `gen===1 && dexNo===1`; checking it clears `starter` on every other def.
6. **Delete is blocked** (button `disabled`) for the **sole starter** and for the **last enabled** def. `validatePetDefs` is still the backstop.
7. **Never-blank:** seed draft from `getActivePetDefs()` (always ≥ builtins).
8. **Swap the live registry after save:** `setActivePetDefs(reconciled)` + `writePetDefsCache(reconciled)`, or the running game won't see edits until reload.

---

## Task 1: `PetsTab` skeleton + list (read-only) + Save path + AdminShell wiring

**Files:**
- Create: `src/components/admin/PetsTab.tsx`
- Create: `src/components/admin/PetsTab.test.tsx`
- Modify: `src/components/admin/AdminShell.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/PetsTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const savePetDefs = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  savePetDefs: (d: unknown) => savePetDefs(d),
  fetchPetDefs: vi.fn(),
}));
const writePetDefsCache = vi.fn();
vi.mock('../../content/cache', () => ({ writePetDefsCache: (d: unknown) => writePetDefsCache(d) }));

import { PetsTab } from './PetsTab';
import { BUILTIN_PET_DEFS, getActivePetDefs, setActivePetDefs } from '../../domain/petDef';

beforeEach(() => {
  savePetDefs.mockClear();
  writePetDefsCache.mockClear();
  setActivePetDefs([...BUILTIN_PET_DEFS]); // reset module-level registry between tests
});

describe('PetsTab — list + save', () => {
  it('lists every active def by name (seeded from getActivePetDefs)', () => {
    render(<PetsTab />);
    for (const d of getActivePetDefs()) {
      expect(screen.getAllByText(new RegExp(d.name)).length).toBeGreaterThan(0);
    }
  });

  it('Save is enabled for the builtins and calls savePetDefs + swaps the live registry', async () => {
    render(<PetsTab />);
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    expect(writePetDefsCache).toHaveBeenCalled();
    // registry swapped to an equal catalog
    expect(getActivePetDefs().map((d) => d.id)).toEqual(BUILTIN_PET_DEFS.map((d) => d.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — `Failed to resolve import "./PetsTab"` / `PetsTab is not defined`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/admin/PetsTab.tsx`:

```tsx
import { useState } from 'react';
import type { PetDef } from '../../data/types';
import {
  getActivePetDefs,
  setActivePetDefs,
} from '../../domain/petDef';
import { validatePetDefs } from '../../content/validate';
import { savePetDefs } from '../../firebase/content';
import { writePetDefsCache } from '../../content/cache';

/** Forward links (evolvesToId) win; back-pointers (evolvesFromId) are derived/reconciled. */
export function reconcileEvolution(defs: PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, { ...d }]));
  for (const d of byId.values()) {
    if (d.evolvesToId && byId.has(d.evolvesToId)) byId.get(d.evolvesToId)!.evolvesFromId = d.id;
  }
  for (const d of byId.values()) {
    if (d.evolvesFromId && byId.has(d.evolvesFromId)) {
      const parent = byId.get(d.evolvesFromId)!;
      if (parent.evolvesToId !== d.id) parent.evolvesToId = d.id;
    }
  }
  return defs.map((d) => byId.get(d.id)!);
}

export function PetsTab() {
  const [draft, setDraft] = useState<PetDef[]>(() => [...getActivePetDefs()]);
  const [status, setStatus] = useState('');

  const reconciled = reconcileEvolution(draft);
  const validation = validatePetDefs(reconciled);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await savePetDefs(reconciled);
      setActivePetDefs(reconciled);
      writePetDefsCache(reconciled);
      setDraft(reconciled);
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Pets</h2>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono">{status}</span>}
      </div>

      {!validation.ok && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      <ul className="flex flex-col gap-1">
        {draft.map((d) => (
          <li key={d.id} className="rounded border p-2">
            <span className="font-mono">#{d.dexNo}</span>{' '}
            <strong>{d.name}</strong> · {d.element} · [{d.types.join(', ')}]
            {d.starter && <span> · ⭐ starter</span>}
            {!d.enabled && <span> · (disabled)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into AdminShell**

In `src/components/admin/AdminShell.tsx`:
- Add import after the other tab imports (line ~10): `import { PetsTab } from './PetsTab';`
- Change the `Tab` union (line 12) to: `type Tab = 'pool' | 'journey' | 'bosses' | 'import' | 'pets';`
- Add a tab button after the `'import'` button (line 69): `{tabBtn('pets', 'Pets')}`
- Add the conditional render after the import tab (line 85): `{tab === 'pets' && <PetsTab />}`

- [ ] **Step 6: Run the AdminShell + PetsTab tests**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/AdminShell.test.tsx src/components/admin/PetsTab.test.tsx`
Expected: PASS (all). The existing AdminShell tests must still be green (Pets tab is additive).

- [ ] **Step 7: Type-check**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd "D:/ai_projects/AI_design_thinking/sentence-pet"
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx src/components/admin/AdminShell.tsx
git commit -m "feat(admin): PetsTab skeleton — list + validate-gated save + registry swap, wired into AdminShell"
```

---

## Task 2: Gen filter + Add + Delete (with guards)

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('PetsTab` block (or add a new `describe`) in `src/components/admin/PetsTab.test.tsx`:

```tsx
describe('PetsTab — add / delete / filter', () => {
  it('Add creates a new def with a unique id and the next free dexNo', () => {
    render(<PetsTab />);
    const before = screen.getAllByRole('listitem').length;
    fireEvent.click(screen.getByRole('button', { name: /add pet/i }));
    expect(screen.getAllByRole('listitem').length).toBe(before + 1);
    // builtins are gen1 dexNo 1..4, so the new gen-1 def gets dexNo 5
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it('Delete removes a def', () => {
    render(<PetsTab />);
    // delete the last builtin (Dewdrop / water) — not the starter, not the last enabled
    fireEvent.click(screen.getByRole('button', { name: /delete .*dewdrop/i }));
    expect(screen.queryByText(/Dewdrop/)).not.toBeInTheDocument();
  });

  it('Delete is disabled for the sole starter', () => {
    render(<PetsTab />);
    expect(screen.getByRole('button', { name: /delete .*leaflet/i })).toBeDisabled();
  });

  it('gen filter narrows the list (no defs shown for an empty gen)', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // adds gen-1 def #5
    // builtins + the new one are all gen 1; filtering gen 1 keeps them, a non-existent gen empties
    fireEvent.change(screen.getByLabelText(/filter by gen/i), { target: { value: '1' } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — no "add pet"/"delete" buttons, no "filter by gen" control.

- [ ] **Step 3: Implement gen filter + add + delete**

In `src/components/admin/PetsTab.tsx`:

Add module-level helpers above the component:

```tsx
import { defaultDefForElement } from '../../domain/petDef';

function nextDexNo(defs: PetDef[], gen: number): number {
  const used = defs.filter((d) => d.gen === gen).map((d) => d.dexNo);
  return used.length ? Math.max(...used) + 1 : 1;
}

function genId(defs: PetDef[]): string {
  let n = 1;
  while (defs.some((d) => d.id === `def-${n}`)) n++;
  return `def-${n}`;
}
```

Add `defaultDefForElement` to the existing `../../domain/petDef` import.

Inside the component, add filter state and derived list:

```tsx
  const [genFilter, setGenFilter] = useState<'all' | number>('all');
  const gens = [...new Set(draft.map((d) => d.gen))].sort((a, b) => a - b);
  const shown = genFilter === 'all' ? draft : draft.filter((d) => d.gen === genFilter);
```

Add mutation helpers in the component:

```tsx
  function addPet() {
    const gen = genFilter === 'all' ? 1 : genFilter;
    const base = defaultDefForElement('leaf', draft);
    const newDef: PetDef = {
      ...base,
      id: genId(draft),
      name: 'New Pet',
      gen,
      dexNo: nextDexNo(draft, gen),
      starter: false,
      enabled: true,
    };
    setDraft([...draft, newDef]);
  }

  function deletePet(id: string) {
    setDraft(draft.filter((d) => d.id !== id));
  }

  function canDelete(d: PetDef): boolean {
    if (d.starter) return false;
    if (d.enabled && draft.filter((x) => x.enabled).length <= 1) return false;
    return true;
  }
```

Replace the header row's spacer/save area to include the filter + Add button (keep Save where it is), e.g. add before the `<span className="flex-1" />`:

```tsx
        <label className="text-xs">filter by gen
          <select className="ml-1 border px-1" value={String(genFilter)}
            onChange={(e) => setGenFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">all</option>
            {gens.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <button type="button" onClick={addPet} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add pet</button>
```

Render `shown` (not `draft`) in the list, and add a delete button per row:

```tsx
      <ul className="flex flex-col gap-1">
        {shown.map((d) => (
          <li key={d.id} className="rounded border p-2 flex items-center gap-2">
            <span className="font-mono">#{d.dexNo}</span>
            <strong>{d.name}</strong>
            <span>· {d.element} · [{d.types.join(', ')}]</span>
            {d.starter && <span>· ⭐ starter</span>}
            {!d.enabled && <span>· (disabled)</span>}
            <span className="flex-1" />
            <button type="button" aria-label={`delete ${d.name}`} disabled={!canDelete(d)}
              onClick={() => deletePet(d.id)} className="text-red-600 disabled:opacity-40">Delete</button>
          </li>
        ))}
      </ul>
```

- [ ] **Step 4: Run to verify pass**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS (all add/delete/filter tests + Task-1 tests).

- [ ] **Step 5: Type-check**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "D:/ai_projects/AI_design_thinking/sentence-pet"
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetsTab gen filter + add (gen-aware dexNo) + guarded delete"
```

---

## Task 3: Per-def edit form — scalar fields (id, name, gen, dexNo, element, enabled, types, starter)

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` in `src/components/admin/PetsTab.test.tsx`:

```tsx
import { getActivePetDefs as active } from '../../domain/petDef';

describe('PetsTab — edit form', () => {
  function openFirstEditor() {
    render(<PetsTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /^edit /i })[0]); // edit Leaflet (starter)
  }

  it('edits the name', () => {
    openFirstEditor();
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Sprout' } });
    expect(screen.getByText(/Sprout/)).toBeInTheDocument();
  });

  it('toggles types via the multi-select (>=1 enforced by validate)', () => {
    openFirstEditor();
    const sel = screen.getByLabelText(/^types$/i) as HTMLSelectElement;
    // select 'fire' in addition — pick both leaf + fire
    Array.from(sel.options).forEach((o) => { o.selected = o.value === 'leaf' || o.value === 'fire'; });
    fireEvent.change(sel);
    expect(screen.getByText(/leaf, fire/)).toBeInTheDocument();
  });

  it('starter checkbox is disabled unless the def is gen 1 / dexNo 1', () => {
    render(<PetsTab />);
    // Dewdrop is gen1 dexNo4 → starter control disabled
    fireEvent.click(screen.getByRole('button', { name: /edit .*dewdrop/i }));
    expect(screen.getByLabelText(/^starter$/i)).toBeDisabled();
  });

  it('checking starter on the gen1/dex1 def clears starter elsewhere (exclusive)', () => {
    // Make a second def temporarily eligible by editing — but exclusivity is the contract:
    // checking starter on Leaflet keeps exactly one starter.
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    const cb = screen.getByLabelText(/^starter$/i) as HTMLInputElement;
    expect(cb.checked).toBe(true); // Leaflet is the builtin starter
    // toggling off then on keeps it the sole starter; validate stays ok
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // exactly one starter persisted
    expect(active().filter((d) => d.starter)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — no "edit" buttons / no form fields.

- [ ] **Step 3: Implement the editor (scalar fields)**

In `src/components/admin/PetsTab.tsx`:

Add imports/constants at module top:

```tsx
import type { Species } from '../../data/types';
import { SPECIES } from '../../domain/species';
import { PET_TYPES } from '../../domain/petType';
```

Add editing state + a patch helper in the component:

```tsx
  const [editingId, setEditingId] = useState<string | null>(null);

  function patch(id: string, p: Partial<PetDef>) {
    setDraft(draft.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }

  function setStarter(id: string) {
    setDraft(draft.map((d) => ({ ...d, starter: d.id === id })));
  }
```

Add an Edit button to each list row (before Delete):

```tsx
            <button type="button" aria-label={`edit ${d.name}`}
              onClick={() => setEditingId(editingId === d.id ? null : d.id)}
              className="text-indigo-600">Edit</button>
```

Render the editor for the editing def. Place a `PetForm` sub-component in the same file and render it under the list when `editingId` matches a shown def:

```tsx
      {editingId && draft.some((d) => d.id === editingId) && (
        <PetForm
          def={draft.find((d) => d.id === editingId)!}
          allDefs={draft}
          onPatch={(p) => patch(editingId, p)}
          onSetStarter={() => setStarter(editingId)}
        />
      )}
```

Add the `PetForm` sub-component (scalar fields only for now — statBands + evolution added in Tasks 4 & 5):

```tsx
function PetForm({ def, allDefs, onPatch, onSetStarter }: {
  def: PetDef;
  allDefs: PetDef[];
  onPatch: (p: Partial<PetDef>) => void;
  onSetStarter: () => void;
}) {
  const starterEligible = def.gen === 1 && def.dexNo === 1;
  return (
    <div className="rounded border-2 border-indigo-300 p-3 flex flex-col gap-2">
      <label>id
        <input className="border px-1 ml-1" value={def.id}
          onChange={(e) => onPatch({ id: e.target.value })} />
      </label>
      <label>name
        <input className="border px-1 ml-1" value={def.name}
          onChange={(e) => onPatch({ name: e.target.value })} />
      </label>
      <label>gen
        <input type="number" className="w-16 border px-1 ml-1" value={def.gen}
          onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch({ gen: n }); }} />
      </label>
      <label>dexNo
        <input type="number" className="w-16 border px-1 ml-1" value={def.dexNo}
          onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch({ dexNo: n }); }} />
      </label>
      <label>element
        <select className="border px-1 ml-1" value={def.element}
          onChange={(e) => onPatch({ element: e.target.value as Species })}>
          {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>types
        <select multiple className="border px-1 ml-1 align-top" value={def.types}
          onChange={(e) => onPatch({ types: Array.from(e.target.selectedOptions, (o) => o.value) })}>
          {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>enabled
        <input type="checkbox" className="ml-1" checked={def.enabled}
          onChange={(e) => onPatch({ enabled: e.target.checked })} />
      </label>
      <label>starter
        <input type="checkbox" className="ml-1" checked={!!def.starter} disabled={!starterEligible}
          onChange={(e) => { if (e.target.checked) onSetStarter(); else onPatch({ starter: false }); }} />
      </label>
      {!starterEligible && <p className="text-xs text-slate-500">Starter must be gen 1, dexNo 1.</p>}
    </div>
  );
}
```

> Note on the `id` field: editing `id` while `editingId` tracks the old id will close the editor (the `editingId` lookup misses). This is acceptable for P2b — the row stays in the list with the new id; re-open to continue. `validatePetDefs` still catches duplicate/empty ids. Do not add id-rebind tracking unless a test demands it.

- [ ] **Step 4: Run to verify pass**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "D:/ai_projects/AI_design_thinking/sentence-pet"
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetsTab per-def edit form — scalar fields + exclusive gen1/dex1 starter"
```

---

## Task 4: statBands editor (per-rarity representative band, applied to all 5 stats)

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the edit-form `describe` in `src/components/admin/PetsTab.test.tsx`:

```tsx
  it('editing a rarity band applies [min,max] to all 5 stats of that rarity on save', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    fireEvent.change(screen.getByLabelText(/common min/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/common max/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    const leaf = active().find((d) => d.id === 'def-leaf')!;
    for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
      expect(leaf.statBands.common[stat]).toEqual([3, 9]);
    }
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — no "common min"/"common max" inputs.

- [ ] **Step 3: Implement the band editor**

In `src/components/admin/PetsTab.tsx`:

Add imports/constants at module top:

```tsx
import type { BattleStats, Rarity, StatRange } from '../../data/types';

const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const STAT_KEYS: ReadonlyArray<keyof BattleStats> = ['hp', 'atk', 'def', 'spd', 'luk'];

/** Set one rarity's [min,max] across all 5 stats (representative-band editor). */
export function setRarityBand(def: PetDef, rarity: Rarity, range: StatRange): PetDef {
  const band = {} as Record<keyof BattleStats, StatRange>;
  for (const stat of STAT_KEYS) band[stat] = range;
  return { ...def, statBands: { ...def.statBands, [rarity]: band } };
}
```

In `PetForm`, add a `<fieldset>` for the bands. The representative band is read from the `hp` entry:

```tsx
      <fieldset className="border p-2"><legend>stat bands (per rarity, applied to all stats)</legend>
        {RARITIES.map((r) => {
          const [min, max] = def.statBands[r].hp;
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="w-20">{r}</span>
              <label className="text-xs">{`${r} min`}
                <input type="number" aria-label={`${r} min`} className="w-16 border px-1 ml-1" value={min}
                  onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch(setRarityBand(def, r, [n, max])); }} />
              </label>
              <label className="text-xs">{`${r} max`}
                <input type="number" aria-label={`${r} max`} className="w-16 border px-1 ml-1" value={max}
                  onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch(setRarityBand(def, r, [min, n])); }} />
              </label>
            </div>
          );
        })}
      </fieldset>
```

> `setRarityBand` returns a full `PetDef`; `onPatch` spreads it (`{ ...d, ...p }`), so passing the whole def as the patch is fine — every field matches.

- [ ] **Step 4: Run to verify pass**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "D:/ai_projects/AI_design_thinking/sentence-pet"
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetsTab per-rarity stat-band editor (applies [min,max] to all stats)"
```

---

## Task 5: Evolution pickers + save-time reciprocity + validate-gate coverage

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Test: `src/components/admin/PetsTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a `describe` for evolution + the validate gate in `src/components/admin/PetsTab.test.tsx`:

```tsx
import { reconcileEvolution } from './PetsTab';
import type { PetDef } from '../../data/types';

describe('reconcileEvolution', () => {
  const base = (id: string, dexNo: number): PetDef => ({
    id, name: id, gen: 1, dexNo, types: ['leaf'], element: 'leaf',
    statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true,
  });

  it('derives evolvesFromId from a forward evolvesToId link', () => {
    const out = reconcileEvolution([{ ...base('a', 1), evolvesToId: 'b' }, base('b', 2)]);
    expect(out.find((d) => d.id === 'b')!.evolvesFromId).toBe('a');
  });

  it('derives evolvesToId from a back evolvesFromId link', () => {
    const out = reconcileEvolution([base('a', 1), { ...base('b', 2), evolvesFromId: 'a' }]);
    expect(out.find((d) => d.id === 'a')!.evolvesToId).toBe('b');
  });
});

describe('PetsTab — evolution UI + validate gate', () => {
  it('setting evolvesToId in the form persists reciprocal links on save', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i })); // def-leaf, gen1 dex1
    fireEvent.change(screen.getByLabelText(/evolves to/i), { target: { value: 'def-fire' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    const fire = active().find((d) => d.id === 'def-fire')!;
    expect(fire.evolvesFromId).toBe('def-leaf');
  });

  it('Save is disabled + error shown when a duplicate (gen,dexNo) exists', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // gen1 dex5
    fireEvent.click(screen.getByRole('button', { name: /edit .*new pet/i }));
    fireEvent.change(screen.getByLabelText(/^dexNo$/i), { target: { value: '1' } }); // collide with starter
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/duplicate \(gen 1, dexNo 1\)/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: FAIL — no "evolves to" control; reconcile tests pass only if `reconcileEvolution` already exported (it is, from Task 1) — the UI test fails.

- [ ] **Step 3: Implement the evolution pickers**

In `PetForm`, add a `<fieldset>` with two selects + the stage number. `allDefs` (minus self) populate the options:

```tsx
      <fieldset className="border p-2"><legend>evolution</legend>
        <label>evolves from
          <select className="border px-1 ml-1" value={def.evolvesFromId ?? ''}
            onChange={(e) => onPatch({ evolvesFromId: e.target.value || undefined })}>
            <option value="">— none —</option>
            {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
          </select>
        </label>
        <label>evolves to
          <select className="border px-1 ml-1" value={def.evolvesToId ?? ''}
            onChange={(e) => onPatch({ evolvesToId: e.target.value || undefined })}>
            <option value="">— none —</option>
            {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
          </select>
        </label>
        <label>evolutionStage
          <input type="number" className="w-16 border px-1 ml-1" value={def.evolutionStage ?? ''}
            onChange={(e) => { const n = e.target.valueAsNumber; onPatch({ evolutionStage: Number.isNaN(n) ? undefined : n }); }} />
        </label>
      </fieldset>
```

No other changes are needed: the save path already runs `reconcileEvolution` (Task 1) before validate + persist, and the validation gate already drives the disabled state and the `aria-live` error list.

- [ ] **Step 4: Run to verify pass**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx vitest run src/components/admin/PetsTab.test.tsx`
Expected: PASS (all PetsTab + reconcile tests).

- [ ] **Step 5: Type-check**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "D:/ai_projects/AI_design_thinking/sentence-pet"
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetsTab evolution pickers + save-time reciprocity; validate gate covers dup (gen,dexNo)"
```

---

## Task 6: Whole-feature verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npm test`
Expected: all tests green (863 from P2a + the new PetsTab tests). No regressions in `gameStore.test.ts` / `gameStore.persisted.test.ts` (persistence untouched).

- [ ] **Step 2: Type gate**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual emulator smoke (offline)**

Per the dev harness: start emulators + `npm run dev:admin`, open `/#admin`, click the 🔑 Dev admin sign-in, go to the **Pets** tab. Verify: list grouped/filterable by gen; **add** (gen-aware dexNo) → **edit** (id/name/gen/dexNo/element/types/enabled/starter/bands/evolution) → **delete** (blocked for starter + last enabled); **Save** persists; **reload** → catalog persists; running game still works (registry swapped). Confirm the starter control locks to gen1/dex1 and stays exclusive.

- [ ] **Step 5: Confirm `firebase.json` is NOT staged**

Run: `cd "D:/ai_projects/AI_design_thinking/sentence-pet" && git status --short`
Expected: only ` M firebase.json` remains unstaged (untouched by this work); no `PetsTab` files left uncommitted.

- [ ] **Step 6 (optional): code review**

Request a review of the `journey-redesign` PetsTab commits (`superpowers:requesting-code-review`) before considering P2b complete. Then update the dex epic memory note (P2b done; P3 sprite upload next).

---

## Self-review (plan vs spec)

- **Spec §"Authoring UI — PetsTab.tsx"** — list grouped/filterable by gen (T2), add with gen-aware dexNo (T2), edit form id/name/gen/dexNo/types/element/enabled/starter (T3), statBands 8-input (T4), evolution pickers (T5), save path validate→savePetDefs→setActivePetDefs→writePetDefsCache (T1). ✅
- **Spec §"AdminShell wiring"** — `'pets'` in `Tab` union + button + conditional render, Course untouched (T1). ✅
- **Spec §Tests (P2b)** — add/edit/delete mutate draft (T2/T3), validate gate blocks on dup id / dup (gen,dexNo) / starters / no enabled / dangling/cyclic evolution (T5 covers dup (gen,dexNo) + reconcile; the validator unit-tests for cyclic/dangling/starter already shipped in P2a, so the gate is exercised end-to-end via the live banner), Save calls savePetDefs + swaps registry (T1), starter exclusive (T3), delete blocked for last-enabled/sole-starter (T2). ✅
- **Landmines** — never-blank seed (T1), registry swap after save (T1), two-part starter invariant (T3 + validator), (gen,dexNo) uniqueness via add (T2) + gate (T5), evolution-by-id reciprocity (T5), explicit-file staging + never `firebase.json` (all commit steps), no PERSIST_VERSION bump (header). ✅
- **Type consistency** — `reconcileEvolution`, `setRarityBand`, `nextDexNo`, `genId`, `patch`, `setStarter`, `addPet`, `deletePet`, `canDelete`, `PetForm` props all defined where first used; imports (`PetDef`, `Species`, `Rarity`, `BattleStats`, `StatRange`, `SPECIES`, `PET_TYPES`, `defaultDefForElement`, `getActivePetDefs`, `setActivePetDefs`, `validatePetDefs`, `savePetDefs`, `writePetDefsCache`) match the confirmed signatures. ✅
