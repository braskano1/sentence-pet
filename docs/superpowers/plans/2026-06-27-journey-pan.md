# Journey Drag/Pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Journey trail's vertical scrollbar with a drag-to-pan camera: drag the world up/down (framer-motion momentum + rubber-band), auto-center on the current node, a recenter button, wheel + keyboard fallbacks.

**Architecture:** A new `PanViewport` clips the trail (`overflow-hidden`) and translates a "world" element on Y via framer's `drag`. Pure camera math lives in `panMath.ts` (unit-tested); `PanViewport` is the thin framer/DOM glue. `JourneyMap` swaps its scroll body for `PanViewport`; `UnitSection` drops its sticky header and tags the current node.

**Tech Stack:** React 19 + TypeScript, framer-motion 12 (`drag`, `useMotionValue`, `animate`, `useReducedMotion`), Tailwind v4, Vitest.

**Conventions:** typecheck `npx tsc -b`; test `npx vitest run <path>`; build `npm run build`. Branch `journey-redesign` (builds on the trail work already committed there). Verify branch with `git rev-parse --abbrev-ref HEAD` before every commit. Stage explicit files only — never `git add -A`/`.`; leave the concurrent session's `firebase.json` unstaged. End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- Create `src/components/journey/panMath.ts` — pure camera math: `clampPan`, `centerOffset`, `isOffscreen`.
- Create `src/components/journey/panMath.test.ts` — unit tests for the three helpers.
- Create `src/components/journey/PanViewport.tsx` — clip container + draggable world + auto-center, recenter button, wheel-to-pan, keyboard-focus centering, reduced-motion.
- Modify `src/components/JourneyMap.tsx` — replace the `overflow-y-auto` body with `<PanViewport currentId={currentId}>`.
- Modify `src/components/journey/UnitSection.tsx` — drop the sticky header classes (header rides in-world); tag the current node's wrapper with `data-current="true"`.
- Modify `src/components/JourneyMap.test.tsx` — add a recenter-button-present assertion; keep all existing tests green.

---

## Task 1: Camera math (`panMath.ts`)

**Files:**
- Create: `src/components/journey/panMath.ts`
- Test: `src/components/journey/panMath.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/journey/panMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clampPan, centerOffset, isOffscreen } from './panMath';

describe('panMath', () => {
  it('clampPan keeps y within [min, max]', () => {
    expect(clampPan(-50, -100, 0)).toBe(-50); // in range
    expect(clampPan(20, -100, 0)).toBe(0);     // above max
    expect(clampPan(-200, -100, 0)).toBe(-100); // below min
  });

  it('centerOffset centers an element and clamps at the bounds', () => {
    // el at world-top 500, height 100, viewport 600 -> want -(500 - (300-50)) = -250
    expect(centerOffset(500, 100, 600, -1000, 0)).toBe(-250);
    // element near the top -> want is positive -> clamped to max (0)
    expect(centerOffset(0, 100, 600, -1000, 0)).toBe(0);
    // element far down -> clamped to min
    expect(centerOffset(5000, 100, 600, -1000, 0)).toBe(-1000);
  });

  it('isOffscreen is true when the element is fully above/below the window', () => {
    // y=0, viewport 600: element top 700 is below the window
    expect(isOffscreen(700, 60, 0, 600)).toBe(true);
    // element top 100 is visible
    expect(isOffscreen(100, 60, 0, 600)).toBe(false);
    // panned up by 200: element (top 100, h60) now at -100..-40 -> above window
    expect(isOffscreen(100, 60, -200, 600)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/journey/panMath.test.ts`
Expected: FAIL — cannot resolve `./panMath`.

- [ ] **Step 3: Write the implementation**

Create `src/components/journey/panMath.ts`:

