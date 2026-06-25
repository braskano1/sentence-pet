# Mixed mode (drill #4, 🍰 treat) — design

**Date:** 2026-06-25
**Status:** approved (brainstorm)
**Slice:** Phase 2, drill #4 — the "boss." Completes the 4-drill / 4-food matrix and makes the last always-empty nutrition bar (treat) meaningful.

## Concept

The boss drill turns **all three difficulty dials on within a single item**:

- **Pattern dial** — the longest authored rung, S+V+O (3 slots).
- **Word-Choice dial** — a salted distractor tile in the tray.
- **Grammar dial** — a subject–verb agreement near-miss (a `trap`), graded **enforce**.

Graded enforce means only the exact correct sentence passes — both a misplaced distractor and a placed near-miss trap reject to `retry`. Completing a Mixed round yields 🍰 **treat** food, which feeds the last dead nutrition bar.

## Design decisions (resolved in brainstorm)

1. **Boss grading = enforce (strict).** Near-miss rejected → retry (like Grammar L2). No soft-accept. A boss that accepts near-misses felt wrong.
   - Consequence: in enforce mode a `trap` and a `distractor` grade **identically** (both → retry); the trap's `tip` never surfaces (the tip only shows on a flag-accept, which enforce never takes). We still author the agreement near-miss as a `trap` (slot+word+tip) — it is pedagogically labeled and future-proofs a possible flag-mode Mixed once level-select exists.
2. **Scope = Mixed L1 only, 5 items.** Only L1 is reachable today (`App.tsx` pins `level={1}`). L2–L5 deferred to the level-select slice.
3. **Tray load = 3 answer + 1 trap + 1 distractor = 5 tiles, 3 slots.** Gentle boss intro; both non-answer dials present but light; easy phone scan. All tile values within an item stay distinct (authoring invariant).

## Why no new engine (data-only slice)

The existing plumbing already composes all three dials:

- `gradePlacement(placed, item)` (`src/domain/grade.ts`) reads `answer` + `traps` + `strictness` together. With `strictness:'enforce'`: a misplaced distractor → `wrong`; a placed trap → `flagged` with `passes:false`; both route to `retry` via `resolveRound`.
- `trayWords(item)` (`src/data/wordBank.ts`) already concatenates `answer` + `distractors` + `traps`.
- `resolveRound`, `DrillScreen`, `StatBars`, `RewardScreen`, the feed button, reward emoji, and `gameStore.startDrill` are all generic over `DrillType` / `FOOD_GROUPS` / `FOOD_META`.
- `FOOD_META.treat` (🍰, pink) and `FOOD_GROUPS` already include `treat`; `NutritionBars.treat` already exists.

A Mixed item is therefore just an existing-shape `DrillItem` with all optional fields populated. No new domain module.

## Edit surface

| # | File | Change |
|---|------|--------|
| 1 | `src/data/types.ts` | `DrillType` += `'mixed'` |
| 2 | `src/data/food.ts` | `DRILL_FOOD.mixed = 'treat'` (compiler-forced by union widening) |
| 3 | `src/data/wordBank.ts` | 5 new Mixed L1 items (table below) |
| 4 | `src/components/DrillPicker.tsx` | one line: `{ drill: 'mixed', title: 'Mixed' }` in `DRILLS` |
| 5 | tests | see Testing |

No exhaustive `switch` on `DrillType` exists outside `DRILL_FOOD`'s `Record<DrillType, FoodGroup>`, so `tsc -b` will flag the single mandatory food entry.

## The 5 items (Mixed · Level 1)

S+V+O, `drill:'mixed'`, `level:1`, `strictness:'enforce'`, 1 trap (slot 1, the verb) + 1 distractor each. Mix of 3rd-person missing-`-s` traps and `I/we/they` over-`-s` traps.

| id | thaiHint | slots | answer | trap (slot 1) | distractor |
|----|----------|-------|--------|---------------|------------|
| `mx-l1-1` | ฉันกินข้าว | Pronoun·Verb·Object | `I` · `eat` · `rice` | `eats` — tip `ฉัน → I eat 👍` | `bread` |
| `mx-l1-2` | เขาดื่มน้ำ | Pronoun·Verb·Object | `he` · `drinks` · `water` | `drink` — tip `เขา → he drinks 👍` | `juice` |
| `mx-l1-3` | เธออ่านหนังสือ | Pronoun·Verb·Object | `she` · `reads` · `a book` | `read` — tip `เธอ → she reads 👍` | `a pen` |
| `mx-l1-4` | พวกเราเล่นฟุตบอล | Pronoun·Verb·Object | `we` · `play` · `football` | `plays` — tip `เรา → we play 👍` | `tennis` |
| `mx-l1-5` | พวกเขาดูทีวี | Pronoun·Verb·Object | `they` · `watch` · `TV` | `watches` — tip `เขา → they watch 👍` | `a movie` |

Each item's tray = `[...answer, distractor, trap.word]` = 5 distinct tiles. Verified no value collisions within any item.

## Testing (TDD)

- **`src/data/food.test.ts`** — `DRILL_FOOD.mixed === 'treat'`.
- **`src/data/wordBank.test.ts`** — `itemsFor('mixed', 1)` returns 5 items; extend the existing tile-distinctness invariant test to cover `'mixed'`.
- **`src/domain/grade.test.ts`** — for a representative mixed item: exact placement → `ideal`/`passes`; trap word in its slot → `flagged`/`passes:false` (enforce retry); distractor in a slot → `wrong`/`passes:false`.
- **`src/components/DrillPicker.test.tsx`** — drill card count 3 → 4 (render-only, per the jsdom convention).

Convention reminders carried from prior slices: pure-module logic unit-tested exhaustively; component tests render-only; mock `canvas-confetti` in any test transitively importing `src/effects/celebrate.ts`; use `npx tsc -b` (never `tsc --noEmit`).

## Out of scope

- Mixed L2–L5 (await level-select slice).
- No zustand persist version bump — `selectedDrill` is a string, `inventory` already has all 4 food groups, widening `DrillType` does not change persisted shape.
- No new domain module, no change to `grade.ts` / `round.ts` / `check.ts`.
- Level-select UI, shop/economy — separate deferred slices.

## Docs to sync

After this ships, add a "Mixed (shipped)" note to the §12 level-matrix in **both** copies of `GAME_DESIGN.md` (repo root + `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`).
