# Drill Revamp P3b — Course-Based Admin Authoring, Excel Import, Seed Regen, finalBoss Enforcement

**Date:** 2026-06-28
**Repo:** `sentence-pet` (branch `journey-redesign` — integration branch; do NOT merge to `main`)
**Builds on:** P3a (boss-tier runtime, complete, `fd79034..94b9447`)
**Parent spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md` (§6 admin, §8 Excel, §9 validate)
**Phase handoff:** `docs/superpowers/plans/2026-06-28-drill-revamp-p3b-handoff.md`
**Execution:** one plan, subagent-per-task, two-stage review (spec review + code-quality review) per task — matches how P3a was run.

## 1. Goal

Give admins a way to author gated bosses, a final boss, and full courses — in the UI and via Excel bulk import — and replace the P3a hand-authored stopgap seed with a regenerated, Course-shaped seed. Enforce that every course has a final boss.

## 2. Problem statement (why this is more than "add a boss form")

The admin tool is structurally incapable of holding gated/final bosses today:

- `AdminShell` drafts a **`ContentBundle`**, validates with `validateContent` (bundle), and persists via `saveContent(bundle)`.
- `saveContent` → `bundleToDefaultCourse(bundle)`, which sets `gates: []` and **no `finalBoss`** (`migrate.ts:29`). Any gated/final boss would be flattened away on save.
- `JourneyTab`/`PoolTab` operate on `bundle.pool` / `bundle.units` only. There is no boss editor in the admin UI (the P3a handoff's reference to an "existing checkpoint boss editor in JourneyTab" is stale — none exists).
- `saveCourse(course)` (`firebase/content.ts:39`) is the real Course persist path, but the admin tool never calls it.

Therefore the keystone of P3b is migrating the admin tool from a `ContentBundle` draft to a `Course` draft. Once admin edits a `Course`, boss forms, Excel-import-to-Course, Course-shaped seed export, and finalBoss enforcement all follow naturally.

## 3. Scope

### 3.1 Admin → Course draft (keystone)

`AdminShell` (`src/components/admin/AdminShell.tsx`):

- Draft state type `ContentBundle` → `Course`. Initialise from `useContentStore((s) => s.course)` (not `.bundle`).
- Validation: `validateContent(draft)` → `validateCourse(draft)`.
- Save: `saveContent(draft)` → `saveCourse(draft)`; push to store via `setCourse(draft, 'live')` (not `setBundle`).
- Existing validation-error list rendering stays; it now reflects `validateCourse` errors (gates/final included).

`PoolTab` and `JourneyTab`:

- Retarget props from `ContentBundle` to `Course`: read/write `course.pool` and `course.units`. The component internals (item editing, node assignment) are unchanged apart from the prop swap — `eligibleItemIds`, `patchUnit`, `patchLesson`, `toggleItem` all keep working against `course.pool`/`course.units`.
- `onChange` emits a `Course` (spread-preserve `gates`/`finalBoss`/`id`/`title`/`emoji`/`l1Ready`).

New **Bosses tab** (new component, e.g. `src/components/admin/BossesTab.tsx`):

- **Gated bosses** — list of `course.gates[]` with add / edit / delete. Per gate:
  - `afterUnitId` — `<select>` of `course.units` ids.
  - `reviewsUnitIds` — multi-select of unit ids.
  - `reviewCount` — number input.
  - `pinnedItemIds` — multi-select of `course.pool` ids (any kind).
  - `boss` (`CheckpointBoss`): `tierId`, `element`, `name`, `rivalSprite` (`species`, `stage`).
  - `scope` is fixed `'gated'` (not user-editable).
- **Final boss** — single editor for `course.finalBoss`. Same fields minus `afterUnitId`; `scope` fixed `'final'`, `onClear` fixed `'completeCourse'`. Allows replacing/clearing the final boss (clearing reintroduces a validation error once §3.4 enforcement lands — acceptable, the shell already blocks save on invalid).
- Edits flow through the same `onChange(course)` → draft → `validateCourse` → save pipeline.

a11y: the Bosses tab and the Import preview are new admin surfaces — apply the `accessibility` skill (labelled controls, `fieldset`/`legend` grouping per boss, validation errors in an `aria-live` region).

### 3.2 Excel bulk import (parent spec §8)

- Add `xlsx` (SheetJS) as a dependency.
- Pure parser `parseWorkbookToCourse(workbook): { course: Course | null; errors: string[] }` in a new `src/content/excelImport.ts` (no DOM, unit-testable).
  - Sheets per parent spec §8: **Course** (id, title, emoji, l1Ready), **Units** (id, title, emoji, order, l1Enabled), **Items** (id, kind, level, unit, node, l1_th + kind-specific columns), **Bosses** (id, scope, afterUnit/reviewsUnits CSV, reviewCount, pinnedItemIds CSV).
  - Kind-specific Items columns per parent spec §8 (flashcard front/back/audio; matching pair cells; dragdrop variant/slots/answer/distractors/hidePos; fillblank template/answer/alternates).
  - Malformed rows reported with **sheet name + row number**.
- New **Import tab** (in `AdminShell`): `<input type="file" accept=".xlsx">` → read workbook → `parseWorkbookToCourse` → `validateCourse(course)`.
- **Preview-then-commit:** render parsed structure (unit titles, per-unit item counts, gate + final boss config) and **all** parse + validation errors prominently. If any error exists, the Commit button is disabled and nothing is written. Commit → `saveCourse(course)` + `setCourse(course, 'live')`.
- The parser is the substance and is unit-tested against fixture workbooks; the Import UI is a thin shell over it.

### 3.3 Seed regen + remove `seedCourse.ts`

The P3a hand-authored `src/content/seedCourse.ts` is a stopgap and is removed.

- `src/content/seed.ts`: **keep `SEED: ContentBundle`** (legacy paths — `export-seed.ts`, `fetchContent`, bundle tests still consume it) and **add a generated `SEED_COURSE: Course`** that carries `gates` + `finalBoss`.
- `scripts/export-seed.ts`: export a **Course-shaped** JSON (pool + units + gates + finalBoss), not just the bundle, since a `ContentBundle` cannot carry `gates`/`finalBoss`.
- Authoring workflow: author the example gated + final bosses in the new admin Bosses tab (§3.1) → export → regenerate the `SEED_COURSE` literal in `seed.ts` from the export.
- `src/content/store.ts`: fallback `firstCourse = cachedCourse() ?? SEED_COURSE` now points at the **generated** `SEED_COURSE` from `seed.ts`; remove the import of the deleted `seedCourse.ts`.
- Delete `src/content/seedCourse.ts`.

### 3.4 Enforce `finalBoss`-present in `validateCourse`

Deferred in P3a because `validateCourse` is a load/cache gate (`load.ts:34`, `cache.ts:32`): enforcing finalBoss would reject any course lacking one, including the migrated default course from `bundleToDefaultCourse` (`gates:[]`, no `finalBoss`).

Resolution (synthesize, then enforce):

- `bundleToDefaultCourse` (`migrate.ts:29`) **synthesizes a default `finalBoss`**: `scope:'final'`, `onClear:'completeCourse'`, `reviewsUnitIds` = all unit ids, a default `reviewCount`, and a default `boss` config. Every Course shape then always has a valid final boss.
- `validateCourse` adds a finalBoss-presence check (`push` an error when `course.finalBoss` is absent). Safe now — migrated/legacy/seed courses all carry one.
- Update the existing `validateCourse` `base` test that asserts `.ok === true` with no `finalBoss` — that assertion flips (now an error) or the fixture gains a finalBoss.
- Side benefit: migrated/online installs gain a playable final boss instead of none (partially closes the P3a "online shows no bosses" gap for the finale).

### 3.5 Folded tech-debt

- **Duplicate `afterUnitId` gates:** two gates sharing one `afterUnitId` both resolve to fractional order `N+0.5` (a tie the resolver does not handle). `validateCourse` rejects duplicate `afterUnitId` values across `course.gates`. Cheap; add here.

### 3.6 Explicitly out of scope (deferred)

- Deterministic boss sampling (seed RNG by course id) — `resolveCourseBundle(course, Math.random)` re-samples per `setCourse`. Acceptable; note only.
- Unifying the duplicate Fisher–Yates (`review.ts shuffleWith` vs `check.ts shuffle`).
- Flashcard speaking/pronunciation; matching images (parent spec "Reserved").

## 4. Architecture / data flow

```
Excel (.xlsx) ──parseWorkbookToCourse──┐
Admin tabs (Pool/Journey/Bosses) ──────┤
                                       ▼
                                 Course (draft)
                                       │ validateCourse  (gate: blocks save on error;
                                       │                  enforces finalBoss + gate dupes)
                                       ▼
                       saveCourse(course) ──► Firestore content/courses/{id}/doc
                       setCourse(course)  ──► useContentStore { course, bundle:resolveCourseBundle(course) }
                                                                   │
                                          player runtime (unchanged P3a boss pipeline)

