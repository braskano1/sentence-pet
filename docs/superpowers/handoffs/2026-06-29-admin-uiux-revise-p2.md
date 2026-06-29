# Handoff — Admin UI/UX Revise, Phase 2 (shell + rail + course switcher + Courses surface)

**Date:** 2026-06-29
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`.
**Branch:** continue on **`admin-uiux-revise`** (the epic integration branch — do NOT branch off main; P2–P5 stack on it, whole epic merges to main at the end). Currently 5 P1 commits ahead of main `d96a4ac`.

## Where P1 left off (done, reviewed, green)
Phase 1 shipped the searchable-list foundation + migrated the Items/Pool surface. See memory [[admin-uiux-revise-epic]] and the P1 plan `docs/superpowers/plans/2026-06-29-admin-uiux-revise-p1.md`. New kit available to reuse:
- `src/components/admin/ui/SearchableList.tsx` — generic controlled master-list (search + `filterSlot` + "N of M" count + rows + empty state + `footer`). Caller owns `query`/`selected` state, supplies `searchText(item)` + `renderRow(item, selected)`, passes already-chip-filtered `items` + pre-filter `total`. Exported from the `ui` barrel.
- `src/components/admin/ui/FilterChips.tsx` — `role=group` of `aria-pressed` toggle chips. Exported.
- `src/components/admin/poolTab/itemLabel.ts` — `itemLabel`/`itemSearchText` (pattern for deriving a label + search haystack; mirror this for courses/bosses/pets).
- `src/components/admin/PoolTab.tsx` — reference example of composing all of the above.

142 admin tests green, `tsc -b` + `vite build` clean.

## Design (approved via mockup — lead with it)
Interactive mockup: **`temp/admin-mockup/index.html`** (open in browser; click Courses / Items / Journey / Bosses / the `⬇ Import…` button). Screenshots `temp/admin-mockup/view-*.png`. This IS the approved target — build to it. Use the `impeccable` skill if you iterate visuals further.

Locked decisions (full list in [[admin-uiux-revise-epic]]):
- IA + rail groups: **`Workspace → Courses`** · **`Course · <active title> → Items / Journey / Bosses`** · **`Creatures · global → Pets`**.
- Header **course switcher** (shows active course; switching changes the editing context). "One course at a time."
- Every surface: searchable list → detail editor → **per-surface SaveBar** (`dirty` + Save changes). SaveBar already supports `dirty` prop.
- Import is per-surface additive (P5). Whole-course xlsx import becomes the Courses surface's **"New from file"** (relocate `ImportTab`'s parse logic there; remove the standalone Import top-tab).
- No nested cards; full-width shell (drop `max-w-4xl` + the single wrapping `<Card>` in AdminShell).

## Phase 2 scope (what to build)
Establish the shell + course dimension so later phases scope to a selected course.

1. **`AdminRail`** (new, `src/components/admin/ui/` or `admin/`) — left vertical nav. Grouped (Workspace / Course·<title> / Creatures·global), per-item counts, active state, accessible (the existing `Tabs.tsx` roving-arrow pattern is a good a11y reference). Replaces the horizontal `Tabs` in the shell. Keep `Tabs.tsx` in the kit (may still be used elsewhere; check before removing).
2. **`CourseSwitcher`** (new) — header control listing `fetchCoursesIndex()` entries, shows the active one, selecting one loads it (`fetchCourse(id)` → store `setCourse`). Escape-dismiss, keyboard-navigable; avoid the `overflow:hidden` dropdown-clipping trap (use fixed/portal/`<dialog>`).
3. **Courses data wiring** — a small admin hook or store additions for: list courses, switch active (sets `activeCourseId`, loads the course), create course, **delete course**. NOTE: `firebase/content.ts` has `fetchCoursesIndex()`, `fetchCourse(id)`, `saveCourse(course)` (upserts the index entry atomically) but **no `deleteCourse` — add one** (delete `content/courses/{id}/doc` + remove its `coursesIndex` entry; block deleting the last/active course or pick a sensible fallback). Pets are global (`getActivePetDefs`), NOT course-scoped — leave them alone.
4. **`CoursesTab`** (new surface) — master-detail via `SearchableList`: list courses (emoji + title + counts, active badged), `+ New course`, `⬇ New from file…` (whole-course xlsx → relocate `ImportTab` parse/commit here), meta editor (title/emoji/id — id read-only on existing), contents summary (units/lessons/items/bosses), delete-with-confirm. Per-surface SaveBar for meta edits.
5. **Rewrite `AdminShell.tsx`** — full-width container; remove the single wrapping `<Card>` (kills nested-card hazard); compose header (AdminHeader + CourseSwitcher) + AdminRail + active surface; remove the `import` top tab from nav. Existing surfaces (PoolTab/JourneyTab/BossesTab/PetsTab) render unchanged into the new frame for now (their master-detail conversions are P4).

## Key APIs (confirmed)
```ts
// src/firebase/content.ts
fetchCoursesIndex(): Promise<CourseIndexEntry[]>           // [{ id, title, emoji?, l1Ready? }]
fetchCourse(id: string): Promise<Course | null>
saveCourse(course: Course): Promise<void>                 // writes course doc + upserts index entry (batch)
// deleteCourse(id): Promise<void>  ← ADD in P2
// content/migrate.ts: DEFAULT_COURSE_ID

// src/content/store.ts (useContentStore)
course: Course | null
activeCourseId: string | null
bundle  // resolved view, kept in sync by setCourse
setCourse(course: Course, status: ContentStatus): void    // sets course + activeCourseId + bundle
// firstCourse = cachedCourse() ?? SEED_COURSE
```
`Course = { id, title, emoji?, pool, units, gates, finalBoss? }`. Items live in the course's own `pool`; bosses attach to the course; pets are global.

## Process for the fresh session
1. Read [[admin-uiux-revise-epic]] memory + open the mockup. Confirm you're on `admin-uiux-revise`.
2. `impeccable` if iterating visuals; then `superpowers:writing-plans` to flesh these 5 P2 items into bite-sized TDD tasks (read `AdminShell.tsx` + `content/store.ts` + `firebase/content.ts` first — the shell rewrite + store wiring need fresh-context grounding). Save as `docs/superpowers/plans/2026-06-30-admin-uiux-revise-p2.md`.
3. Execute `superpowers:subagent-driven-development` (fresh subagent per task, spec + code-quality review each). All gates per task: `npx vitest run <file>`, `npx tsc -b` (NOT `--noEmit`), and `npx vite build` before the final commit.

## Hazards (carry forward)
- Bash with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (PowerShell tool cwd resolves wrong). `tsc -b` not `--noEmit`. Windows vitest "Worker exited unexpectedly" → re-run.
- Stage explicit files; never `git add -A`. **Append**/adjust `*.test.tsx`; never clobber existing test bodies.
- Admin tokens stay scoped to `.admin-root` in `src/index.css`; never global `@theme`.
- Many admin tests assert specific labels/fields; a shell/nav restructure will need test updates (adjust, don't clobber). Keep the suite green.
- `SendMessage` tool is unavailable in this harness — dispatch a fresh agent per task rather than continuing one.

## Remaining roadmap after P2
P3 Pets→SearchableList + unify per-surface SaveBar. P4 Bosses + Journey → master-detail (kill the checkbox walls). P5 `mergeById` + `ImportDrawer` per-surface additive import + delete standalone Import tab + polish (row keyboard nav, `aria-current={selected||undefined}`, empty-pool edge tests, countNoun, color discipline, empty states, no em-dashes).
