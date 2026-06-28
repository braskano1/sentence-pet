# Handoff — Drill Revamp P3b (admin boss forms + Excel import + seed regen + finalBoss enforcement)

## ✅ P3b COMPLETE (2026-06-28)

16 commits on `journey-redesign`, `270c21e..340d616`. **819 tests pass | 13 skipped**, `tsc -b` clean, `npm run build` clean. Plan: `docs/superpowers/plans/2026-06-28-drill-revamp-p3b.md`; spec: `docs/superpowers/specs/2026-06-28-drill-revamp-p3b-design.md`. Executed subagent-driven (impl + spec review + code-quality review per task).

What shipped:
- **Course-based admin (keystone):** `AdminShell` drafts a `Course` (`validateCourse` + `saveCourse` + `setCourse`); `PoolTab`/`JourneyTab` retargeted to `course.pool`/`course.units`; new **Bosses tab** (`BossesTab.tsx`) authors gated + final bosses; new **Import tab** (`ImportTab.tsx`).
- **Excel import:** `xlsx` dep + pure `parseWorkbookToCourse` (`src/content/excelImport.ts`, hardened: dup-id / cross-unit-node / blank-gated-afterUnit errors) → `validateCourse` → preview-then-commit → persists via `saveCourse` + syncs draft.
- **Seed regen:** `SEED_COURSE` moved into `seed.ts`; Course-shaped `dist-seed/course.json` export; `seedCourse.ts` deleted; store fallback repointed.
- **finalBoss enforcement:** `bundleToDefaultCourse` synthesizes a default finalBoss; `validateCourse` enforces finalBoss-presence + rejects duplicate gate `afterUnitId`.

Final whole-impl review (opus) caught + fixed one real integration defect: import was live-only (no `saveCourse`), lost on reload — fixed in `340d616`.

**Smoke test: RUN + PASS** (against local emulators, automated). Harness kept: `e2e/p3b-smoke.spec.ts` (opt-in, `RUN_P3B_SMOKE=1`) + `scripts/p3b-smoke-setup.mjs` (seeds an emulator admin user + xlsx fixtures); `dist-smoke/` (screenshots) gitignored. Verified end-to-end: admin sign-in (custom claim) → Bosses tab authors a gate → Save → the gate round-trips through the Firestore emulator and appears as `boss-unit:gate-1` in the player's hydrated bundle; Excel import previews a valid workbook + commits, and blocks an invalid one (`missing required sheet`) with Commit disabled.

> **⚠️ Finding (follow-up, not a P3b regression):** the admin tool does NOT self-hydrate from Firestore — `main.tsx:21-23` runs `hydrateCourse('default')` only on *player* entry. So in a **cold browser** (empty localStorage, no prior player visit) opening `/#admin` after a save shows the `SEED_COURSE` fallback, not the just-saved course (the Firestore write itself is correct — proven via the player app). The "admin saves → reload → persists" expectation holds for the *player*, not the admin view on a cold cache. Cheap fix when convenient: call `hydrateCourse` on admin entry too, or write the course cache in `AdminShell.save()`.

**Still pending (deferred, not in P3b):** deterministic boss sampling (seed RNG by course id); unify duplicate Fisher–Yates (`review.ts` vs `check.ts`); flashcard speaking + matching images (parent-spec "Reserved"). **Manual offline smoke not yet run** (see "How to run / test" below) — needs a human at the dev server with an admin claim. Draft PR #33 stays DRAFT until the whole drill-revamp line ships.

---


