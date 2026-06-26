# Themed Learning Journey — Design Spec

**Date:** 2026-06-26
**Status:** Approved (brainstorming) → ready for implementation plan
**Author:** Claude + user

## Summary

Replace the flat "Pick a drill" grid (4 drill types × free-pick levels) with a
Duolingo-style **themed learning journey**: an ordered sequence of topic **Units**
(Greetings, Food, School, …). Each unit holds a short sequence of single-drill
**Lessons (nodes)** plus a **checkpoint**. Progression is unit-gated. The 4 food
bars stay balanced because each unit runs roughly one lesson per drill type.

This is **sub-project A** of a two-part ask. Sub-project B (an **admin backend**
to author pets + journey content) gets its own spec later. The content model here
(`src/data/journey.ts`, a plain array) is deliberately the seam that admin backend
will later write to (likely migrating to Firestore).

## Goals

- A guided, sequential learning path that feels like Duolingo (units, locked
  nodes, checkpoints, "you are here").
- Keep the existing 4-food-bar balance hook intact (one drill per node → a full
  unit tops up all 4 bars).
- Keep the pet's 1–50 level system fully decoupled (unchanged).
- Maximum reuse: **no changes to `WORD_BANK` / `DrillItem` / drill engine**.
- Content as plain data, ready to be admin-authored later.

## Non-goals (separate specs / deferred)

- **Admin backend** (sub-project B) — authoring UI for pets + journey content.
- **Boss-battle checkpoints** (Phase B-3 battle) — checkpoints are plain Mixed
  lessons now; a forward hook (`isCheckpoint`) marks where the battle swaps in.
- **Theme-specific item content** — starter units reuse existing `WORD_BANK`
  items; themed sentence sets come with the admin backend later.
