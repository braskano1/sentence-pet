# Handoff — Admin UI/UX Revise, Phase 3 (Pets → SearchableList + reconcile the SaveBar story)

**Date:** 2026-06-30
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`.
**Branch:** continue on **`admin-uiux-revise`** (the epic INTEGRATION branch — do NOT branch off main; P3–P5 keep stacking on it, the whole epic merges to main at the end). Currently the P1 + P2 line ahead of main `d96a4ac`.

## Where P2 left off (done, reviewed, green)
Phase 2 shipped the full-width shell + grouped rail + header course switcher + new Courses surface. See memory [[admin-uiux-revise-epic]] and the P2 plan `docs/superpowers/plans/2026-06-30-admin-uiux-revise-p2.md`. All 8 tasks two-stage reviewed, final whole-phase Opus review passed after one fix. **165 admin tests + full suite 1123 green, `tsc -b` + `vite build` clean.** P2 commits: `a7a57a3` → `9fe0851`.

New pieces now available to reuse:
- `src/firebase/content.ts` → `deleteCourse(id)` (blocks deleting the last course).
- `src/components/admin/coursesTab/courseCounts.ts` → `courseCounts(course)` → `{ units, lessons, items, bosses }` (single source for all count displays).
- `src/components/admin/coursesTab/newCourse.ts` → `makeCourseId(title, existingIds)` + `emptyCourse(meta)`.
- `src/components/admin/ui/AdminRail.tsx` — grouped vertical nav, `role=tablist`/`tab` roving Up/Down. `RailGroup<T>`/`RailItem<T>` types. Exported from the `ui` barrel.
- `src/components/admin/ui/CourseSwitcher.tsx` — header listbox popover (Escape/backdrop close). Exported.
- `src/components/admin/useCoursesAdmin.ts` — hook owning `index`/`activeCourseId` + `refresh`/`switchTo`/`create`/`remove`. Single instance lives in the shell.
- `src/components/admin/CoursesTab.tsx` — reference master-detail surface (SearchableList + meta editor + Contents stat cards + delete-confirm + new-from-file xlsx).
- `src/components/admin/AdminShell.tsx` — rewritten: full-width `max-w-7xl`, no wrapping `<Card>`, AdminHeader + (CourseSwitcher + SaveBar) rows + AdminRail + active surface. Owns the active-course `draft` (resyncs on course-id change via `useEffect([liveId])`), `dirty = draft !== liveCourse`, `runAction()` surfaces async-action errors, refreshes the index after save/import.

P1 kit (from before): `SearchableList` (generic controlled master-list), `FilterChips` (`role=group` `aria-pressed` toggles), `SectionLabel`. PoolTab is the reference SearchableList composition; CoursesTab is the second.

## Design (approved via mockup — lead with it)
Interactive mockup: **`temp/admin-mockup/index.html`** (open in browser; click Courses / Items / Journey / Bosses). Screenshots `temp/admin-mockup/view-*.png`. Build to it. Use the `impeccable` skill if you iterate visuals further.

Locked decisions (full list in [[admin-uiux-revise-epic]]):
- One pattern ×5 surfaces: searchable/filterable list → detail editor → **per-surface SaveBar** (`dirty` + "Save changes").
- No nested cards; full-width shell (already done in P2).

## Phase 3 scope (what to build)
Convert the Pets surface to the kit pattern AND resolve the SaveBar seam that P2 exposed.

### 1. Migrate `PetsTab` list → `SearchableList` + `FilterChips`
`src/components/admin/PetsTab.tsx` currently hand-rolls its master list: a `<ul>` of manual rows (`#dexNo`, name, element, types, starter/disabled badges, Edit/Delete buttons) + a gen-filter `<Select>` + an `+ Add pet` button, with its own `editingId` state. Replace with the kit:
- `SearchableList<PetDef>`: `getKey={d => d.id}`, `selectedKey={editingId}`, `onSelect={setEditingId}`, `searchText={d => `${d.name} ${d.id} ${d.element} ${d.types.join(' ')}`}`, `countNoun="pet"`, content-first `renderRow` (dexNo + name + element/types + starter ⭐ / disabled badges). Caller still owns `query` + `editingId` state.
- Replace the gen `<Select>` with a `FilterChips` `filterSlot` (chip per gen + an "all" chip), keeping `genFilter` state. Pass the gen-filtered list as `items` and the unfiltered length as `total` (same contract PoolTab uses).
- Footer: `+ Add pet` (move it into the SearchableList `footer`). Delete stays in the detail editor or as a row affordance — see how PoolTab/CoursesTab handle destructive actions (CoursesTab uses a delete-with-confirm in the detail panel; prefer that over a row Delete button for consistency, but keep the existing `canDelete` guard: can't delete a starter or the last enabled pet).
- Keep ALL existing Pets behaviour intact: `reconcileEvolution` → `validatePetDefs` → `save()` (savePetDefs + setActivePetDefs + writePetDefsCache), the mount-time `hydratePetDefs()` live-reseed + `loaded` gate, `addPet`/`deletePet`/`rename`/`setStarter`/`patch`, `PetForm` detail editor. Many Pets tests assert specific labels/aria (`edit ${name}`, `delete ${name}`, `loading pets…`, gen filter) — ADJUST those tests to the new structure, never clobber test bodies.

### 2. Reconcile the per-surface SaveBar (the P2 seam)
P2 put ONE global SaveBar in the shell header that saves the active **course draft**. But Pets are **global** (`getActivePetDefs`/`savePetDefs`), NOT part of the course draft — PetsTab has always carried its OWN SaveBar (`PetsTab.tsx:129`). So on the Pets surface the shell currently shows a course-scoped SaveBar (dirty dot / "Save changes") that does nothing for pets, while PetsTab renders a second SaveBar. Confusing double-SaveBar. Decide and implement ONE of:
  - **(A, recommended)** The shell's header SaveBar is **course-scoped**: render it only for the course surfaces (`pool`/`journey`/`bosses`) and the Courses meta surface; HIDE it on the global Pets surface, which keeps its own SaveBar. Cleanest "per-surface SaveBar" reading.
  - (B) Lift a per-surface SaveBar abstraction so every surface (incl. Pets) declares its own dirty/valid/save and the shell renders the active surface's bar in a consistent slot. More work; only do this if the mockup demands a single fixed bar position.
  Lead with the mockup + `impeccable`; pick A unless the visuals say otherwise. Whichever you pick, there must be exactly ONE visible SaveBar per surface and it must act on that surface's data.

### 3. (If A) thread a `petCount`/surface-kind signal so the rail/header stay correct
Minor: the rail's Pets count already uses `getActivePetDefs().length` (computed in the shell). If you hide the course SaveBar on Pets, make sure the shell still renders cleanly (no empty header row jumpiness).

## Key APIs (confirmed, P2)
```ts
// src/domain/petDef.ts
getActivePetDefs(): PetDef[]
setActivePetDefs(defs: PetDef[]): void
defaultDefForElement(element, defs): PetDef
// src/firebase/content.ts
savePetDefs(defs: PetDef[]): Promise<void>     // overwrites the whole catalog doc
fetchPetDefs(): Promise<PetDef[] | null>
// src/content/load.ts        hydratePetDefs(): Promise<void>  (never rejects; reseeds registry)
// src/content/validate.ts    validatePetDefs(defs): { ok, errors }
// src/content/cache.ts       writePetDefsCache(defs): void
// src/components/admin/petsTab/helpers.ts  reconcileEvolution, setRarityBand, stripDefault, setVariant, clearVariant
// src/components/admin/ui  SearchableList, FilterChips (FilterChip type), SaveBar (valid/dirty/status/onSave/saveLabel/errorCount), SectionLabel
```

## Process for the fresh session
1. Read [[admin-uiux-revise-epic]] memory + open the mockup. Confirm you're on `admin-uiux-revise` (`git status -sb`).
2. `impeccable` if iterating visuals (esp. the SaveBar decision); then `superpowers:writing-plans` to flesh P3 into bite-sized TDD tasks (read `PetsTab.tsx` + its tests + `PetForm` + `SearchableList`/`FilterChips` first). Save as `docs/superpowers/plans/2026-07-0X-admin-uiux-revise-p3.md`.
3. Execute `superpowers:subagent-driven-development` (fresh subagent per task, spec + code-quality review each; final whole-phase review). Per-task gates: `npx vitest run <file>`, `npx tsc -b` (NOT `--noEmit`), and `npx vite build` before the final commit.

## Hazards (carry forward)
- Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool cwd resolves wrong). `tsc -b` not `--noEmit`. Windows vitest "Worker exited unexpectedly" → re-run.
- Stage explicit files; never `git add -A`. **Append**/adjust `*.test.tsx`; never clobber existing test bodies (Pets has a large, label-sensitive suite + `petsTab/PetForm.test.tsx`).
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`. No em-dashes in UI copy.
- `SendMessage` tool is unavailable in this harness — dispatch a fresh agent per task rather than continuing one.
- `TextInput`/inputs use NATIVE event `onChange` (`(e) => …e.target.value`); `Button` has a `danger` variant; `Field` wraps its child in a `<label>`.

## Deferred items carried from P1/P2 (fold in when convenient, or P5)
- **`saveCourse` reorders the saved course to the END of `coursesIndex`** (`content.ts:52` appends) — now user-visible in the switcher/list after a save+refresh. Preserve position (map-in-place) when touched. (Minor.)
- `CoursesTab.onCreate` prop type is narrowed to `{ title }` though `create`/`emptyCourse` accept `{ title, emoji? }` — widen if create-with-emoji is wanted. (Cosmetic.)
- `CourseSwitcher` / `AdminRail` keyboard polish: option roving-arrow nav + Enter/Space on listbox options; `<code>` id badge → `<span>`. (P5 polish.)
- CoursesTab: per-row counts for INACTIVE courses (index has no pool/units → needs a fetch). (P4+.)
- `useCoursesAdmin.remove` active-course-delete fallback branch has no test. (Coverage.)

## Remaining roadmap after P3
P4 Bosses + Journey → master-detail (kill the checkbox walls); per-row inactive-course counts. P5 `mergeById` + per-surface additive `ImportDrawer` + delete the standalone `ImportTab.tsx` file + polish (row keyboard nav, switcher option arrow-nav, empty states, color discipline, no em-dashes).