**Date:** 2026-06-28
**Branch:** `journey-redesign` (integration branch — do NOT merge to main; promote the whole drill-revamp line as one release later)
**Spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md` (§3.2 bosses, §6 admin, §7 course completion, §8 Excel import, §9 validate)
**Source of truth:** `docs/superpowers/plans/2026-06-28-drill-revamp-p3a-boss-runtime.md` (P3a plan) + this handoff.

## P3a status: COMPLETE ✅

11 commits, `fd79034..ff16f07`, on `journey-redesign`. 803 tests pass, build clean.

What P3a delivered (the boss-tier runtime is fully playable):

- **`src/content/review.ts`** — pure `sampleReviewItems(course, node, rng)`: pinned-first dragdrop, sampled from `reviewsUnitIds` units' lesson itemIds, capped at `reviewCount`. Fisher–Yates via injected RNG.
- **`src/content/journey.ts`** — pure `resolveCourseBundle(course, rng)` expands a `Course` into a `ContentBundle` with synthetic single-checkpoint boss units. Gated bosses spliced after their `afterUnitId` (order +0.5); final boss appended at maxOrder+1. Lesson id = node id (journey stars + completion key by node). `BOSS_UNIT_PREFIX='boss-unit:'`.
- **`Lesson.onClear?: 'completeCourse'`** added to `src/content/model.ts`.
- **`src/content/seedCourse.ts`** — `SEED_COURSE: Course` = `bundleToDefaultCourse(SEED)` + ONE example gated boss (after `u2-next-steps`, reviews u1+u2, `reviewCount:5`) + final boss (reviews all 3 units, `onClear:'completeCourse'`, `reviewCount:6`). **Hand-authored stopgap** — P3b replaces it with a proper course seed.
- **`src/content/store.ts`** — fallback is now `SEED_COURSE`; `bundle = resolveCourseBundle(course, Math.random)` on every `setCourse`.
- **`src/state/gameStore.ts`** — persisted `courseComplete: Record<string,boolean>` (PERSIST_VERSION 14→15, full multi-point change: GameState, freshState, PersistedState Pick, selectPersisted, migrate backfill, cloud-sync fixtures). `finishBoss` sets `courseComplete[currentCourseId]=true` when the cleared lesson carries `onClear==='completeCourse'`.
- **`src/domain/courseLock.ts`** — pure `isCourseLocked(index, i, complete)`; `CourseSelect` locks a course until its predecessor is in `courseComplete`.
- **`src/content/validate.ts`** — non-breaking structural gate/final checks (gated: `scope`+`afterUnitId`+known-unit; final: `scope`+`onClear`; both: `reviewsUnitIds` non-empty, `reviewCount>=1` if defined). `finalBoss`-PRESENCE is NOT enforced (deferred — see below).

How to run: `npm run dev` → guest → PetRoom → Play ▶ → Beginner course → clear units. The ⚔️ Midway Review gate appears after Next Steps and locks Challenge; the 👑 Grand Finale appears last and completes the course (persists across reload). `npm test` (803), `npm run build`.

> **QA caveat (live vs fallback):** the P3a example bosses live only on `SEED_COURSE` (the offline/un-migrated fallback). `hydrateCourse('default')` will REPLACE it with the live Firestore default course, which has gates `[]` and no finalBoss (from `bundleToDefaultCourse`) — so an **online** install shows NO bosses until P3b regenerates the seed and persists gates/finalBoss to Firestore. When smoke-testing P3a bosses, run offline / against a fresh install, or this reads as "bosses missing" when it is the intended fallback semantics.

## P3b SCOPE (write a fresh plan via writing-plans)

### 1. Admin boss-config forms

Configure checkpoint/gated/final bosses in the admin UI (`JourneyTab`, or a new Bosses tab if it gets heavy).

- Today: `Lesson.boss?: CheckpointBoss` is editable in `JourneyTab` for checkpoint lessons.
- **Not today:** `Course.gates[]` (gated bosses) and `Course.finalBoss` (final boss) have NO admin editor. Admins cannot author or edit these without hand-editing Firestore.
- **P3b adds:** forms to create/edit/delete gated bosses (`afterUnitId`, `reviewsUnitIds` multi-select, `reviewCount`, `pinnedItemIds`, boss config) and the final boss (same minus `afterUnitId`, plus enforces `onClear:'completeCourse'`). Saving calls the existing course-persist path.
- The existing checkpoint boss editor in `JourneyTab` is the closest UI to model after.

### 2. Excel bulk import (spec §8)

`xlsx`/SheetJS; parse a workbook into a `Course`; validate before any save.

- **Sheets:** Course (metadata), Units, Items (pool), Bosses (gates + final).
- **Flow:** upload xlsx → parse → run `validateCourse` → **preview-then-commit**: display the parsed course structure + all validation errors before saving; if any error exists, nothing is saved; report malformed rows with sheet name + row number.
- **`xlsx` is NOT yet a dependency** — add it.
- **No file-upload UI exists** to model after — build from scratch; a simple `<input type="file" accept=".xlsx">` in AdminShell (or a new Import tab) is fine.
- The preview step should show unit titles, item counts, boss configuration, and any errors prominently.

### 3. Seed regen + remove `seedCourse.ts`

P3a hand-authored `SEED_COURSE` is a stopgap. P3b replaces it:

- **Admin export** (`seed:export` → `scripts/export-seed.ts` → `dist-seed/content.json`) currently writes the `ContentBundle` (`SEED` const). P3b likely needs to export a **course-shaped** JSON instead (pool + units + gates + finalBoss), not just the bundle, because `SEED` (a `ContentBundle`) cannot carry `gates`/`finalBoss`.
- **Workflow:** author the example bosses in the admin UI (task 1 above) → export → regenerate `src/content/seed.ts` (or a companion `src/content/seedCourse.ts` shape) from the export → update `store.ts` fallback → delete the hand-authored `src/content/seedCourse.ts`.
- **Clarify the seed shape:** `bundleToDefaultCourse` wraps a bundle into a course (sets `gates:[]`, no `finalBoss`). The regenerated seed may need to be a `Course` JSON directly, not a `ContentBundle`, so `store.ts` can load it without losing boss config. Settle this architecture first.

### 4. Enforce `finalBoss`-present in `validateCourse`

Currently deferred because `validateCourse` is a **load/cache gate** (`load.ts:34`, `cache.ts:37`): enforcing it would reject any course lacking a final boss, INCLUDING the migrated default course produced by `bundleToDefaultCourse` (which sets `gates:[]` and no `finalBoss`).

Before enforcing:
- Either make `bundleToDefaultCourse` synthesize a default `finalBoss` (so every course shape always has one), OR
- Ensure migrated/legacy courses are never re-validated on load (e.g., skip `validateCourse` when loading from the bundle-shaped fallback path, only validating admin-saved courses).

**Coordinate with seed regen** (task 3): once every loadable course has a valid `finalBoss`, the enforcement is safe. The existing `validateCourse` test `base` (no `finalBoss`) currently asserts `.ok===true` — that assertion must be updated when enforcement is added.

## Carried tech-debt (fold into P3b where touched)

- **Non-deterministic boss sampling:** `resolveCourseBundle(course, Math.random)` re-samples boss review content per `setCourse` call (non-deterministic across reloads). Acceptable for P3a. If stable-per-course sampling matters in P3b, seed the RNG by course id (e.g., a simple numeric hash of the course id string).
- **Duplicate Fisher–Yates:** `shuffleWith` in `src/content/review.ts` vs `shuffle` in `src/domain/check.ts` (Math.random-hardcoded). Consider unifying — add an optional `rng` param to the domain shuffle so it can be deterministic in tests.
- **a11y** on any new admin surfaces or import UI introduced in P3b.
- **Duplicate `afterUnitId` on gates:** two gates sharing the same `afterUnitId` both get fractional order `N+0.5` (a tie). The resolver doesn't handle this; validation could reject duplicate `afterUnitId` values, or the resolver could epsilon-offset them. Not currently handled in either place.

## Landmines (carried)

- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged — **never stage or commit it** (verified clean through P3a).
- Branch is `journey-redesign` (integration branch ~100+ commits ahead of `main`); commit here, do NOT merge to main.
- `src/content/seed.ts` is **generated** — regenerate via admin export + `seed:export`, not by hand. `seedCourse.ts` is the P3a hand-authored stopgap and must be **removed** (not edited) once the proper course seed is regenerated.
- Reuse the existing boss-battle feature (`CheckpointBoss`, `BossPrepScreen`, `BattleScreen`, `finishBoss`). The resolver feeds this pipeline unchanged. Do not rebuild it.
- Per-user persisted state changes need ALL of: `GameState`, `freshState`, action, `PersistedState` Pick, `selectPersisted`, `partialize` (or `...rest`), `migrate` backfill, `PERSIST_VERSION` bump, AND cloud-sync fixtures (`mapping`/`reconcile`/`cloudSync` tests). `l1Mode` (v14) and `courseComplete` (v15) are the reference patterns.
- `.superpowers/` is gitignored.

## How to run / test

- `npm run dev` → guest → PetRoom → Play ▶ → Beginner course → clear units; the ⚔️ Midway Review gate appears after Next Steps and gates Challenge; the 👑 Grand Finale appears last and completes the course (persists across reload).
- `npm test` (803 currently), `npm run build`.
- Admin: `<dev-url>/#admin`, sign in as admin (custom claim). Boss-config forms will be in `JourneyTab` (or a new Bosses tab) once P3b lands.
