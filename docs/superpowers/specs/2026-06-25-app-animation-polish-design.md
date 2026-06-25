# App-wide animation / interaction polish — design

**Date:** 2026-06-25
**Status:** approved, ready for plan
**Branch:** `shop-economy` (continues the animation work; same branch as the shop slice + shop animations)

## Problem

An animation audit found the drag-drop drill flow (DrillScreen/EggHatch), RewardScreen, WordTray, PetSprite, StatBars, and the new Shop are well-animated, but the **menu / navigation screens and buttons are static or inconsistent**, and the **core sentence-slot drop has no landing feedback**:

| Gap | Place | Missing |
|---|---|---|
| A | `DrillPicker` (whole hub) | No card entrance, no chip/Back tap feedback |
| B | Buttons app-wide | PetRoom Play/Feed/Shop, RewardScreen Continue, DrillPicker chips/Back are plain `<button>` — no tap squish |
| C | `SentenceSlots` (core loop) | Drop target only swaps color on `isOver` (no scale/pulse); placed word appears with no pop-in |
| D | Minor | EggHatch 🥚 static (no idle wobble); DrillScreen flag-tip appears with no fade-in |

## Goal

Make interaction feedback consistent across the whole app using existing patterns. Purely presentational — **no store / persist / domain / config change**.

## Decisions (from brainstorming)

- Do all four gaps (A, B, C, D).
- **Button tap feel = a shared `PressButton` component** (not inline `motion.button` per call site) — one source of truth, new buttons get it free.
- **Leave already-animated buttons alone:** Shop's Back + `TreatCard` already use `motion`/`whileTap`; do NOT churn them onto `PressButton` now.
- SentenceSlots word pop via `key={word}` remount: re-landing the same word still pops — correct, it's a new placement.
- Global `MotionConfig reducedMotion="user"` (in `App.tsx`) already gates all transforms.

## Components

### 1. `src/components/PressButton.tsx` (new)
A thin `motion.button` wrapper that forwards all native button props.

```tsx
import { motion, type HTMLMotionProps } from 'framer-motion';

type PressButtonProps = HTMLMotionProps<'button'>;

/** A button with a consistent press-squish. Forwards all native button props.
 *  whileTap is suppressed when disabled. */
export function PressButton({ disabled, type = 'button', ...props }: PressButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      {...props}
    />
  );
}
```

- Responsibility: render a native button with the standard tap squish. No layout/style of its own — `className`/children passed through.
- Consumers: PetRoom (Play, Feed, Shop), RewardScreen (Continue), DrillPicker (chips, Back).

### 2. `src/components/DrillPicker.tsx` (A + its share of B)
- Wrap each drill card in `motion.div` with stagger-in:
  `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}` (index from `.map((..., index) => ...)`).
- Replace the L-level chip `<button>` with `<PressButton>` (same className).
- Replace the Back `<button>` with `<PressButton>` (same className).

### 3. `src/components/PetRoom.tsx` (B)
- Replace the Play `<button>`, each Feed `<button>`, and the Shop `<button>` with `<PressButton>` (same classNames/handlers).

### 4. `src/components/RewardScreen.tsx` (B)
- Replace the Continue `<button>` with `<PressButton>` (same className/handler).

### 5. `src/components/SentenceSlots.tsx` (C)
- Convert `Slot`'s `<button>` to `motion.button`:
  - Keep `ref={setNodeRef}` (dnd-kit droppable) and `onClick`.
  - `animate={{ scale: isOver && empty ? 1.06 : 1 }}` for the hover-over swell.
  - Keep the existing `isOver && empty` emerald border/bg class swap.
- Wrap the placed word token in `motion.span`:
  ```tsx
  {empty ? (
    <span className="block text-slate-900"> </span>
  ) : (
    <motion.span
      key={word}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className="block text-slate-900"
    >
      {displayToken(word, index)}
    </motion.span>
  )}
  ```
  `key={word}` makes a newly-landed tile pop in.

### 6. Minor polish (D)
- **`src/components/EggHatch.tsx`:** wrap the `🥚` in a `motion.div` idle bob (mirror PetSprite's inner loop):
  ```tsx
  <motion.div
    className="text-[clamp(3rem,14vh,5rem)] leading-none"
    animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
  >
    🥚
  </motion.div>
  ```
  (Add `import { motion } from 'framer-motion';` to EggHatch.)
- **`src/components/DrillScreen.tsx`:** wrap the flag-tip box in a `motion.div`:
  `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}` (keep its existing classes). DrillScreen does not currently import framer-motion — add the import.

## Data flow

No data/state change. All edits are presentational wrappers around existing markup; props, handlers, dnd-kit refs, and store reads are unchanged.

## Edge cases / constraints

- **dnd-kit + framer on the same element (Slot):** `motion.button` accepts `ref` and forwards it; `setNodeRef` still wires the droppable. WordTray already combines `motion.button` + `useDraggable` successfully — same pattern.
- **Reduced motion:** global `MotionConfig reducedMotion="user"` skips the transforms (swell, pop, bob, squish, stagger). No per-component handling.
- **SentenceSlots is shared** by EggHatch and DrillScreen — the C change benefits both; both their tests must stay green.
- **`PressButton` disabled:** when `disabled`, `whileTap` is suppressed (so it does not squish a disabled button). Native `disabled` still blocks `onClick`.
- **No churn:** Shop `Back` + `TreatCard` keep their existing inline `whileTap` — out of scope.

## Testing (render-only, jsdom-safe)

Never assert animated style values. Mock `canvas-confetti` in any touched test that transitively imports `celebrate`.

- `src/components/PressButton.test.tsx` (new):
  - Renders its children and forwards `className`.
  - `onClick` fires when clicked (enabled).
  - When `disabled`, the button is disabled and `onClick` does not fire.
- Existing tests that must stay green after the swaps (queries are by role/text, so they should not need changes): `DrillPicker.test.tsx`, `PetRoom.test.tsx`, `RewardScreen.test.tsx`, `SentenceSlots.test.tsx`, `EggHatch.test.tsx`, `DrillScreen.test.tsx`. If any asserted a raw `<button>` tag or a `disabled` attribute that changed semantics, adjust that single assertion — do not weaken otherwise-passing tests.
- No new behavior tests beyond `PressButton` — the rest is visual.

## Out of scope

- No store / persist / domain / config changes.
- No migration of Shop/TreatCard buttons to `PressButton`.
- No new sounds; haptics unchanged.
- No changes to the drill correctness/feedback timing (`useRoundFeedback`).

## Docs

No `GAME_DESIGN.md` change (pure UI polish).
