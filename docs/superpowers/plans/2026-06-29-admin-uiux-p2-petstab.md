# Admin UI/UX Redesign — Phase 2 (PetsTab deep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign PetsTab into a master-detail rail with the editor grouped into Identity / Stats / Evolution / Art Cards and its own pet-def `SaveBar`, decomposing the 387-line `PetsTab.tsx` into focused files — all behaviour, labels, roles, and the ~50 existing tests preserved.

**Architecture:** Decompose first (pure moves, tests stay green), then re-skin. Extract shared pure helpers to `petsTab/helpers.ts` (re-exported from `PetsTab.tsx` so test imports keep working), extract `SpriteUpload` and `PetForm` to `petsTab/` component files, then restructure `PetsTab` into a master-detail layout with `SaveBar` + `ValidationSummary`, group `PetForm` into Card sections using the P0/P1 primitive kit, and re-skin `SpriteUpload`.

**Tech Stack:** React + TypeScript, Tailwind v4, Vitest + Testing Library, Vite. Reuse `src/components/admin/ui/` primitives (`Card`, `SectionLabel`, `Field`, `TextInput`, `NumberInput`, `Select`, `Checkbox`, `Button`, `SaveBar`, `ValidationSummary`).

**Branch:** `admin-uiux` (do NOT branch fresh). **Repo:** `D:/ai_projects/AI_design_thinking/sentence-pet` (Windows / PowerShell). HEAD = `079ad9b`.

**Verify gate (after each task):** `npx vitest run` · `npx tsc -b` (NOT `--noEmit`) · `npx vite build`. Windows "Worker exited unexpectedly" flake → re-run.

---

## NON-NEGOTIABLE PRESERVE-LIST (every task must keep these — the ~50 tests in `PetsTab.test.tsx` assert them)

**Exports from `./PetsTab`** (test does `import { PetsTab, reconcileEvolution, stripDefault, setVariant, clearVariant } from './PetsTab'`): `PetsTab`, `reconcileEvolution`, `stripDefault`, `setVariant`, `clearVariant` must all remain importable from `src/components/admin/PetsTab.tsx` (re-export if moved). `setRarityBand` is also currently exported — keep it exported too.

**List structure:** pet rows are `<li>` inside a `<ul>` (`getAllByRole('listitem')` counts them: Add → +1, gen-1 filter → 5). Each row shows: `#{dexNo}`, the name, the element, `[{types.join(', ')}]`, `⭐ starter` / `(disabled)` markers. Row buttons: `aria-label={`edit ${name}`}` and `aria-label={`delete ${name}`}` (queried `/^edit /i`, `/edit .*leaflet/i`, `/delete .*dewdrop/i`, etc.). Delete uses `canDelete` (disabled for sole starter + last enabled). Editing toggles `editingId`; the form shows when a row is selected.

**Editor accessible names — keep EXACTLY** (queried via `getByLabelText` / `getByRole`):
`id`, `name`, `gen`, `dexNo`, `element`, `types`, `enabled`, `gacha obtainable`, `starter`, `common min`, `common max` (and rare/epic/legendary min/max), `evolves from`, `evolves to`, `evolutionStage`. Starter help text "Starter must be gen 1, dexNo 1." Validation error strings render verbatim (`duplicate (gen 1, dexNo 1)`, `evolution cycle`, etc. — they come from `validatePetDefs`, unchanged).

**Sprite slots — keep EXACTLY:** file-input accessible names `default sprite`, `baby happy sprite`, `baby sad sprite`, `young happy sprite`, … `adult sad sprite`; preview `alt={`${label} preview`}` (e.g. `default sprite preview`); Clear button `aria-label={`clear ${label}`}` (e.g. `clear default sprite`); upload calls `uploadSprite(defId, slot, file)` with slots `default`, `baby-happy`, … and `downscaleSprite(file)` is applied before upload. The `<label>` must wrap ONLY the file `<input>` (preview/Clear/status are siblings) so the accessible name stays exactly the slot label.

**Save/data behaviour (unchanged):** mount `useEffect` → `hydratePetDefs()` then re-seed draft + set `loaded` (block-until-live-load; loading text `loading pets…` with `role="status"`); `reconciled = reconcileEvolution(draft)`; `validatePetDefs(reconciled)`; `save()` → `savePetDefs(reconciled)` + `setActivePetDefs(reconciled)` + `writePetDefsCache(reconciled)` + `setDraft(reconciled)` + status `saved ✓` / `save failed: …`; rejection leaves the live registry reference untouched (no optimistic swap). Save disabled until `validation.ok`. `addPet`/`deletePet`/`canDelete`/`setStarter`/`rename`/`patch`/`genFilter`/`nextDexNo`/`genId` logic identical.

