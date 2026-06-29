# Handoff — Admin UI/UX Revise, Phase 4 (Bosses + Journey → master-detail; kill the checkbox walls)

**Date:** 2026-06-29
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`.
**Branch:** continue on **`admin-uiux-revise`** (the epic INTEGRATION branch — do NOT branch off main; P4 + P5 keep stacking on it, the whole epic merges to main at the END). Currently the P1+P2+P3 line ahead of main `d96a4ac`, tip `ba62aea`.

## Where P3 left off (done, reviewed, green)
Phase 3 migrated the Pets surface to the kit and fixed the double-SaveBar seam. See memory [[admin-uiux-revise-epic]] and plan `docs/superpowers/plans/2026-06-29-admin-uiux-revise-p3.md`. 4 commits `7c75a05`→`ba62aea`. **166 admin + 1125 full green, `tsc -b` + `vite build` clean.** Each task two-stage reviewed; final Opus whole-phase review = Ship.

What shipped:
- `PetsTab.tsx` now composes `SearchableList<PetDef>` + `FilterChips` (gen) + footer `+ Add pet`, content-first rows, detail-panel confirm-delete (CoursesTab pattern) guarded by `canDelete`. `addPet` auto-selects; `deletePet` clears selection on self-delete; `confirming` resets on `editingId` change; `genChips` memoized on `gens`.
- `AdminShell.tsx`: the course SaveBar is hidden on the global Pets surface (`surface !== 'pets'`); CourseSwitcher + spacer stay. One SaveBar per surface, each acting on its own data.

## The pattern to apply (now proven across 3 surfaces)
PoolTab (items), CoursesTab (courses), and PetsTab (pets) are all the SAME composition — build Bosses and Journey to match:
- `SearchableList<T>` (left): `items` already filtered, `total` = pre-filter count, `getKey`, `selectedKey`, `onSelect`, controlled `query`/`onQuery`, `searchText`, content-first `renderRow` (id demoted), optional `filterSlot` (`FilterChips`), `footer` (the `+ New` button), `countNoun`.
- Detail editor (right, `flex-1`); destructive actions live in the detail panel behind a confirm (CoursesTab), not as row buttons.
- The surface edits the course `draft` via `onChange` (BossesTab/JourneyTab already take `{ course, onChange }` like PoolTab). The shell's course SaveBar saves it — do NOT add a second SaveBar on these (they're course surfaces, the shell bar is theirs).

Read first: `src/components/admin/PoolTab.tsx` (cleanest reference), `src/components/admin/CoursesTab.tsx` (confirm-delete in detail), `src/components/admin/ui/{SearchableList,FilterChips}.tsx`, then the current `src/components/admin/BossesTab.tsx` + `JourneyTab.tsx` and their `*.test.tsx` (label-sensitive — adjust, never clobber).

## Phase 4 scope
1. **BossesTab → master-detail.** Replace the current checkbox-wall UI with `SearchableList` of bosses (search by name/id/scope; maybe a `FilterChips` for scope unit/final) + a detail editor for the selected boss; delete-with-confirm in the panel. Keep ALL boss behaviour: `validateCourse` cross-refs (rewardPetDefId, reviewsUnitIds), finalBoss synth/enforce, xlsx-imported columns, the boss tier/element/rivalSprite fields.
2. **JourneyTab → master-detail.** Same: searchable list of units (and/or lessons) replacing the checkbox walls; detail editor for the selected unit/lesson; confirm-delete. Keep lesson↔item assignment, checkpoint flags, gates, ordering. Journey is the densest surface — consider a two-level list (units → lessons) or a unit list + lesson sub-editor; lead with the mockup.
3. **Per-row inactive-course counts** (deferred from P2): the course index has no pool/units for INACTIVE courses, so CoursesTab rows can't show counts without a fetch. If you tackle it, fetch lazily; otherwise re-defer to P5.

## Design (lead with the mockup)
Interactive mockup: **`temp/admin-mockup/index.html`** (untracked working-tree dir; open in browser — click Journey / Bosses). Screenshots `temp/admin-mockup/view-bosses.png`, `view-journey.png`. Build to it. Use the `impeccable` skill if you iterate visuals (Journey especially — the two-level density is the hard part).

## Process for the fresh session
1. Read [[admin-uiux-revise-epic]] memory + open the mockup. Confirm `admin-uiux-revise` (`git status -sb`).
2. `impeccable` if iterating visuals; then `superpowers:writing-plans` to flesh P4 into bite-sized TDD tasks (read BossesTab/JourneyTab + their tests + PoolTab first). Save as `docs/superpowers/plans/2026-07-0X-admin-uiux-revise-p4.md`.
3. Execute `superpowers:subagent-driven-development` (fresh subagent per task, spec + code-quality review each; final whole-phase review). Per-task gates: `npx vitest run <file>`, `npx tsc -b` (NOT `--noEmit`), `npx vite build` before the final commit.

## Hazards (carry forward)
- Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool cwd resolves wrong). `tsc -b` not `--noEmit`. Windows vitest "Worker exited unexpectedly" → re-run.
- Stage explicit files; never `git add -A`. **Adjust** `*.test.tsx`; never clobber existing test bodies (Bosses/Journey have label-sensitive suites).
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`. No em-dashes in UI copy.
- `SendMessage` tool is unavailable in this harness — dispatch a fresh agent per task rather than continuing one.
- `TextInput`/inputs use NATIVE event `onChange` (`(e) => …e.target.value`); `Button` has a `danger`/`ghost` variant; `Field` wraps its child in a `<label>`; `SearchableList` rows are a single `<button aria-current>` whose accessible name is the rendered row text (select tests by content, not an `edit`/`delete` aria-label).

## Deferred items (fold in when convenient, or P5)
- **Shell course `ValidationSummary` (`AdminShell.tsx:99`) still renders on the Pets surface** — if the active course is invalid it shows course errors above PetsTab with no course SaveBar to act on (pre-existing; silent when course valid). Consider hiding it on `surface === 'pets'` too, or scoping ValidationSummary per-surface.
- `addPet` (and PoolTab `addItem`) with an active search query selects a row that the query hides until cleared. Minor; clear the query on add if it bothers.
- From P1/P2: `saveCourse` reorders the saved course to the END of `coursesIndex` (`content.ts` appends) — preserve position when touched. `CoursesTab.onCreate` type narrowed to `{ title }` though create accepts `{ title, emoji? }`. CourseSwitcher/AdminRail keyboard polish (option roving-arrow + Enter/Space; `<code>` id badge → `<span>`). `useCoursesAdmin.remove` active-delete fallback branch untested.

## Remaining roadmap after P4
P5 = per-surface additive `ImportDrawer` + `mergeById` + delete the standalone `ImportTab.tsx` file + polish (row keyboard nav, switcher option arrow-nav, empty states, color discipline, no em-dashes). Then promote the whole epic line to main (one release).
