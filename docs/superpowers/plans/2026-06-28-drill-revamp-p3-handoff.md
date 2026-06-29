# Handoff — Drill Revamp P3 (boss tiers + Excel import + seed regen)

**Date:** 2026-06-28
**Branch:** `journey-redesign` (P2 committed + on the integration branch; NOT merged to main — promote the whole line as one release later)
**Spec:** `docs/superpowers/specs/2026-06-27-drill-revamp-design.md` (§3.2 bosses, §7 course completion, §8 Excel import, §9 validate)
**P2 plan (done):** `docs/superpowers/plans/2026-06-27-drill-revamp-p2-activities.md`

## P2 status: COMPLETE ✅

12 tasks, subagent-driven, two-stage reviewed, final whole-phase review = **SHIP**. 775 tests pass, build clean. Commits `f10c402..b341363` (20 commits incl. the plan doc).

What P2 delivered (players can now play all 4 activity kinds):
- **Discriminated `ContentItem` union** (`FlashcardItem|MatchingItem|DragDropItem|FillBlankItem`) + guards `isFlashcard/isMatching/isDragDrop/isFillBlank`; `DrillItem` is now an alias of `DragDropItem` — `src/data/types.ts`. Pool widened to `Record<string, ContentItem>` (`model.ts`, `course.ts`).
- **Kind-aware `validateItem`** (switch + `never` exhaustiveness guard) — `src/content/validate.ts`. **Legacy kind-stamping** in `bundleToDefaultCourse` + a runtime `stampPoolKind` so un-regenerated data loads — `src/content/migrate.ts`. `seed.ts` was **hand-stamped** `kind:'dragdrop'` (NOT regenerated — see P3 task).
- **Play ▶ → `pickCourse`** (always show select) — `src/components/PetRoom.tsx`.
- **Per-user TH/ENG L1 toggle**: `l1Mode` persisted in gameStore (PERSIST_VERSION **13→14**, flows through partialize/selectPersisted/migrate + cloud-sync `mapping.ts`); pure `showL1(unit, mode, helper)` display rule — `src/content/l1.ts`; `<L1Toggle/>` — `src/components/L1Toggle.tsx`.
- **3 new player screens** routed by `kind` at `screenKeyAndNode` in `src/App.tsx`:
  - `FlashcardScreen` — flip, always-on 🔊 TTS of front, Again/Got-it both completion-based (stars:3, no penalty per spec §7).
  - `MatchingScreen` — @dnd-kit drag prompts→slots, selective-clear keep-correct, per-pair Thai; pure `gradeMatching` exported.
  - `FillBlankScreen` — strict trimmed match (`gradeFillBlank`), escalating hint ladder `hintAt` (L1→first-letter→length-dots→reveal); **L1 hint rung gated through `showL1`** (l1Enabled + TH).
  - matching/fillblank use `computeStars({hints:0, mistakes})`.
- **Drag-drop `hidePos`** — hides POS label + tint in `SentenceSlots`; grading unaffected.
- **`KIND_FOOD`** kind→food map wired into `finishRound` (`kind && kind!=='boss' ? KIND_FOOD[kind] : DRILL_FOOD[drill]`) — dragdrop keeps richer per-variant food — `src/data/food.ts`, `src/state/gameStore.ts`.
- **Admin**: `ItemEditor` switches form by `kind` (`blankOf` minimal-valid reset, per-kind sub-forms incl. matching pair editor, `hidePos` checkbox, optional `l1.th`); `PoolTab` edits all kinds. `JourneyTab`: `kind` select + `eligibleItemIds(pool, kind)` filter + **prune itemIds on kind-change** + unit `l1Enabled` checkbox — `src/components/admin/*`.

## P3 SCOPE (write a fresh plan via writing-plans)