- **Lives / hearts gate** — explicitly rejected. Food-bar decay is the only
  pressure. Lessons retry within the round until 5/5 (today's behavior).

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Journey shape | Path of **themed units** (not difficulty tiers, not single mixed path) |
| Unit internals | One drill type per node; ~4 nodes/unit; last node = Mixed checkpoint |
| Node unlock | **Unit-gated** — all lessons in an unlocked unit open at once |
| Checkpoint gate | Checkpoint unlocks once the unit's other lessons are cleared; clearing it unlocks the next unit |
| Lives/hearts | **None** — bars only |
| XP ↔ journey | **Independent** — lessons award XP/food/coins as today; pet 1–50 unchanged |
| Map layout | **Unit cards** (layout B) — each unit a card with a row of node-dots |
| Pass / stars | 5/5 to clear (today); 3⭐ mastery + replay kept |

## Content model

New file `src/data/journey.ts`:

```ts
import type { DrillType } from './types';

export interface Lesson {
  id: string;            // unique, stable (e.g. 'u1-pattern')
  drill: DrillType;      // resolves items via itemsFor(drill, level)
  level: number;         // existing difficulty rung
  isCheckpoint?: boolean; // last node of a unit; forward hook → boss battle (B-3)
}

export interface Unit {
  id: string;            // unique, stable (e.g. 'u1-basics')
  title: string;         // display name ("Basics", "Food & Eating")
  emoji: string;         // unit icon
  order: number;         // sequence position (ascending)
  lessons: Lesson[];     // ordered; exactly one isCheckpoint expected (the last)
}

export const JOURNEY: Unit[];
```

**A Lesson is a named pointer to `(drill, level)`.** Its sentences come from the
existing `itemsFor(drill, level)` (`src/data/wordBank.ts`). Items may be reused
across units in the MVP; theme-specific items arrive with the admin backend.

### Pure helpers (in `journey.ts` or a sibling domain module, unit-tested)

- `lessonById(id): Lesson | undefined`
- `unitForLesson(id): Unit | undefined`
- `findLesson(id): { unit, lesson } | undefined`
- Validation invariant (covered by a test over `JOURNEY`): every unit has ≥1
  lesson, exactly one checkpoint, the checkpoint is last, all lesson ids unique
  across the whole journey, all `(drill, level)` pairs resolve to ≥1 item via
  `itemsFor`.

### Seed content (migration of existing material)

Author starter units that wrap current `WORD_BANK` so the journey ships playable:

- **Unit 1 "Basics"** (`order: 1`): Pattern L1 → Word-Choice L1 → Grammar L1 →
  **checkpoint** Mixed L1.
- **Unit 2 "Next Steps"** (`order: 2`): Pattern L2 → Grammar L2 → **checkpoint**
  Mixed L1 (or another authored combo from existing levels).

(Exact composition finalized in the plan; constraint: every referenced
`(drill, level)` must exist in `WORD_BANK`.)

## Progression rules (pure domain)

New pure module `src/domain/journeyProgress.ts` (or extend an existing domain
file), fully unit-tested with injected progress state:

- `isUnitUnlocked(unit, progress, journey): boolean`
  - First unit (lowest `order`) → always unlocked.
  - Otherwise unlocked iff the **previous unit's checkpoint is cleared**.
- `isLessonUnlocked(lesson, unit, progress, journey): boolean`
  - Unit must be unlocked.
  - Non-checkpoint lesson → unlocked (unit-gated; all open at once).
  - Checkpoint lesson → unlocked iff **all non-checkpoint lessons in the unit are
    cleared**.
- `unitProgress(unit, progress): { cleared: number; total: number }` — for the
  card's "3/4" badge.
- A lesson is "cleared" iff its id is present in `journey.lessonStars`.

These are **pure functions over a progress object** — no store access — so they
test in isolation with plain fixtures.

## State / persistence

Zustand store (`src/state/gameStore.ts`), persist **v8 → v9** (additive,
version-branch backfill, consistent with prior migrations):

```ts
// persisted
journey: { lessonStars: Record<string /*lessonId*/, number /*best stars 0..3*/> }

// transient (excluded via partialize, like lastLevelUp)
currentLessonId: string | null
```

Migration v8→v9: backfill `journey: { lessonStars: {} }` when absent. Test
against the real `persist.getOptions().migrate` (project convention).

### Store actions

- `startLesson(lessonId: string)`: set `currentLessonId`, resolve the lesson's
  `(drill, level)`, and reuse the **existing `startDrill(drill, level)` flow**
  (drill round setup unchanged). `startLesson` is the new entry point; keep
  `startDrill` internal/used by it.
- On round **finish** (existing reward path): if `currentLessonId` is set, record
  `journey.lessonStars[currentLessonId] = max(existing, stars)` (best-of), then
  clear `currentLessonId`. XP/food/coins/level-up handling is **unchanged**.

Replaying a cleared lesson only updates best stars; clearing is idempotent.

## UI

- **`JourneyMap` component** (`src/components/JourneyMap.tsx`) **replaces
  `DrillPicker`**. The `pickDrill` screen renders the journey map.
  - Vertical scroll list of **unit cards** (layout B). Each card: emoji + title +
    `cleared/total` badge + a row of **node-dots** (one per lesson).
  - Node-dot states: **cleared** (✓ / star count), **current/available**
    (drill-colored, tappable), **locked** (greyed). Checkpoint dot uses the boss
    style (gold rounded ★).
  - Locked units render dimmed with a 🔒; their dots are non-interactive.
  - Tapping an available node → `startLesson(lesson.id)`.
- PetRoom **"Play"** entry routes to the journey map (same nav slot that opened
  the old drill picker).
- Keep `pickDrill` as the screen id (least churn) **or** rename to `journey` —
  decide in the plan; if renamed, update `Screen` union + `App.tsx` switch + any
  references. Carry the existing `AnimatePresence` key convention.

### Accessibility / interaction

- Node-dots are buttons with `aria-label`s ("Pattern lesson, cleared, 3 stars" /
  "locked"). Fixes the prior non-unique-name a11y nit class for this screen.
- Reuse `PressButton`, `framer-motion` entrance, `MotionConfig reducedMotion`.

## Testing

Follows project conventions (pure logic unit-tested; components render-only;
mock `canvas-confetti` where transitively imported).

- `journey.test.ts` — content invariants over `JOURNEY` (unique ids, one trailing
  checkpoint per unit, every `(drill, level)` resolves to items, orders ascending
  & unique).
- `journeyProgress.test.ts` — `isUnitUnlocked` / `isLessonUnlocked` /
  `unitProgress` across fixtures: first unit open, later units gated on prior
  checkpoint, checkpoint gated on sibling lessons, fully-cleared journey.
- store tests — `startLesson` sets `currentLessonId` + delegates to drill setup;
  finishing a lesson records best stars (best-of on replay); migration v8→v9
  backfills empty `journey`.
- `JourneyMap.test.tsx` — render-only: unit cards render, locked units dimmed &
  non-interactive, node states reflect progress, tapping available node calls
  `startLesson`.

## Forward hooks (do not build now, just leave room)

- `Lesson.isCheckpoint` is the seam where the **B-3 boss battle** swaps in for the
  Mixed round.
- `JOURNEY` as plain data is the seam the **admin backend** (sub-project B) will
  later author / migrate to Firestore.
- Optional later: checkpoint completion bonus (extra coins/happiness);
  theme-specific authored items.

## Manual QA (post-build, since jsdom can't see visuals)

- Journey map renders unit cards; Unit 1 open, Unit 2 locked.
- Play & clear all of Unit 1's lessons → checkpoint unlocks → clear checkpoint →
  Unit 2 unlocks. Node-dots update to cleared/stars.
- Food bars still fill from the per-node drill; pet XP/level still progress.
- Replaying a lesson improves but never lowers its stars.
