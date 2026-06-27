# Journey drag/pan — replace the scroller

**Date:** 2026-06-27
**Surface:** `src/components/JourneyMap.tsx` and `src/components/journey/*` (the trail redesign).
**Type:** UI/UX only. No domain, gating, content, or audio changes.

## Problem

The trail Journey body uses `overflow-y-auto`. The scrollbar and web-page scroll feel break immersion — a game level-map should feel like a contained world you move through, not a scrolling document.

## Decision

Replace vertical scrolling with a **drag-to-pan map**. Chosen from a live interactive mockup (`public/journey-pan-mockup.html`) over paged-zones / fit-one-screen / auto-focus alternatives. Confirmed feel: vertical drag, momentum fling, rubber-band ends, auto-center on the current node, a recenter button.

## Design

### Pan viewport

- The Journey body is a **clip container** (`overflow-hidden`, no scrollbar) holding a transformed "world" element (the stacked `UnitSection`s).
- The world pans **vertically only** (the trail is a vertical serpentine; horizontal stays fixed to the column).
- Use **framer-motion** drag instead of hand-rolled pointer math:
  - `drag="y"` on the world element.
  - `dragConstraints={{ top: minY, bottom: 0 }}` where `minY = min(0, viewportHeight - worldHeight)` (0 when the world fits).
  - `dragElastic` (~0.15) for the rubber-band past the ends.
  - `dragMomentum` true for the release fling.
- Heights are measured with refs + `useLayoutEffect`, re-measured via a `ResizeObserver` on the world (fold/expand and content changes update `minY`). The drag `y` is a `useMotionValue`.

### Camera helpers

- **Auto-center on open:** on mount (and when the current lesson changes), animate `y` so the current node sits near the vertical center of the viewport, clamped to `[minY, 0]`.
- **Recenter button** ("↑ You are here"): fixed inside the viewport (not in the world). **Visible only when the current node is off-screen** (outside the viewport bounds, derived from `y` + measured positions). Tapping it animates `y` back to the centered offset.
- Animations use `useAnimationControls().start({ y: target })`.

### Headers

- Unit headers **ride inside the world** (remove the `sticky top-0 z-30 ... backdrop` treatment from `UnitSection`). Sticky depends on native scroll and fights the pan; the header is part of the world.

### Folding

- Collapse-cleared-units folding is retained unchanged; folded units shrink the world, so there is less to pan.

### Accessibility / no-pointer fallback

- Nodes remain tabbable `<button>`s. **Focusing a node that is off-screen auto-centers it** (scroll-into-view equivalent via the same center math).
- **Wheel-to-pan:** a `wheel` handler on the viewport adjusts `y` (clamped), so trackpad/mouse users can move without dragging.
- `prefers-reduced-motion` (via framer `useReducedMotion`): disable momentum and animated recenter — jumps are **instant** (`y` set directly), drag still works 1:1 without fling.
- The recenter button is a real `<button aria-label="Recenter on current lesson">`.

### Testable core (pure helpers)

Extract to `src/components/journey/panMath.ts`:
- `clampPan(y: number, min: number, max: number): number` — clamp `y` into `[min, max]` (`max` is 0).
- `centerOffset(elTop: number, elHeight: number, viewportHeight: number, min: number, max: number): number` — the clamped `y` that centers an element of height `elHeight` at world-offset `elTop` in a viewport of `viewportHeight`.
- `isOffscreen(elTop: number, elHeight: number, y: number, viewportHeight: number): boolean` — whether the element is outside the visible window given pan `y` (drives recenter-button visibility).

These are unit-tested. The framer glue + DOM measurement is thin and verified visually.

## Architecture

- New `src/components/journey/panMath.ts` — the three pure helpers above.
- New `src/components/journey/PanViewport.tsx` — the clip container + draggable world + camera controls (auto-center, recenter button, wheel, reduced-motion). Props: `currentId: string | null` and `children`. Owns refs, motion value, constraints, and the recenter affordance.
- `src/components/JourneyMap.tsx` — replace the `overflow-y-auto` body with `<PanViewport currentId={currentId}>` wrapping the mapped `UnitSection`s. Header stays fixed above it (`grid-rows-[auto_1fr]` unchanged).
- `src/components/journey/UnitSection.tsx` — drop the `sticky top-0 z-30 ... backdrop` classes on the unit header (header rides in-world); keep everything else (the `first:mt-12` beacon clearance for a current first node still applies).

## Out of scope

- No domain / `journeyProgress` / content / store / audio changes.
- No paged-zones or horizontal navigation.
- No persistence of pan position.

## Testing

- New `panMath.test.ts`: `clampPan` clamps both ends and passes through in-range; `centerOffset` centers and clamps at the bounds; `isOffscreen` true when the element is above/below the window, false when visible.
- Keep the existing journey suite green. `JourneyMap.test.tsx` queries node buttons/labels and fold behavior — unaffected by swapping scroll for pan. Add an assertion that the pan viewport container is **not** scrollable (no `overflow-y-auto`) and the recenter button exists.
- jsdom reports zero element sizes, so center/offscreen *DOM* behavior is verified visually (the mockup); the math is covered by `panMath.test.ts`.
- Maintain `npx tsc -b`, `npm run build`, `npx vitest run` green.

## Process

Subagent-driven per task. Branch `journey-redesign` (this builds on the trail work already there). Stage explicit files only; leave the concurrent session's `firebase.json` unstaged. Delete the throwaway `public/journey-pan-mockup.html`, `public/journey-preview.html`, and `src/devPreview.tsx` before finishing.
