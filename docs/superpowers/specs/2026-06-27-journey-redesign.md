# Journey map redesign — Trail layout

**Date:** 2026-06-27
**Surface:** `src/components/JourneyMap.tsx` (reached from PetRoom; rendered under screen key `pickDrill`; music zone `overworld`).
**Type:** UI/UX only. No domain or gating logic changes.

## Problem

The current Journey map is a flat list of white unit cards, each with a horizontal row of `h-12 w-12` lesson dots. Weaknesses:

- No sense of progression or "path"; the dot row doesn't read as a sequence.
- Locked state is only `opacity-50`.
- Checkpoints (the unit's final boss node) don't feel like a milestone.
- Star counts are hidden inside the aria-label, never shown.
- No "you are here" affordance for the next playable lesson.
- **Farming problem:** once a lesson is cleared its dot shows only `✓`, hiding which food group it farms. A returning player who wants to replay a lesson for a specific food (pattern → 🥩 protein, wordChoice → 🥦 veggie, grammar → 💊 vitamin, mixed → 🍰 treat) cannot tell cleared nodes apart.

## Decision

Replace the card list with a **winding trail** (vertical level-map). Chosen from three live mockups (trail / refined cards / spine) plus a cleared-node treatment comparison (badge / ring / chip). Decisions:

- **Trail** layout.
- **Collapse-cleared-units** folding for length management.
- **Badge** cleared-node treatment: food emoji is the node face; a small emerald `✓` corner badge plus emerald ring signal cleared. This fixes the farming problem — every cleared node still shows its food.

## Design

### Shell

- `grid grid-rows-[auto_1fr]` on `h-full`, indigo background (gradient `from-indigo-100 to-indigo-50` acceptable).
- **Header (sticky, row 1):** `← Back` (PressButton → `setScreen('petRoom')`), centered/left title "Journey", and a total-stars badge `★ {sum of all lessonStars}` on the right.
- **Body (row 2):** vertical-scroll trail (`overflow-y-auto`), units stacked by `orderedUnits(bundle)`.

### Unit section

- **Sticky unit header:** emoji chip + title. Right side shows `cleared/total` badge for an in-progress unlocked unit, or a `collapse ▴` button when a fully-cleared unit is expanded.
- **Trail spine:** a dotted vertical line behind the nodes (decorative, `aria-hidden`).
- **Nodes:** serpentine horizontal offset by index (e.g. left / center / right / center pattern), connected by the spine.
- **Locked unit:** dimmed (`opacity`) with an overlay card: "Clear the previous checkpoint to open {title}." Nodes inside stay disabled.

### Node states (`TrailNode`)

Driven by existing domain helpers per lesson: `isLessonUnlocked` (open), `lessonCleared` (cleared), `lesson.isCheckpoint`, and `stars[lesson.id]`.

| State | Face | Treatment |
|---|---|---|
| Cleared (non-checkpoint) | drill food emoji on drill tint | emerald ring + emerald `✓` corner badge; star pips below |
| Cleared checkpoint | 🍰 (mixed food) on tint, rounded-square, larger | same badge + ring; star pips |
| Current (first open, not cleared) | drill food emoji | "YOU ARE HERE" pill, pulse + bob, drill label below |
| Open non-current | drill food emoji | normal tile, tappable |
| Locked lesson | 🔒 | grey, `disabled` |
| Locked checkpoint | 🏆 | grey rounded-square, "CHECKPOINT 🔒" |

"Current" = the first open, not-cleared lesson across the whole journey (single global beacon). All clearable nodes call `startLesson(lesson.id)` on tap.

### Folding (collapse cleared units)

- A unit where `unitProgress(unit, stars).cleared === total` auto-folds to a one-line **summary bar**: emoji · title · `★ {unit star total}` · `cleared/total` · `▾`.
- Tap the bar to expand; `collapse ▴` in the expanded header to refold.
- Current/in-progress unlocked units and locked units are always expanded.
- **Fold state is session-local** (`useState`), seeded so cleared units start folded. Not persisted to the store/Firestore — no domain change. Resets on remount.
- A unit that becomes fully cleared during this session folds on next render; no "just completed" celebration delay (UI-only).

### Presentational helpers / components

- `LABEL: Record<DrillType, string>` — display names ("Sentence Pattern", "Word Choice", "Grammar", "Mixed Review"). Checkpoint shows "Checkpoint".
- Reuse `DRILL_FOOD` + `FOOD_META` for food emoji; define a small per-drill tint map (bg/ring/ink) for tiles.
- `StarPips({ n })` — three stars, filled to `n`, rest muted.
- Serpentine offset helper by index.
- Extract focused subcomponents: `TrailNode`, `UnitSection`, `FoldedUnitBar`, `StarPips`. Keeps `JourneyMap` a thin orchestrator.

### Motion

- framer-motion stagger-in on unit sections / nodes (`delay: index * 0.06`).
- Current-node pulse + gentle bob.
- `PressButton` for tap squish + tap SFX on all interactive nodes (preserves existing audio).
- Pulse/bob gated for reduced motion: `@media (prefers-reduced-motion: reduce)` disables the keyframes; entrance falls back to instant/opacity. No animation gates content visibility.

### Accessibility

- Keep `lessonLabel(...)` aria-labels on lesson buttons (unit, drill/checkpoint, status, stars).
- Locked buttons remain `disabled`.
- Fold summary bar / collapse control is a `<button>` with `aria-expanded`.
- Decorative spine and emoji are `aria-hidden`.
- Contrast: node labels and badges meet ≥4.5:1 (use drill-hue darker inks, not light gray, on tinted tiles).

## Out of scope

- No changes to `journeyProgress.ts`, `content/model.ts`, `gameStore` journey logic, or content data.
- No persistence of fold state.
- No new screens or routes; checkpoint "boss" remains a normal lesson launch.

## Testing

Keep `JourneyMap.test.tsx` green; add coverage:

- Cleared unit renders folded by default (summary bar shown, lesson buttons hidden).
- Expanding a folded unit reveals its nodes; collapsing re-hides them.
- A cleared node renders its food emoji (not only `✓`) — guards the farming fix.
- Locked lesson button is `disabled`; current lesson is enabled and calls `startLesson`.
- Locked unit shows the unlock-hint overlay.

Maintain `npx tsc -b`, `npm run build`, and `npx vitest run` green.

## Process

Subagent-driven per task (global preference): fresh subagent per task, main thread reviews spec-then-quality between tasks. Branch `journey-redesign` off `main`. Stage explicit files only (never `git add -A`); leave the concurrent session's `firebase.json` unstaged. Delete the throwaway `public/journey-redesign.html` and `shot*.mjs` / `shot-*.png` mockup artifacts before finishing.