1. **Gated boss** (tier `'gated'`): placed via `afterUnitId`, reviews 2–3 prior units. Content is **sampled** (`reviewCount`) from `reviewsUnitIds`' nodes' `itemIds`, with `pinnedItemIds` always included (spec §3.2). Gates progression. Wire to the **existing boss-battle feature** (reuse `CheckpointBoss`/battle flow — do NOT rebuild). `BossNode` type already exists in `src/content/course.ts`.
2. **Final boss** (tier `'final'`, `onClear:'completeCourse'`): reviews whole course; clearing sets a per-player `courseComplete[courseId]` and **unlocks the next course** (CourseSelect already reads `locked` on `CourseIndexEntry`). Course-completion state is new — decide where it persists (gameStore, likely a new persisted field → PERSIST_VERSION bump v14→v15).
3. **Admin boss-config forms**: configure checkpoint/gated/final bosses (scope, `afterUnitId`, `reviewsUnitIds`, `reviewCount`, `pinnedItemIds`) in `JourneyTab` (or a new bosses tab). Today only `Lesson.boss?: CheckpointBoss` exists in the UI seam; gated/final live on `Course.gates[]`/`Course.finalBoss`.
4. **Excel bulk import** (spec §8): `xlsx`/SheetJS; sheets Course/Units/Items/Bosses; parse → build `Course` → run `validateContent`/`validateCourse` → **preview-then-commit** (show parsed result + validation errors before saving; nothing saved on any error; report malformed rows with sheet+row).
5. **Enforce `finalBoss` present** in `validateCourse` (currently optional — P1 migrated courses have none; add the check once P3 authors final bosses).
6. **Regenerate `seed.ts`** with kind-tagged content via admin export + `seed:export` (P2 hand-stamped `kind:'dragdrop'`; regenerate properly, optionally seeding example flashcard/matching/fillblank content to exercise the new screens).

## Carried tech-debt (from P2 final review — fold into P3 where touched)
- **`screenKeyAndNode` → options object.** It's at 7 positional params (`screen, hatched, drill, level, items, kind, unit`) in `src/App.tsx` — fragile when many tasks touch it. Refactor to a single options object.
- **a11y pass on new surfaces.** `MatchingScreen` drag has no live-region announcing placement/clear; `FillBlankScreen`'s escalating hint updates a plain `<p>` (add `aria-live="polite"`); `FillBlankScreen` input `aria-label="answer"` → friendlier. Extend DrillScreen's a11y patterns. (There's an `accessibility` skill available.)
- **Unit-header L1 toggle** (spec §4 says toggle appears in unit header AND per-screen). P2 placed `<L1Toggle/>` only inside the 3 content screens. Add it to the unit header (`JourneyMap`) if still desired — sets the unit default.
- **Validate orphan pool items.** `validateBundleShape` only validates items reachable via `lesson.itemIds`; an unreferenced pool item with a structural defect ships unvalidated. Consider validating the whole pool.
- **`KIND_FOOD.dragdrop` ('vitamin') is a fallback-only entry** (DrillScreen passes no `kind`, so dragdrop food comes from `DRILL_FOOD[drill]`). Add a one-line clarifying comment so the two food maps' disagreement for dragdrop isn't read as a bug.

## Landmines (carried)
- Stage **explicit files only**, never `git add -A`. `firebase.json` is intentionally modified-but-unstaged — never stage/commit it (verified: not in any P2 commit).
- `src/content/seed.ts` is generated — regenerate via admin export + `seed:export`, not by hand (P2 hand-stamping was a one-off compile fix; P3 should regenerate properly — task 6).
- Boss battle is an existing feature — reuse its config/flow, don't rebuild.
- `.superpowers/` is gitignored.
- Per-user persisted state changes need ALL of: GameState, freshState, action, PersistedState Pick, selectPersisted, partialize (include), migrate backfill, PERSIST_VERSION bump, AND cloud-sync fixtures (`mapping/reconcile/cloudSync` tests). l1Mode (v14) is the reference pattern.

## How to run / test
- `npm run dev` (free port 5173+), play as guest → PetRoom → Play ▶ → course select → unit map → each node kind renders its screen. `npm test` (775 pass). `npm run build` (clean).
- Admin: `<dev-url>/#admin`, sign in as admin (custom claim). Create items of each kind in Pool, set a node's kind + assign, save, play.
