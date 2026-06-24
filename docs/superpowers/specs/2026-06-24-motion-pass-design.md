# Spec — Motion Pass (framer-motion)

**Date:** 2026-06-24
**Status:** approved, ready for plan
**Phase:** 2, motion/juice pass. Stacked on `feat/sentence-feedback` (drag + feedback). Rebase onto `main` once those merge.

## Goal

The app is static almost everywhere outside the just-shipped per-sentence feedback.
This pass adds motion across four areas — screen transitions, pet life, reward juice,
and number/bar motion — so the game feels alive and the care loop (bars rising/falling)
is legible. Built with **framer-motion**. No new art assets are required; all spots are
transform/opacity animation of existing emoji + DOM.

## Cross-cutting decisions

- **Library:** `framer-motion` (React 19 compatible).
- **Reduced motion:** wrap the app in `<MotionConfig reducedMotion="user">` so every
  animation auto-disables for users with `prefers-reduced-motion: reduce`. One global
  setting; individual components do not each re-implement the guard.
- **Coexistence:** the feedback slice's CSS `@keyframes` + `canvas-confetti` stay as-is.
  New motion uses framer-motion. Confetti (`fireConfetti` in `src/effects/celebrate.ts`)
  is reused for the reward-screen burst.
- **Number tween helper:** `src/effects/useCountUp.ts` — a hook that animates a displayed
  integer from its previous value to a new target over ~600ms. Used by StatBars labels,
  PetRoom (XP/coins), and RewardScreen (coins/food).

## Areas

### Area 1 — Screen transitions (`App.tsx`)
Wrap `<CurrentScreen>` in `<AnimatePresence mode="wait">`. Each screen renders inside a
keyed `motion.div` (`key` = the screen identity: `egg` / `petRoom` / `drill` / `reward`)
with `initial` (fade + small slide-in), `animate` (settled), and `exit` (fade + slide-out).
The `motion.div` carries `h-full` so the existing AppShell layout is unchanged. Result:
true enter **and** exit transitions between all screens instead of hard cuts.

### Area 2 — Pet life (`PetSprite`, `PetRoom`)
- **Idle:** `PetSprite` wraps the emoji in a `motion.div` with an infinite gentle loop
  (`y: [0,-6,0]`, `scale: [1,1.03,1]`, ~3s) — a breathing bob so the pet feels alive.
- **Feed reaction:** when the kid feeds (`PetRoom` `feedAll`), the pet plays a one-shot
  spring bounce. `PetRoom` sets a transient trigger (a counter) that `PetSprite` keys a
  bounce animation off.
- **Evolution pop:** `PetSprite` tracks the previous `stage` via a ref; when `stage`
  changes it plays a scale pop + a brief sparkle ring (CSS or a small motion burst).

### Area 3 — Reward juice (`RewardScreen`)
- Fire `fireConfetti()` once on mount (the round payoff).
- Staggered entrance via a motion container with `staggerChildren`: the "Level cleared!"
  title slides in, the `⭐` stars **pop one-by-one**, then the coins and food lines
  **count up** (`useCountUp`).

### Area 4 — Number & bar motion (`StatBars`, `PetRoom`, `WordTray`)
- **Bars (`StatBars`):** the fill is a `motion.div` animating `width` (smooth drain on the
  −5/round decay, smooth fill on feed) instead of the current instant `style={{width}}`.
- **Bar number label:** count-up/down via `useCountUp`, in sync with the width.
- **Change highlight:** the bar whose value changed gets a brief pulse/glow so the kid
  notices which stat moved (reinforces the `Health = min` balance signal from §12).
- **Low-value color warn:** each bar keeps its identity color (Health rose, Happiness
  yellow, Protein orange) when healthy; tints **amber when value < 30** and **red when
  value < 15**. Applies to all bars.
- **XP / coins (`PetRoom`):** count-up tween instead of snapping.
- **Tray tiles (`WordTray`):** stagger-in on each new sentence (the tiles for a new item
  fade/scale in one after another rather than appearing at once).

## Build order (decomposed slices, subagent-driven)

Easiest → riskiest, each independently shippable + green:

1. **Foundation** — add framer-motion, `<MotionConfig reducedMotion="user">`, `useCountUp` + test.
2. **Number & bar motion** — StatBars (width + label + highlight + low-color), PetRoom XP/coins, WordTray stagger.
3. **Pet life** — idle bob, feed bounce, evolution pop.
4. **Reward juice** — confetti + staggered entrance + count-up.
5. **Screen transitions** — AnimatePresence in App (most cross-cutting; last).

## Testing

- framer-motion renders its `motion.*` elements as ordinary DOM in jsdom (animations
  no-op without a layout/RAF environment), so existing render-based screen tests keep
  working — they just assert the components still mount and render their content. Add a
  mount-without-throwing assertion per touched screen.
- **`useCountUp`** is unit-tested with Vitest fake timers: starts at the old value,
  advances to the target by the end of the duration, and clamps to the target.
- **Low-color thresholds** and the **bar width mapping** are pure once extracted into a
  tiny helper (e.g. `barColor(value)` / width%) — unit-test that helper directly rather
  than asserting on framer-motion internals.
- Reduced motion is delegated to `MotionConfig` and trusted (not unit-tested).
- **Gate:** `npm run test` all green + `npm run build` clean per slice.

## Risks / flags

- **framer-motion + React 19 + jsdom:** verify at the Foundation slice that `motion.div`
  renders in tests without errors; if a specific API misbehaves in jsdom, prefer the
  declarative `motion` props that degrade to plain divs, or mock `framer-motion` in that
  test file.
- **Bundle size:** framer-motion adds ~30–50kb gzipped (current JS ~78kb). Accepted for
  the richer result. Note the new bundle size after the Foundation slice.
- **Animation timings/curves** are feel-tuned; values here are starting points.

## Out of scope

- Sprite-frame animation (blink, tail-wag) — needs partner art + the asset-loader.
- Sound effects; reward-screen visual redesign; other drills.

## Branch

`feat/motion-pass`, stacked on `feat/sentence-feedback`. Rebase onto `main` after the
drag + feedback slices merge.