**Hazards:** Append to `PetsTab.test.tsx` — never overwrite (clobber hazard hit it before). Stage explicit files; never `git add -A`. No persist bump. Don't hand-edit `src/content/seed.ts`. `Field` wraps ONE control, never a `Checkbox`. `NumberInput.onValueChange` emits `null` on a cleared field — guard numeric patches.

---

## File Structure (target)

- **Create** `src/components/admin/petsTab/helpers.ts` — pure helpers + shared consts: `setRarityBand`, `stripDefault`, `setVariant`, `clearVariant`, `reconcileEvolution`, type `VariantStage`, consts `RARITIES`, `STAT_KEYS`, `VARIANT_STAGES`, `MOODS`.
- **Create** `src/components/admin/petsTab/SpriteUpload.tsx` — the `SpriteUpload` component (extracted, then re-skinned).
- **Create** `src/components/admin/petsTab/PetForm.tsx` — the `PetForm` component (extracted, then grouped into Card sections).
- **Modify** `src/components/admin/PetsTab.tsx` — becomes the shell: master-detail rail + detail panel + `SaveBar`/`ValidationSummary`; imports the extracted pieces; **re-exports** the pure helpers. Keeps `nextDexNo`/`genId` (internal) and all state/save logic.
- **Modify** `src/components/admin/PetsTab.test.tsx` — APPEND-only: one master-detail layout assertion (Task 3). Never edit existing tests.

---

## Task 1: Extract pure helpers to `petsTab/helpers.ts` (pure move — zero behaviour/UI change)

**Files:**
- Create: `src/components/admin/petsTab/helpers.ts`
- Modify: `src/components/admin/PetsTab.tsx`

- [ ] **Step 1: Create `src/components/admin/petsTab/helpers.ts`** with the helpers/consts/type moved verbatim from `PetsTab.tsx`:

```ts
import type { BattleStats, PetDef, PetMood, PetStage, Rarity, StatRange } from '../../../data/types';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const STAT_KEYS: ReadonlyArray<keyof BattleStats> = ['hp', 'atk', 'def', 'spd', 'luk'];
export type VariantStage = Exclude<PetStage, 'egg'>;
export const VARIANT_STAGES: readonly VariantStage[] = ['baby', 'young', 'adult'];
export const MOODS: readonly PetMood[] = ['happy', 'sad'];

/** Set one rarity's [min,max] across all 5 stats (representative-band editor). */
export function setRarityBand(def: PetDef, rarity: Rarity, range: StatRange): PetDef {
  const band = {} as Record<keyof BattleStats, StatRange>;
  for (const stat of STAT_KEYS) band[stat] = range;
  return { ...def, statBands: { ...def.statBands, [rarity]: band } };
}

/** Remove `default` from a sprite override; collapse to undefined when nothing remains. */
export function stripDefault(sprite: PetDef['sprite']): PetDef['sprite'] {
  if (!sprite) return undefined;
  const { default: _omit, ...rest } = sprite;
  const hasVariants = rest.variants && Object.keys(rest.variants).length > 0;
  return hasVariants ? rest : undefined;
}

/** Immutably set variants[stage][mood] = url, preserving default and other cells. */
export function setVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood, url: string): NonNullable<PetDef['sprite']> {
  const variants = { ...(sprite?.variants ?? {}) };
  variants[stage] = { ...(variants[stage] ?? {}), [mood]: url };
  return { ...sprite, variants };
}

/** Immutably remove variants[stage][mood]; drop an emptied stage; collapse empties (matches stripDefault). */
export function clearVariant(sprite: PetDef['sprite'], stage: VariantStage, mood: PetMood): PetDef['sprite'] {
  if (!sprite?.variants) return sprite;
  const variants = { ...sprite.variants };
  const stageMap = { ...(variants[stage] ?? {}) };
  delete stageMap[mood];
  if (Object.keys(stageMap).length) variants[stage] = stageMap;
  else delete variants[stage];
  const next: NonNullable<PetDef['sprite']> = { ...sprite };
  if (Object.keys(variants).length) next.variants = variants;
  else delete next.variants;
  if (!next.default && !next.variants) return undefined;
  return next;
}

/** Forward links (evolvesToId) win; back-pointers (evolvesFromId) are derived/reconciled. */
export function reconcileEvolution(defs: PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, { ...d }]));
  for (const d of byId.values()) {
    if (d.evolvesToId && byId.has(d.evolvesToId)) byId.get(d.evolvesToId)!.evolvesFromId = d.id;
  }
  // Second pass handles the reverse direction (a back-pointer with no matching forward
  // link sets the parent's forward link). validatePetDefs is the backstop for any
  // remaining multi-parent inconsistency the two passes can't reconcile.
  for (const d of byId.values()) {
    if (d.evolvesFromId && byId.has(d.evolvesFromId)) {
      const parent = byId.get(d.evolvesFromId)!;
      if (parent.evolvesToId !== d.id) parent.evolvesToId = d.id;
    }
  }
  return defs.map((d) => byId.get(d.id)!);
}
```