```ts
/**
 * Pure pan-camera math for the Journey trail. `y` is the world's translateY:
 * 0 = top of the world at the top of the viewport; negative pans content up.
 * The valid range is [min, max] with max === 0 and min <= 0.
 */

/** Clamp a pan offset into [min, max]. */
export function clampPan(y: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, y));
}

/**
 * The clamped translateY that vertically centers an element of height `elHeight`
 * sitting at world-offset `elTop` within a viewport of `viewportHeight`.
 */
export function centerOffset(
  elTop: number,
  elHeight: number,
  viewportHeight: number,
  min: number,
  max: number,
): number {
  const want = -(elTop - (viewportHeight / 2 - elHeight / 2));
  return clampPan(want, min, max);
}

/**
 * Whether an element (world-offset `elTop`, height `elHeight`) is fully outside
 * the visible window given the current pan `y` and `viewportHeight`.
 */
export function isOffscreen(
  elTop: number,
  elHeight: number,
  y: number,
  viewportHeight: number,
): boolean {
  const top = elTop + y; // element top in viewport coordinates
  const bottom = top + elHeight;
  return bottom <= 0 || top >= viewportHeight;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/journey/panMath.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/panMath.ts src/components/journey/panMath.test.ts
git commit -m "feat(journey): add pan-camera math helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: PanViewport component

**Files:**
- Create: `src/components/journey/PanViewport.tsx`

No separate test file — this is thin framer/DOM glue over `panMath` (Task 1, unit-tested) and is exercised by the `JourneyMap` integration tests (Task 3) plus visual verification (Task 4). jsdom reports zero element sizes, so its measurement/animation cannot be meaningfully asserted in a unit test.

- [ ] **Step 1: Write the implementation**

Create `src/components/journey/PanViewport.tsx`:

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, animate } from 'framer-motion';
import { PressButton } from '../PressButton';
import { clampPan, centerOffset, isOffscreen } from './panMath';

interface PanViewportProps {
  /** The lesson id of the current node (the camera's home), or null. */
  currentId: string | null;
  children: React.ReactNode;
}

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 30 };

/**
 * Drag-to-pan camera over a tall "world". Replaces native scroll: the viewport
 * clips, the world translates on Y via framer drag (momentum + rubber-band),
 * with auto-centering on the current node, a recenter button, wheel-to-pan,
 * keyboard-focus centering, and an instant path under reduced motion.
 */
export function PanViewport({ currentId, children }: PanViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const reduce = useReducedMotion();
  const [minY, setMinY] = useState(0);
  const [recenterVisible, setRecenterVisible] = useState(false);

  /** Re-measure the pan range; returns the viewport height + min offset. */
  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return { vph: 0, min: 0 };
    const vph = vp.clientHeight;
    const min = Math.min(0, vph - world.scrollHeight);
    setMinY(min);
    return { vph, min };
  }, []);

  /** Current node position within the world (translate-independent) + viewport height. */
  const currentMetrics = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return null;
    const el = world.querySelector<HTMLElement>('[data-current="true"]');
    if (!el) return null;
    const er = el.getBoundingClientRect();
    const wr = world.getBoundingClientRect();
    return { elTop: er.top - wr.top, elHeight: er.height, vph: vp.clientHeight };
  }, []);

  const moveTo = useCallback(
    (target: number, animated: boolean) => {
      if (animated && !reduce) animate(y, target, SPRING);
      else y.set(target);
    },
    [reduce, y],
  );

  const center = useCallback(
    (animated: boolean) => {
      const { vph, min } = measure();
      const m = currentMetrics();
      const target = m ? centerOffset(m.elTop, m.elHeight, vph, min, 0) : 0;
      moveTo(target, animated);
      setRecenterVisible(false);
    },
    [measure, currentMetrics, moveTo],
  );

  const refreshRecenter = useCallback(() => {
    const m = currentMetrics();
    setRecenterVisible(m ? isOffscreen(m.elTop, m.elHeight, y.get(), m.vph) : false);
  }, [currentMetrics, y]);

  // Center on the current node after first paint, and whenever it changes.
  useLayoutEffect(() => {
    center(false);
  }, [center, currentId]);

  // Re-measure on world resize (fold/expand, content changes) and re-clamp y.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const world = worldRef.current;
    if (!world) return;
    const ro = new ResizeObserver(() => {
      const { min } = measure();
      y.set(clampPan(y.get(), min, 0));
      refreshRecenter();
    });
    ro.observe(world);
    return () => ro.disconnect();
  }, [measure, refreshRecenter, y]);

  // Keep the recenter button in sync as the camera moves.
  useEffect(() => {
    const unsub = y.on('change', refreshRecenter);
    return () => unsub();
  }, [y, refreshRecenter]);

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const { min } = measure();
    y.set(clampPan(y.get() - e.deltaY, min, 0));
  };

  // Keyboard tab: bring a focused off-screen node into view.
  const onFocusCapture: React.FocusEventHandler<HTMLDivElement> = (e) => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return;
    const er = (e.target as HTMLElement).getBoundingClientRect();
    const wr = world.getBoundingClientRect();
    const elTop = er.top - wr.top;
    if (isOffscreen(elTop, er.height, y.get(), vp.clientHeight)) {
      const { min } = measure();
      moveTo(centerOffset(elTop, er.height, vp.clientHeight, min, 0), true);
    }
  };

  return (
    <div ref={viewportRef} onWheel={onWheel} className="relative h-full overflow-hidden">
      <motion.div
        ref={worldRef}
        style={{ y }}
        drag="y"
        dragConstraints={{ top: minY, bottom: 0 }}
        dragElastic={0.15}
        dragMomentum={!reduce}
        onDragEnd={refreshRecenter}
        onFocusCapture={onFocusCapture}
        className="px-4 pb-10 pt-2"
      >
        {children}
      </motion.div>

      <PressButton
        onClick={() => center(true)}
        aria-label="Recenter on current lesson"
        aria-hidden={!recenterVisible}
        tabIndex={recenterVisible ? 0 : -1}
        className={`absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-opacity ${
          recenterVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        ↑ You are here
      </PressButton>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/journey/PanViewport.tsx
git commit -m "feat(journey): add PanViewport drag-to-pan camera

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Integrate PanViewport + drop sticky headers + tests

**Files:**
- Modify: `src/components/journey/UnitSection.tsx`
- Modify: `src/components/JourneyMap.tsx`
- Modify: `src/components/JourneyMap.test.tsx`

- [ ] **Step 1: Drop the sticky header and tag the current node in `UnitSection.tsx`**

In `src/components/journey/UnitSection.tsx`, change the unit header wrapper class (remove `sticky top-0 z-30 ... bg-indigo-50/90 ... backdrop-blur`; the header now rides in the world). Replace:

```tsx
      <div className="sticky top-0 z-30 -mx-1 mb-2 flex items-center gap-2 bg-indigo-50/90 px-3 py-2 backdrop-blur">
```

with:

```tsx
      <div className="-mx-1 mb-2 flex items-center gap-2 px-3 py-2">
```

And tag the current node so the camera can find it. Replace the node wrapper:

```tsx
          <div
            key={lesson.id}
            className={`relative z-10 my-3 flex justify-center ${i === 0 && lesson.id === currentId ? 'mt-12' : ''}`}
          >
```

with:

```tsx
          <div
            key={lesson.id}
            data-current={lesson.id === currentId ? 'true' : undefined}
            className={`relative z-10 my-3 flex justify-center ${i === 0 && lesson.id === currentId ? 'mt-12' : ''}`}
          >
```

- [ ] **Step 2: Wire `PanViewport` into `JourneyMap.tsx`**

In `src/components/JourneyMap.tsx`, add the import (alongside the existing journey imports):

```tsx
import { PanViewport } from './journey/PanViewport';
```

Replace the scrollable body:

```tsx
      <div className="space-y-4 overflow-y-auto px-4 pb-10">
        {units.map((unit, index) => {
          const folded = unitDone(unit, stars) && !expanded.has(unit.id);
          return (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <UnitSection
                units={units}
                unit={unit}
                stars={stars}
                currentId={currentId}
                folded={folded}
                onToggle={toggle}
                onStart={startLesson}
              />
            </motion.div>
          );
        })}
      </div>
```

with (wrap the unit list in `PanViewport`; the world supplies horizontal padding, so the inner wrapper only needs vertical rhythm):

```tsx
      <PanViewport currentId={currentId}>
        <div className="space-y-4">
          {units.map((unit, index) => {
            const folded = unitDone(unit, stars) && !expanded.has(unit.id);
            return (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <UnitSection
                  units={units}
                  unit={unit}
                  stars={stars}
                  currentId={currentId}
                  folded={folded}
                  onToggle={toggle}
                  onStart={startLesson}
                />
              </motion.div>
            );
          })}
        </div>
      </PanViewport>
```

Note: the outer shell stays `grid h-full grid-rows-[auto_1fr]`; `PanViewport` occupies row 2 and its root is already `relative h-full overflow-hidden` (Task 2), so it fills the row. No further change needed here.

- [ ] **Step 3: Add a recenter-button test; keep existing tests**

In `src/components/JourneyMap.test.tsx`, add this test inside the `describe('JourneyMap', ...)` block (after the existing tests). The recenter button starts hidden (`aria-hidden`), so query it with `{ hidden: true }`:

```tsx
  it('renders a recenter control for the pan camera', () => {
    render(<JourneyMap />);
    expect(
      screen.getByRole('button', { name: /recenter on current lesson/i, hidden: true }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run the journey tests**

Run: `npx vitest run src/components/JourneyMap.test.tsx src/components/journey`
Expected: PASS — the existing journey tests stay green (nodes/labels/fold are unaffected by swapping scroll for pan) and the new recenter test passes.

- [ ] **Step 5: Full gates**

Run: `npx tsc -b`
Expected: no errors.
Run: `npx vitest run`
Expected: all green (baseline was 629 passed / 13 skipped; this adds `panMath` + the recenter test).

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add src/components/JourneyMap.tsx src/components/journey/UnitSection.tsx src/components/journey/PanViewport.tsx src/components/JourneyMap.test.tsx
git commit -m "feat(journey): replace the scroller with the pan camera

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Visual verification, cleanup, final gates

**Files:**
- Delete: `public/journey-pan-mockup.html`, `public/journey-preview.html`, `src/devPreview.tsx` (throwaway; never committed)

- [ ] **Step 1: Visual check (main thread, sandbox disabled)**

Ensure the dev server is running on a free port (5173–5176/5180 are taken by other sessions): `npm run dev -- --port 5177`. The `src/devPreview.tsx` preview mounts the real `JourneyMap` with seeded stars; open `http://localhost:5177/journey-preview.html?v=progress` and `?v=folded`. Confirm: no scrollbar; dragging the trail pans it with momentum; ends rubber-band; the trail opens centered on the current node; after panning away the "↑ You are here" button appears and recenters on tap; the mouse wheel pans; unit headers move with the world (not stuck to the top).

- [ ] **Step 2: Remove throwaway artifacts**

```bash
git rev-parse --abbrev-ref HEAD
Remove-Item public/journey-pan-mockup.html, public/journey-preview.html, src/devPreview.tsx -Force -ErrorAction SilentlyContinue
```

(All three are untracked, so this only removes untracked files.)

- [ ] **Step 3: Final green gate**

Run: `npx tsc -b` → no errors.
Run: `npm run build` → succeeds.
Run: `npx vitest run` → all green.

- [ ] **Step 4: Confirm a clean tree**

Run: `git status --short`
Expected: only ` M firebase.json` (the concurrent session's — leave it). No journey preview/mockup artifacts remain.

---

## Self-Review

**Spec coverage:**
- Clip container + vertical drag world, no scrollbar → Task 2 (`overflow-hidden`, `drag="y"`), Task 3 wiring. ✓
- framer drag with constraints + elastic + momentum → Task 2. ✓
- Auto-center on open + on current change → Task 2 (`useLayoutEffect` + `center`). ✓
- Recenter button, visible only when current off-screen → Task 2 (`recenterVisible` via `isOffscreen`). ✓
- Headers ride in-world (drop sticky) → Task 3 Step 1. ✓
- Folding retained → unchanged (`folded` prop still passed). ✓
- Wheel-to-pan, keyboard-focus centering, reduced-motion instant → Task 2 (`onWheel`, `onFocusCapture`, `reduce`). ✓
- Testable core `clampPan`/`centerOffset`/`isOffscreen` → Task 1. ✓
- ResizeObserver re-measure (guarded for jsdom) → Task 2. ✓
- Tests: panMath unit tests + recenter button present + suite green → Tasks 1, 3. ✓
- Cleanup + gates → Task 4. ✓

**Placeholder scan:** none — all code/steps are complete.

**Type consistency:** `clampPan(y,min,max)`, `centerOffset(elTop,elHeight,viewportHeight,min,max)`, `isOffscreen(elTop,elHeight,y,viewportHeight)` signatures from Task 1 are used unchanged in Task 2. `PanViewport` prop `currentId` matches `JourneyMap`'s `currentId` (Task 3). `data-current="true"` set in Task 3 Step 1 matches the `[data-current="true"]` query in Task 2. The `h-full` root class is set once, in Task 2's `PanViewport.tsx`.
```
