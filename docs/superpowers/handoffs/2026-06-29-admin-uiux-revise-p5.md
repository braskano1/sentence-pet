# Handoff — Admin UI/UX Revise, Phase 5 (per-surface ImportDrawer + polish, then promote the epic to main)

**Date:** 2026-06-29
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`.
**Branch:** continue on **`admin-uiux-revise`** (the epic INTEGRATION branch — do NOT branch off main). P1–P4 are all stacked here; the WHOLE epic merges to main as one release at the END of P5. Tip after P4 = `ea4aecf`; the line is ~30+ commits ahead of main `d96a4ac`.

## Where P4 left off (done, reviewed, SHIP)
Phase 4 migrated **BossesTab** and **JourneyTab** from checkbox walls to the searchable master-detail pattern, and added two kit pieces. Plan: `docs/superpowers/plans/2026-06-29-admin-uiux-revise-p4.md`. 8 commits `a06278a`→`ea4aecf`. **Gates green: `tsc -b` clean, full `vitest run` = 1135 passed / 18 skipped, `vite build` succeeds.** Every task was two-stage reviewed (spec + code-quality); final whole-phase Opus review = **SHIP**.

What shipped:
- **`src/components/admin/ui/AssignList.tsx`** (new kit) — a controlled searchable multi-select (`role="checkbox"` rows + internal query). Props: `items, getKey, isSelected, onToggle, renderLabel, searchText, ariaLabel (REQUIRED), placeholder?, emptyHint?, headerNote?`. Replaces checkbox walls.
- **`src/components/admin/journeyTab/LessonTree.tsx`** (new) — a two-level units→lessons navigator. Exports `LessonTree` + the `TreeSelection` type (`{ type:'unit'|'lesson'; id }`). Search + All/Checkpoints `FilterChips` + `+ Unit` + `+ Add lesson` footer; unit headers and lesson rows are both selectable buttons; empty state + filtered count badge.
- **`BossesTab.tsx`** — `SearchableList` of `[...gates, finalBoss?]` + scope chips (All/Gated/Final) + content-searchable pins via `AssignList` + in-detail confirm-delete (gated only). finalBoss synth/enforce and all aria-labels preserved.
- **`JourneyTab.tsx`** — "Option A" master-detail: `LessonTree` left; detail is a **unit editor** (Title/Emoji/Order/L1/delete) when a unit is selected, a **lesson editor** (Kind/Drill/Level/Checkpoint/items-via-AssignList/delete) when a lesson is selected. NEW: add/delete Unit + add/delete Lesson. `eligibleItemIds` kept + exported.

Both tabs stay `{ course, onChange }` course surfaces — the shell's course SaveBar is theirs (no second SaveBar). User approved "Option A" (selectable unit headers) over inline-edit on 2026-06-29; comparison visual at `temp/admin-mockup/journey-options.png`.

## Phase 5 scope
1. **Per-surface `ImportDrawer` + `mergeById` + delete the standalone `ImportTab.tsx`.** This is the big one. The approved mockup (`temp/admin-mockup/index.html`, click "Import…" on the Items/Bosses/Journey toolbars) shows a right-side drawer with: file drop, an additive merge preview (New / Updated / Unchanged counts), a per-row change list, and an "Apply N changes" CTA — **additive** (adds new + updates matches by id; never deletes existing). Build `mergeById` (pure, TDD it hard), wire an `ImportDrawer` opened from each surface toolbar, and remove the old whole-file `ImportTab`. The current `CoursesTab` "New from file…" path (whole-course xlsx) stays; this is per-surface additive import of items/bosses/units.
2. **Polish (fold the P4 review carry-forwards in here):**
   - **`AssignList.headerNote` is dead API** — neither call site passes it. Either drop the prop, or route both the Journey assigned-count (currently a sibling `<p>` in `JourneyTab.tsx`) and a new Bosses pins-count through `headerNote` for consistency. Pick one.
   - **Add/delete Unit + Lesson are NEW in P4 but only indirectly tested** (LessonTree fires the callbacks; no JourneyTab test asserts `course.units` actually gains/loses a unit/lesson). Add direct handler coverage.
   - Row keyboard nav (roving arrow keys) in `SearchableList`/`LessonTree`; `CourseSwitcher`/`AdminRail` option arrow-nav + Enter/Space; `<code>` id badge → `<span>` (deferred since P1/P2).
   - Empty states for each surface; color discipline; **no em-dashes in NEW UI copy** (existing `"— none —"` selects are house-consistent, leave them).
3. **Per-row inactive-course counts** (deferred since P2): `CoursesTab` rows can't show pool/unit counts for INACTIVE courses without a fetch. If tackled, fetch lazily; else re-defer.

## Other deferred / pre-existing (fold in if convenient)
- `AdminShell.tsx:99` `ValidationSummary` still renders on the Pets/non-course surfaces — if the active course is invalid it shows course errors above PetsTab with no course SaveBar to act on. Hide on `surface === 'pets'` (and arguably scope per-surface).
- `addItem`/`addPet`/`addGate`/`addLesson`/`addUnit` select a row that an active search query may hide until cleared. Minor; clear the query on add if it bothers.
- `CoursesTab.tsx:43-46` swallows xlsx import parse/read errors silently (P2 deferral). Surface them when you build the ImportDrawer.
- BossesTab/PoolTab: selecting a row then changing the filter chip leaves the detail open but no list row highlighted (consistent-by-design with the whole kit; only fix if it bothers).
- `eligibleItemIds` (`JourneyTab.tsx`) is now only retained as module API (editor filters inline) — candidate for removal/relocation if nothing else consumes it.

## After P5: promote the epic
Once P5 is green, **promote the whole `admin-uiux-revise` line to main as one release** (`--no-ff` merge like the prior admin-uiux line db614d1), verify green on main, push, delete the branch. See memory [[admin-uiux-revise-epic]].

## Process for the fresh session
1. Read [[admin-uiux-revise-epic]] memory + open the mockup (`temp/admin-mockup/index.html`, Import drawer). Confirm `admin-uiux-revise` (`git status -sb`).
2. `impeccable` if iterating the drawer visuals; then `superpowers:writing-plans` to flesh P5 into bite-sized TDD tasks (read `ImportTab.tsx`, `content/excelImport.ts`, `CoursesTab.tsx`, and the kit first). Save as `docs/superpowers/plans/2026-07-0X-admin-uiux-revise-p5.md`.
3. Execute `superpowers:subagent-driven-development` (fresh subagent per task, spec + code-quality review each; final whole-phase review). Per-task gates: `npx vitest run <file>`, `npx tsc -b` (NOT `--noEmit`), `npx vite build` before the final commit.

## Hazards (carry forward)
- Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool cwd resolves wrong on this machine; it resets after each command). `tsc -b` not `--noEmit`. Windows vitest "Worker exited unexpectedly" → re-run.
- Stage explicit files; never `git add -A`. **Adjust** `*.test.tsx`; never clobber an existing test body.
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`.
- `SendMessage` is unavailable in this harness — dispatch a fresh agent per task/fix (the controller re-curates context each time).
- Kit facts: native `onChange` on inputs; `NumberInput` also has `onValueChange:(n|null)`; `Button` variants primary/danger/ghost; `Field` wraps a `<label>` (visible text queryable via `getByText`); `SearchableList`/`LessonTree` rows are `<button aria-current>` selected by content; `AssignList` rows are `<button role="checkbox" aria-checked>` whose name = `ariaLabel(item)` (REQUIRED prop).
