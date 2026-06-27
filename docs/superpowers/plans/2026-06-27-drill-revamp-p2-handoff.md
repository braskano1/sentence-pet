# Handoff — Drill Revamp P2 (new activity types + L1 toggle + admin)

**Date:** 2026-06-27
**Branch:** `journey-redesign` (P1 committed + pushed; NOT merged to main — promote the whole line as one release later)
**Spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md`
**P1 plan (done):** `docs/superpowers/plans/2026-06-27-drill-revamp-p1-foundation.md`

## P1 status: COMPLETE ✅

9 tasks, subagent-driven, two-stage reviewed, final whole-phase review = **SHIP**. 731 tests pass, build clean (no warnings). Commits `0a2f4ec..46b1683`.

What P1 delivered (foundation, drag-drop parity — players see NO change):
- Types: `ContentKind` (`flashcard|matching|dragdrop|fillblank|boss`); optional `Lesson.kind`, `Unit.l1Enabled`; `DrillItem.hidePos?`; `'pickCourse'` screen — `src/data/types.ts`, `src/content/model.ts`.
- `Course` / `BossNode` (scopes checkpoint|gated|final, reuses `CheckpointBoss`) / `CourseIndexEntry` + `activeBundle`/`courseUnits` — `src/content/course.ts`.
- `bundleToDefaultCourse` legacy→Course migration (`DEFAULT_COURSE_ID='default'`) — `src/content/migrate.ts`.
- Pure cache primitives (broke the store↔load cycle) — `src/content/cache.ts`. Course-aware store exposes `bundle` (back-compat) + `setBundle` shim — `src/content/store.ts`. `cachedCourse`/`hydrateCourse`/`loadCoursesIndex` — `src/content/load.ts`.
- `validateCourse` (kind-aware, structural + boss-ref checks); `validateContent` behavior unchanged — `src/content/validate.ts`.
- Per-course Firestore: `content/courses/{id}/doc` + `content/coursesIndex`, legacy two-doc fallback, `saveCourse` strips `undefined` — `src/firebase/content.ts`. **No `firestore.rules` change needed** — `match /content/{doc=**}` already covers the new paths.
- gameStore `currentCourseId` + `selectCourse` (static `hydrateCourse` import); `CourseSelect` screen; kind-routed `screenKeyAndNode` (dragdrop→DrillScreen, boss→map guard, others→`ComingSoon`) — `src/state/gameStore.ts`, `src/components/{CourseSelect,ComingSoon}.tsx`, `src/App.tsx`. `main.tsx` hydrates `'default'` course.

## OPEN DECISION (resolve early in P2) — course-select entry

Nothing navigates the player TO `'pickCourse'` yet. `CourseSelect` is wired + routable but dormant. Pick one:
- **Always**: journey entry (PetRoom Play ▶) routes to `pickCourse` → `selectCourse(id)` → `pickDrill` map.
- **Only when >1 course**: auto-enter the single default course (zero UX change today; surfaces select once a 2nd course exists). ← likely the gentler default.

Wire point: wherever Play ▶ sets `screen` today (PetRoom → currently `pickDrill`). `selectCourse` already routes to `pickDrill` after setting `currentCourseId`.

## P2 SCOPE (write a fresh plan via writing-plans)

Build the 4 new activity screens + grading + L1 toggle + admin authoring. Per-task subagent-driven.

1. **Item model fields per kind** — extend the pool item shape. P1 kept the pool as legacy `DrillItem` (dragdrop). P2 must introduce the discriminated `ContentItem` union from the spec (FlashcardItem/MatchingItem/DragDropItem/FillBlankItem with `l1?`, per-pair `l1` for matching, `template/answer/alternates` for fillblank, `front/back/audio` for flashcard). Decide: widen `pool` to `Record<string, ContentItem>` and migrate `validateItem` to switch on `kind` (the P1 `validateItem` has a deferral comment marking exactly where).
2. **Player screens** (route by `kind` — the `ComingSoon` branch in `screenKeyAndNode` is the seam):
   - Flashcard: flip front/back, 🔊 audio, self-grade Again/Got-it. **Practice = completion-based, no star penalty.** Speaking/pronounce = RESERVED (field stub only).
   - Matching: drag prompt tiles into empty target slots; per-pair Thai; wrong pairs clear keep-correct. Image fields RESERVED.
   - Drag-drop: reuse `DrillScreen`; add `hidePos` difficulty (hide POS label/tint in slots).
   - Fill-blank: typed input, **strict exact (trimmed)** match + optional `alternates`; escalating hints L1→first-letter→length→reveal.
3. **L1 TH/ENG toggle** — `unit.l1Enabled` gates it. Toggle in unit header (default) + per content screen (override). UI store state, persisted per user. Show Thai iff `l1Enabled && toggle==='TH' && item.l1` (or `pair.l1`). Display-only, never affects grading.
4. **Food/scoring/XP** — extend `src/data/food.ts` `DRILL_FOOD` + `src/domain/scoring.ts` for the 4 kinds (handoff limits #6, #7). Bosses reuse boss rewards.
5. **Admin** — item editor switches form by `kind` (flashcard/matching/fillblank get real forms; dragdrop + `hidePos` checkbox; traps stay JSON); journey tab assigns kind+level+item-count per node; unit `l1Enabled` checkbox — `src/components/admin/*`.

## P3 SCOPE (later, own plan)

Gated boss (multi-unit review, sample N + pinned) + final boss (course complete → unlock next course) wired to existing boss-battle feature; admin boss-config forms; **Excel bulk import** (preview-then-commit, `xlsx`/SheetJS); enforce `finalBoss` present in `validateCourse`; regenerate `seed.ts` with kind-tagged content.

## Carried cleanups (low priority, from final review)
- Dead live-path code: `hydrateContent` (load.ts) + `fetchContent` (content.ts) now have zero production callers (kept for `load.test.ts`). Remove when retiring the legacy cache test, or `@deprecated`.
- Cache-key change (`sentence-pet-content` → `sentence-pet-course:default`): returning users get a one-frame SEED flash before `hydrateCourse` resolves. Cosmetic, self-correcting.

## Landmines (carried)
- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged — don't stage it.
- `src/content/seed.ts` is generated — regenerate via admin export + `seed:export`, not by hand.
- Boss battle is an existing feature — reuse its config/flow.
- `.superpowers/` (brainstorm mockups) is gitignored.

## How to run / test
- `npm run dev` (free port 5173+), play as guest → PetRoom → Play ▶. `npm test` (731 pass). `npm run build` (clean).
- Admin: `<dev-url>/#admin`, sign in as admin (custom claim).