- [ ] **Step 2: Edit `PetsTab.tsx`** — remove the moved helper/const/type definitions (lines defining `RARITIES`, `STAT_KEYS`, `VARIANT_STAGES`, `MOODS`, `VariantStage`, `setRarityBand`, `stripDefault`, `setVariant`, `clearVariant`, `reconcileEvolution`). Add a re-export + import at the top so consumers and tests keep working:

```ts
import {
  RARITIES, STAT_KEYS, VARIANT_STAGES, MOODS,
  setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution,
  type VariantStage,
} from './petsTab/helpers';

// Re-exported so existing test imports (`import { … } from './PetsTab'`) keep resolving.
export { setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution };
```

Keep `nextDexNo` and `genId` in `PetsTab.tsx` (internal). Remove the now-unused `BattleStats`/`StatRange`/`PetStage`/`PetMood`/`Rarity` type imports from `PetsTab.tsx` if nothing else there uses them (let `tsc -b` tell you — fix until clean).

- [ ] **Step 3: Verify the gate** — `npx vitest run` (all ~50 PetsTab tests + suite green, esp. the `reconcileEvolution` / `stripDefault` / `setVariant` / `clearVariant` describe blocks that import from `./PetsTab`), then `npx tsc -b` clean, then `npx vite build`. Re-run vitest on a Windows worker flake.

- [ ] **Step 4: Commit**

```powershell
git add src/components/admin/petsTab/helpers.ts src/components/admin/PetsTab.tsx
git commit -m "refactor(admin): extract PetsTab pure helpers to petsTab/helpers"
```

---

## Task 2: Extract `SpriteUpload` and `PetForm` to `petsTab/` files (pure move — zero behaviour/UI change)

**Files:**
- Create: `src/components/admin/petsTab/SpriteUpload.tsx`
- Create: `src/components/admin/petsTab/PetForm.tsx`
- Modify: `src/components/admin/PetsTab.tsx`

- [ ] **Step 1: Create `src/components/admin/petsTab/SpriteUpload.tsx`** — move the existing `SpriteUpload` function verbatim (the version at `PetsTab.tsx:225-278`), with its own imports:

```ts
import { useState } from 'react';
import { uploadSprite, deleteSpriteByUrl, type SpriteSlot } from '../../../firebase/storage';
import { downscaleSprite } from '../../../firebase/imageTranscode';
```

Export it: `export function SpriteUpload({ … }) { … }` — body unchanged from the current file (do not alter behaviour, labels, alt text, or aria-labels in this task).

- [ ] **Step 2: Create `src/components/admin/petsTab/PetForm.tsx`** — move the existing `PetForm` function verbatim (`PetsTab.tsx:280-386`), with imports:

```ts
import type { PetDef, Species } from '../../../data/types';
import { SPECIES } from '../../../domain/species';
import { PET_TYPES } from '../../../domain/petType';
import { RARITIES, VARIANT_STAGES, MOODS, setRarityBand, stripDefault, setVariant, clearVariant } from './helpers';
import { SpriteUpload } from './SpriteUpload';
import type { SpriteSlot } from '../../../firebase/storage';
```

Export it: `export function PetForm({ … }) { … }` — body unchanged. Keep the `starterEligible` logic and the help text "Starter must be gen 1, dexNo 1." verbatim.

- [ ] **Step 3: Edit `PetsTab.tsx`** — delete the now-moved `SpriteUpload` and `PetForm` function bodies; import them instead:

```ts
import { PetForm } from './petsTab/PetForm';
```

(`SpriteUpload` is used only by `PetForm`, so `PetsTab.tsx` imports just `PetForm`.) Remove imports that are now only used by the moved code (`uploadSprite`/`deleteSpriteByUrl`/`SpriteSlot`/`downscaleSprite`/`SPECIES`/`PET_TYPES`/`Species` and the sprite-only types) — let `tsc -b` flag unused ones and clean them. The `<PetForm … />` call site in `PetsTab` stays identical.

- [ ] **Step 4: Verify the gate** — `npx vitest run` (all PetsTab tests green — the edit-form, sprite-upload, and orphan-cleanup describe blocks exercise the moved code), `npx tsc -b` clean, `npx vite build`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/petsTab/SpriteUpload.tsx src/components/admin/petsTab/PetForm.tsx src/components/admin/PetsTab.tsx
git commit -m "refactor(admin): extract SpriteUpload and PetForm to petsTab/"
```

---

## Task 3: Master-detail rail + pet-def SaveBar + ValidationSummary in `PetsTab.tsx`

**Files:**
- Modify: `src/components/admin/PetsTab.tsx`
- Modify: `src/components/admin/PetsTab.test.tsx`

Goal: lay the list out as a left rail and the editor as a right detail panel (matching JourneyTab's `flex gap-4` rail pattern), and replace the ad-hoc emerald Save + status + raw red `<ul>` with the shared `SaveBar` (pet-def domain) + `ValidationSummary`. All preserve-list items hold.

- [ ] **Step 1: APPEND a master-detail layout test** to `PetsTab.test.tsx` — add a new describe block at the end of the file (do NOT touch existing blocks):

```tsx
describe('PetsTab — master-detail layout', () => {
  it('renders the editor in a detail panel beside the list when a pet is selected', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    // selecting a pet via its row Edit button reveals the editor fields
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    // the list and the editor coexist (master + detail), so the row name and the name field are both present
    expect(screen.getAllByText(/Leaflet/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it — passes already or fails only on layout** — `npx vitest run src/components/admin/PetsTab.test.tsx`. (This test mostly documents intent; it should pass once the rail renders the form in the detail panel. If it passes against the current pre-rail layout too, that's fine — it's a guard for Step 3.)

- [ ] **Step 3: Restructure the `PetsTab` return** — replace ONLY the JSX returned by `PetsTab` (keep ALL hooks/handlers/`nextDexNo`/`genId`/re-exports above it byte-for-byte). New return:

```tsx
  if (!loaded) return <p role="status" className="p-4 text-sm">loading pets…</p>;

  const editing = editingId ? draft.find((d) => d.id === editingId) ?? null : null;

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">Pets</h2>
        <Field label="filter by gen">
          <Select value={String(genFilter)}
            onChange={(e) => setGenFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">all</option>
            {gens.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </Field>
        <Button onClick={addPet}>+ Add pet</Button>
        <span className="flex-1" />
        <SaveBar
          valid={validation.ok}
          status={status}
          onSave={save}
          errorCount={validation.errors.length}
        />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <div className="flex gap-4">
        <ul className="flex w-72 shrink-0 flex-col gap-1">
          {shown.map((d) => {
            const isActive = d.id === editingId;
            return (
              <li key={d.id}
                className={`flex items-center gap-2 rounded-md border p-2 ${isActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                <span className="font-mono text-slate-500">#{d.dexNo}</span>
                <strong>{d.name}</strong>
                <span className="text-slate-500">· {d.element} · [{d.types.join(', ')}]</span>
                {d.starter && <span>· ⭐ starter</span>}
                {!d.enabled && <span className="text-slate-400">· (disabled)</span>}
                <span className="flex-1" />
                <button type="button" aria-label={`edit ${d.name}`}
                  onClick={() => setEditingId(editingId === d.id ? null : d.id)}
                  className="text-indigo-600">Edit</button>
                <button type="button" aria-label={`delete ${d.name}`} disabled={!canDelete(d)}
                  onClick={() => deletePet(d.id)} className="text-red-600 disabled:opacity-40">Delete</button>
              </li>
            );
          })}
        </ul>

        <div className="flex-1">
          {editing
            ? <PetForm
                def={editing}
                allDefs={draft}
                onPatch={(p) => patch(editing.id, p)}
                onRename={(newId) => rename(editing.id, newId)}
                onSetStarter={() => setStarter(editing.id)}
              />
            : <Card><p className="text-slate-500">Select a pet to edit, or add a new one.</p></Card>}
        </div>
      </div>
    </div>
  );
```

Add the imports `PetsTab.tsx` now needs:

```ts
import { Card, Field, Select, Button, SaveBar, ValidationSummary } from './ui';
```

(Keep the `PetForm` import from Task 2.) The old `status` `<span>` and old red `<ul>` are gone (replaced by `SaveBar`'s status + `ValidationSummary`). The old `filter by gen` `<label><select>` becomes `Field` + `Select` (accessible name stays "filter by gen" — `getByLabelText(/filter by gen/i)` still matches). The `+ Add pet` button and Save move into the `SaveBar`/`Button`; `getByRole('button',{name:/add pet/i})` and `/^save$/i` still resolve (Button renders a real `<button>`; SaveBar's Save is labelled "Save").

- [ ] **Step 4: Verify the gate** — `npx vitest run` (whole suite green; pay attention to `getAllByRole('listitem')` counts, the gen-filter test, Save enable/disable, duplicate/cycle error text via ValidationSummary, and the new layout test), `npx tsc -b` clean, `npx vite build`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/PetsTab.tsx src/components/admin/PetsTab.test.tsx
git commit -m "feat(admin): PetsTab master-detail rail with shared SaveBar"
```

---

## Task 4: Group `PetForm` into Identity / Stats / Evolution / Art Cards (primitives, labels preserved)

**Files:**
- Modify: `src/components/admin/petsTab/PetForm.tsx`

Goal: replace the flat field stack with four `Card` + `SectionLabel` sections, swapping raw `<label>/<input>/<select>` for `Field` + `TextInput`/`NumberInput`/`Select` and self-labeling `Checkbox`. Every accessible name in the preserve-list stays identical.

Rules that keep the tests green:
- `Field label="name"` → the wrapped control's accessible name is `"name"`. Use Field for: `id`, `name`, `gen`, `dexNo`, `element`, `types`, `evolves from`, `evolves to`, `evolutionStage`, and each stat-band `"{rarity} min"` / `"{rarity} max"`.
- Checkboxes (`enabled`, `gacha obtainable`, `starter`) use `Checkbox` directly (NOT inside `Field` — nested-label rule). `Checkbox label="enabled"` → accessible name "enabled". `Checkbox label="gacha obtainable"` (drop the now-redundant explicit `aria-label`; the visible label provides the name). `Checkbox label="starter"` with `disabled={!starterEligible}`.
- `gen` / `dexNo` / `evolutionStage` / stat min-max use `NumberInput` with `onValueChange`: treat `null` (cleared field) as "no change" to match the old `Number.isNaN` guards — e.g. `onValueChange={(n) => { if (n !== null) onPatch({ gen: n }); }}`. For `evolutionStage` the old code set `undefined` on NaN/empty: `onValueChange={(n) => onPatch({ evolutionStage: n ?? undefined })}`.
- `types` stays a `<select multiple>` — wrap in `Field label="types"` and render the native multi-select (no MultiSelect primitive exists; keep `value={def.types}` + the `selectedOptions` onChange). Accessible name "types".
- The stat-band fieldset keeps `getByLabelText(/common min/i)` working: `Field label={`${r} min`}` + `NumberInput value={min} onValueChange={(n) => { if (n !== null) onPatch(setRarityBand(def, r, [n, max])); }}`. Same for max.
- Keep the help text `"Starter must be gen 1, dexNo 1."` when `!starterEligible`.
- The Art section renders the existing `SpriteUpload` calls unchanged in this task (Task 5 re-skins SpriteUpload itself).

- [ ] **Step 1: Rewrite `PetForm`'s return** into four Cards. Imports to add:

```ts
import { Card, SectionLabel, Field, TextInput, NumberInput, Select, Checkbox } from '../ui';
```

Structure (apply the rules above to every field — preserve each label string verbatim):

```tsx
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>Identity</SectionLabel>
        <div className="flex flex-col gap-2">
          <Field label="id"><TextInput value={def.id} onChange={(e) => onRename(e.target.value)} /></Field>
          <Field label="name"><TextInput value={def.name} onChange={(e) => onPatch({ name: e.target.value })} /></Field>
          <Field label="gen"><NumberInput value={def.gen} onValueChange={(n) => { if (n !== null) onPatch({ gen: n }); }} /></Field>
          <Field label="dexNo"><NumberInput value={def.dexNo} onValueChange={(n) => { if (n !== null) onPatch({ dexNo: n }); }} /></Field>
          <Field label="element">
            <Select value={def.element} onChange={(e) => onPatch({ element: e.target.value as Species })}>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="types">
            <Select multiple value={def.types}
              onChange={(e) => onPatch({ types: Array.from(e.target.selectedOptions, (o) => o.value) })}>
              {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Checkbox label="enabled" checked={def.enabled} onChange={(e) => onPatch({ enabled: e.target.checked })} />
          <Checkbox label="gacha obtainable" checked={def.gachaObtainable !== false}
            onChange={(e) => onPatch({ gachaObtainable: e.target.checked })} />
          <Checkbox label="starter" checked={!!def.starter} disabled={!starterEligible}
            onChange={(e) => { if (e.target.checked) onSetStarter(); else onPatch({ starter: false }); }} />
          {!starterEligible && <p className="text-xs text-slate-500">Starter must be gen 1, dexNo 1.</p>}
        </div>
      </Card>

      <Card>
        <SectionLabel>Stats</SectionLabel>
        <p className="mb-2 text-xs text-slate-500">stat bands (per rarity, applied to all stats)</p>
        <div className="flex flex-col gap-2">
          {RARITIES.map((r) => {
            const [min, max] = def.statBands[r].hp;
            return (
              <div key={r} className="flex items-end gap-2">
                <span className="w-20">{r}</span>
                <Field label={`${r} min`}>
                  <NumberInput value={min} min={0} step={1}
                    onValueChange={(n) => { if (n !== null) onPatch(setRarityBand(def, r, [n, max])); }} />
                </Field>
                <Field label={`${r} max`}>
                  <NumberInput value={max} min={0} step={1}
                    onValueChange={(n) => { if (n !== null) onPatch(setRarityBand(def, r, [min, n])); }} />
                </Field>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionLabel>Evolution</SectionLabel>
        <div className="flex flex-col gap-2">
          <Field label="evolves from">
            <Select value={def.evolvesFromId ?? ''} onChange={(e) => onPatch({ evolvesFromId: e.target.value || undefined })}>
              <option value="">— none —</option>
              {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </Select>
          </Field>
          <Field label="evolves to">
            <Select value={def.evolvesToId ?? ''} onChange={(e) => onPatch({ evolvesToId: e.target.value || undefined })}>
              <option value="">— none —</option>
              {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </Select>
          </Field>
          <Field label="evolutionStage">
            <NumberInput value={def.evolutionStage ?? ''} min={1} step={1}
              onValueChange={(n) => onPatch({ evolutionStage: n ?? undefined })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Art</SectionLabel>
        <div className="flex flex-col gap-2">
          <SpriteUpload label="default sprite" slot="default" defId={def.id} value={def.sprite?.default}
            onUpload={(url) => onPatch({ sprite: { ...def.sprite, default: url } })}
            onClear={() => onPatch({ sprite: stripDefault(def.sprite) })} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {VARIANT_STAGES.map((stage) => MOODS.map((mood) => (
              <SpriteUpload key={`${stage}-${mood}`} label={`${stage} ${mood} sprite`}
                slot={`${stage}-${mood}` as SpriteSlot} defId={def.id}
                value={def.sprite?.variants?.[stage]?.[mood]}
                onUpload={(url) => onPatch({ sprite: setVariant(def.sprite, stage, mood, url) })}
                onClear={() => onPatch({ sprite: clearVariant(def.sprite, stage, mood) })} />
            )))}
          </div>
        </div>
      </Card>
    </div>
  );
```

Keep the `starterEligible` const (`def.gen === 1 && def.dexNo === 1`) and the `PetForm` prop signature unchanged.

- [ ] **Step 2: Verify the gate** — `npx vitest run` (whole suite; especially: `edits the name`, `toggles types` → `leaf, fire`, `starter` disabled, `editing the id`, `common min/max` band edit, `gacha obtainable` checkbox, evolution from/to, duplicate/cycle gates), `npx tsc -b` clean, `npx vite build`. If any `getByLabelText` fails, a label string drifted — fix it to match the preserve-list exactly.

- [ ] **Step 3: Commit**

```powershell
git add src/components/admin/petsTab/PetForm.tsx
git commit -m "feat(admin): group PetForm into Identity/Stats/Evolution/Art cards"
```

---

## Task 5: Re-skin `SpriteUpload` with primitives (labels/alt/aria preserved)

**Files:**
- Modify: `src/components/admin/petsTab/SpriteUpload.tsx`

Goal: apply the neutral-SaaS look (Button for Clear, tidy file row, preview frame) without changing any accessible name, alt text, aria-label, or behaviour. The `<label>` must still wrap ONLY the file `<input>`.

Rules that keep the tests green:
- File input accessible name stays the slot label: `<label className="text-xs"><span>{label}</span><input type="file" … /></label>` (label wraps only the input). `getByLabelText(/^default sprite$/i)` etc. must still match — do not add extra text inside the `<label>`.
- Preview `<img alt={`${label} preview`} … onError=…>` unchanged (keep the `visibility:hidden` onError fallback).
- Clear button → `Button variant="danger"` (or keep a text button) but KEEP `aria-label={`clear ${label}`}` exactly. `getByRole('button',{name:/clear default sprite/i})` must resolve.
- Keep the `busy`/`err` state, `deleteOrphan` best-effort cleanup, `downscaleSprite(file)` before `uploadSprite`, the same-url-no-delete guard, the input-value reset on change (`e.currentTarget.value = ''`) so retry-with-same-file works, and the `aria-live` status span.

- [ ] **Step 1: Rewrite `SpriteUpload`'s return** (logic/handlers unchanged — only markup/classes). Add `import { Button } from '../ui';`. Example target markup:

```tsx
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-700">
        <span>{label}</span>
        <input type="file" accept="image/*" className="w-40 text-xs" aria-invalid={!!err || undefined}
          onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) pick(f); }} />
      </label>
      {value && (
        <>
          <img src={value} alt={`${label} preview`} className="h-10 w-10 rounded border border-slate-200 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <Button variant="danger" aria-label={`clear ${label}`} onClick={clear} className="px-2 py-0.5 text-xs">Clear</Button>
        </>
      )}
      <span aria-live="polite" className="text-xs text-slate-600">{busy ? 'uploading…' : err ? `⚠ ${err}` : ''}</span>
    </div>
  );
```

Keep the `pick`, `clear`, and `deleteOrphan` functions and the `busy`/`err` `useState` exactly as they are.

- [ ] **Step 2: Verify the gate** — `npx vitest run` (the whole `PetsTab — sprite upload` and `orphan-sprite cleanup` describe blocks: upload default/variant, preview alt, clear, retry-same-file, error surfacing, downscale, delete-on-replace, best-effort delete failure), `npx tsc -b` clean, `npx vite build`.

- [ ] **Step 3: Commit**

```powershell
git add src/components/admin/petsTab/SpriteUpload.tsx
git commit -m "feat(admin): re-skin SpriteUpload with primitive styling"
```

---

## Self-Review

**Spec coverage (P2 scope from spec §Phase plan + handoff):**
1. Master–detail rail (list left, form right) → Task 3. ✅
2. Group `PetForm` into Identity / Stats / Evolution / Art Cards → Task 4. ✅
3. Re-skin `SpriteUpload` → Task 5. ✅
4. PetsTab's own pet-def `SaveBar` (+ `ValidationSummary`) → Task 3 (separate from the course SaveBar; no persistence merge). ✅
5. Decompose `PetsTab.tsx` → Tasks 1–2 (`helpers.ts`, `SpriteUpload.tsx`, `PetForm.tsx`; helpers re-exported). ✅

**Behaviour/test preservation:** every task ends on the full green gate; the PRESERVE-LIST enumerates every label/role/alt/aria/`<li>` the ~50 tests assert; test file is append-only (one new block in Task 3). ✅

**Token scope:** reuses existing admin-scoped primitives; no `@theme`, no global palette change, no persist bump. ✅

**Type consistency:** `VariantStage`, `setRarityBand`/`stripDefault`/`setVariant`/`clearVariant`/`reconcileEvolution` signatures defined in Task 1 (`helpers.ts`) are imported unchanged by Tasks 2/4; `SpriteSlot` type from `firebase/storage` used consistently; `PetForm`/`SpriteUpload` prop shapes unchanged from the original. ✅

**Risk guardrails:** decompose-before-reskin isolates the risky moves (Tasks 1–2 are behaviour-neutral); the post-save registry swap and block-until-live-load logic are explicitly listed as untouched (re-verify per spec §Risks). ✅
