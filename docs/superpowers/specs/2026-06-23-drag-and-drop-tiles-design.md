# Spec — Tap → Drag-and-Drop tile placement (Slice A)

**Date:** 2026-06-23
**Status:** approved, ready for plan
**Phase:** 2, Slice A (interaction foundation). Slice B = Word-Choice drill, built on top of this.

## Goal

Replace the tile-placement interaction across the drill from **tap-to-place** to
**drag-to-place** using [@dnd-kit](https://dndkit.com/). Only one drill exists today
(Pattern), so this converts that single flow. This establishes the drag interaction
that the next slice (Word-Choice) inherits, so it is done globally now rather than
per-drill.

This supersedes the previously LOCKED design decisions §2 ("tap-to-place") and §10
("tap-tiles only"). `GAME_DESIGN.md` is updated as part of this work to record the
new decision.

## Interaction model (decided)

- **Place:** drag a tray tile onto any slot → the word fills that slot.
- **Auto-evaluate:** when all slots are full, evaluate immediately (unchanged from today).
- **Undo:** **tap** a filled slot → its tile returns to the tray (the existing clear path is kept).
- **Occupied slot:** dropping onto an already-filled slot is ignored (no swap).
- **Order matters:** the kid chooses which slot each tile goes into (no auto-snap to next-empty),
  preserving the word-order learning the Pattern drill is built on.

Rejected alternatives: drag-both-ways reordering (more state/test surface, not needed),
auto-snap-nearest (removes slot choice, weakens word-order practice).

## Architecture

No changes to `src/domain/*` or `src/state/gameStore.ts` — placement is UI-only; the
correctness engine, scoring, store, and config are untouched. The 44 existing
domain/store tests stay green.

### Components touched

- **`src/components/DrillScreen.tsx`**
  - Wrap the screen body in `<DndContext>`.
  - Sensors:
    - `PointerSensor` with an activation constraint (`distance: 8`) so a tap is not
      misread as a drag.
    - `TouchSensor` with an activation delay (~150ms, tolerance ~5px) for phone touch.
    - `KeyboardSensor` for accessibility **and** to make placement drivable in tests.
  - Generalize the current `handlePick(word)` (which fills the *next* empty slot) into
    **`placeWord(word, slotIndex)`** (fills the *chosen* slot). Extract the pure
    placement transition so it can be unit-tested without simulating a drag.
  - `onDragEnd({active, over})`: if `over` is a `slot-{i}` droppable and slot `i` is
    empty → `placeWord(activeWord, i)` and mark the dragged tile used. Then the existing
    "all filled → `evaluate()`" path runs unchanged (retry-on-wrong, stars).
  - Render a `<DragOverlay>` showing the dragged tile under the finger to avoid layout
    jump while dragging.

- **`src/components/WordTray.tsx`**
  - Each tile becomes a `useDraggable` element. Draggable id = `tile-{i}` (index-based,
    because tiles can contain duplicate words). Carries the word in drag data.
  - Keeps `min-h-12` touch sizing.

- **`src/components/SentenceSlots.tsx`**
  - Each slot becomes a `useDroppable` element, id = `slot-{i}`.
  - Keeps the existing tap-to-clear (`onClearSlot`).
  - Visual affordance on drag-over (e.g. highlight the hovered empty slot) is allowed but
    not required for correctness.

- **`package.json`** — add `@dnd-kit/core`.

### Data flow

```
drag tile  → onDragEnd(active=tile-i, over=slot-j)
           → if slot j empty: placeWord(word_of_tile_i, j); mark tile used
           → if all slots filled: evaluate()  (unchanged: correct→next/finish, wrong→reshuffle+retry, mistakes++)
tap slot j → onClearSlot(j)  (unchanged: word back to tray)
```

## Testing strategy

- **Domain/store tests** (the bulk of the 44): unchanged, stay green — no logic touched.
- **`WordTray.test.tsx` + `DrillScreen.test.tsx`:** rewritten. Clicking a tile no longer
  places it, so the old click-to-place assertions are replaced. Placement is driven via
  the **KeyboardSensor**: focus a draggable tile → `Space` to pick up → arrow keys to move
  onto a slot → `Space` to drop, using `@testing-library/user-event` `keyboard`.
- **`placeWord` pure helper:** unit-tested directly (chosen slot fills, occupied slot
  ignored, tile marked used, duplicate-word handling) so core placement does not depend on
  simulating drags.
- **Gate:** `npm run test` all green + `npm run build` clean before the slice is done.

## Risks / flags

- **@dnd-kit + React 19 peer deps:** `@dnd-kit/core` may emit a peer-dependency warning on
  React 19. Verify the install resolves and tests run in Task 1; if it breaks, pin to a
  React-19-compatible version. Test-green is the gate, not the absence of a peer warning.
- **Touch feel** (activation delay/distance) is tuned by feel; values above are starting
  points, adjustable in the build.

## Out of scope (later slices)

- Word-Choice drill, distractor tiles, distractor-count dial (Slice B).
- Veggie food/inventory, drill-type routing in `finishRound`, drill-picker menu (Slice B).
- Drag-both-ways reordering, animated tile transitions, asset PNGs.

## Doc sync

After build: update `GAME_DESIGN.md` §2/§10 (drag-to-place) in **both** the repo copy and
the H: Drive working copy. (Note: the repo `GAME_DESIGN.md` was found missing at handoff —
only the H: Drive copy exists; re-add it to the repo as part of this work.)