seed: admin authors bosses ─export-seed─► dist-seed Course JSON ─regen─► seed.ts SEED_COURSE
                                                                              │ store fallback
bundleToDefaultCourse(legacy bundle) ──► Course (now WITH synthesized finalBoss)
```

Boundaries:

- **`parseWorkbookToCourse`** — pure: workbook → `{course, errors}`. No DOM, no Firestore. Unit-tested.
- **`validateCourse`** — pure gate, unchanged signature; gains finalBoss-presence + duplicate-`afterUnitId` checks. Used at author-save, import-commit, and live/cache load.
- **Admin tabs** — dumb editors over a `Course` draft; emit `Course` via `onChange`; never persist directly.
- **`AdminShell`** — owns the draft, runs `validateCourse`, calls `saveCourse`/`setCourse`. Single persist owner.
- **`bundleToDefaultCourse`** — pure legacy→Course adapter; now also the single source of the synthesized default finalBoss.

## 5. Testing

- `parseWorkbookToCourse`: fixture workbooks — happy path (all 4 sheets → valid Course), per-sheet malformed rows (sheet+row in error), missing sheet, kind-specific column parsing per kind.
- `validateCourse`: finalBoss-absent → error (update `base`); finalBoss-present → ok; duplicate `afterUnitId` gates → error.
- `bundleToDefaultCourse`: synthesized finalBoss shape (scope/onClear/reviewsUnitIds = all units/boss present); idempotent.
- Admin: `AdminShell` saves a `Course` via `saveCourse` (not `saveContent`); Bosses tab add/edit/delete gate + final; Pool/Journey tabs still edit pool/units against a `Course`.
- Existing suites stay green: cloud-sync, gameStore, journey/review resolver, courseLock. No persisted-state shape change expected in P3b (no new per-user field) — but verify cloud-sync fixtures if any persisted shape is touched.

## 6. Verification (before claiming done)

- `npm test` — ≥803 (P3a baseline) plus new parser/validate/migrate/admin tests.
- `npm run build` — clean.
- `npx tsc -b` — the real type gate (`tsc --noEmit` is a no-op in this repo); catches excess-property / shape breaks vitest misses.
- Manual smoke must run OFFLINE / fresh install — live `hydrateCourse('default')` overrides `SEED_COURSE`. Verify: admin authors a gate + final boss → save → reload shows them; Excel import preview blocks on error and commits a valid workbook.

## 7. Landmines (carried — apply every task)

- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged — never stage or commit it.
- Branch `journey-redesign` (integration, ~100+ commits ahead of `main`); commit here, do NOT merge to main. Draft PR #33 is the cumulative promotion vehicle — keep DRAFT.
- `src/content/seed.ts` is generated — regenerate via admin export + `seed:export`, not by hand. `seedCourse.ts` is removed, not edited.
- Reuse the boss-battle feature (`CheckpointBoss`, `BossPrepScreen`, `BattleScreen`, `finishBoss`) and the P3a resolver (`resolveCourseBundle`, `sampleReviewItems`) — do not rebuild.
- `DragDropItem.thaiHint` is a REQUIRED field — any dragdrop test fixture (incl. Excel import fixtures) must include it.
- READ a file before writing/overwriting (a P3a subagent nearly clobbered the 892-line `gameStore.test.ts` on a false "missing" glob).
- `validateCourse` is a load/cache gate — the new checks must not reject currently-loadable courses; the §3.4 synthesize-then-enforce ordering is what keeps this safe.
- `.superpowers/` is gitignored.
