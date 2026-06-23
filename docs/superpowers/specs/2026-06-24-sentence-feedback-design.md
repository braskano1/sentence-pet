# Spec — Per-Sentence Feedback (Full Juice)

**Date:** 2026-06-24
**Status:** approved, ready for plan
**Phase:** 2, feedback slice. Stacked on `feat/drag-and-drop-tiles` (drag merges first).

## Goal

Add correct/incorrect feedback after each sentence is fully placed, before the round
advances. Today the drill advances/retries **instantly** with no visual or tactile signal.
For pre-A1 kids this removes the dopamine hit on success and the error signal on failure.
This slice adds a short, locked **feedback phase** with full "juice".

## Decided behavior

- **Correct:** green flash over the slots + a ✓ pop + a confetti burst + (subtle) bounce,
  hold ~**1100ms**, then advance to the next sentence (or finish the round).
- **Wrong:** red shake of the slots + a ✗ + a haptic buzz, hold ~**700ms**, then reshuffle
  and retry the same sentence (mistake already counted by existing logic).
- During the feedback hold the screen is **locked**: dragging and tap-to-clear are ignored,
  so no double-advance or input races.
- Applies to **both** the DrillScreen (5 sentences per round) and the EggHatch onboarding
  (1 sentence → hatch). They share the same drag + evaluate pattern, so they share the
  feedback unit.

## Architecture

The feedback phase is inserted between "sentence fully placed" and "apply the round action".
No change to `resolveRound`, scoring, store, or `placeTile` — those stay pure and decide
*what* happens; this slice only delays and decorates *when* it happens.

### New units (small, isolated)

- **`src/effects/celebrate.ts`**
  - `fireConfetti(): void` — wraps `canvas-confetti` (a center-ish burst). Pure side effect.
  - `buzz(ms?: number): void` — wraps `navigator.vibrate`, guarded: no-op when
    `navigator.vibrate` is undefined (desktop, jsdom). Default ~60ms.
  - One responsibility: external "celebration" side effects, isolated so they can be mocked.

- **`src/components/useRoundFeedback.ts`** — custom hook, the shared feedback engine.
  - State: `feedback: 'correct' | 'wrong' | null`.
  - `play(kind: 'correct' | 'wrong', onDone: () => void): void` — sets `feedback = kind`,
    fires `fireConfetti()` on correct / `buzz()` on wrong, starts a timer
    (`correct → 1100ms`, `wrong → 700ms`); on expiry sets `feedback = null` and calls `onDone`.
  - `locked: boolean` — `feedback !== null` (screens use it to ignore input).
  - Clears its timer on unmount (`useEffect` cleanup) to avoid setState-after-unmount.
  - Depends only on `celebrate.ts`. Knows nothing about drills or hatching — the screen
    passes the `onDone` action.

- **CSS `@keyframes` in `src/index.css`** (matches the existing `.rotate-nudge` pattern —
  real CSS, not Tailwind variants):
  - `.flash-correct` — brief green wash/glow on the slots container.
  - `.shake-wrong` — short horizontal red shake on the slots container.
  - `.pop-check` — scale-in pop for the ✓ / ✗ icon overlay.

- **`package.json`** — add `canvas-confetti` (runtime) + `@types/canvas-confetti` (dev).

### Wiring (DrillScreen and EggHatch)

Both screens already have an `evaluate(filled)` path triggered when all slots fill. Change:

```
onDragEnd(e):
  if (locked) return            // NEW: ignore input during feedback
  ... existing placeTile ...
  if (all filled) evaluate(next.placed)

// DrillScreen
evaluate(filled):
  const action = resolveRound({ filled, answer: item.answer, index, total, mistakes })
  const isCorrect = action.type !== 'retry'
  play(isCorrect ? 'correct' : 'wrong', () => applyAction(action))

applyAction(action):              // the OLD evaluate body, unchanged semantics
  finish → finishRound(...)
  advance → setIndex + loadItem
  retry → setMistakes(m=>m+1) + loadItem(index)

// EggHatch
evaluate(filled):
  const correct = isPlacementCorrect(filled, item.answer)
  play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()))
```

The slots wrapper element gets a class derived from `feedback`
(`feedback === 'correct' && 'flash-correct'`, `feedback === 'wrong' && 'shake-wrong'`).
A ✓/✗ overlay renders while `feedback` is non-null with `.pop-check`. `handleClear`
(tap-to-clear) early-returns when `locked`.

## Testing

- **`celebrate.test.ts`** — mock `canvas-confetti`; assert `fireConfetti` calls it. Stub
  `navigator.vibrate`; assert `buzz` calls it, and that it no-ops when `vibrate` is absent.
- **`useRoundFeedback.test.ts`** — Vitest **fake timers** + `@testing-library/react`
  `renderHook`. Mock `celebrate.ts`. Assert: `play('correct', cb)` → `feedback==='correct'`,
  `fireConfetti` called once; advance 1100ms → `cb` called, `feedback` back to `null`.
  `play('wrong', cb)` → `buzz` called, 700ms → `cb`, cleared. This is the real coverage of
  the feedback logic (no DnD needed).
- **Screens** — remain render-only (jsdom can't simulate @dnd-kit drags). Mock
  `canvas-confetti` in those tests as a safety net even though confetti only fires on the
  correct path (never at mount). Verify the screens still mount and render slots/tiles.
- **Gate:** `npm run test` all green + `npm run build` clean.

## Risks / flags

- **canvas-confetti in jsdom:** it touches `document`/canvas. It is only invoked inside
  `play('correct')`, never at import or mount, so render tests are unaffected; the hook test
  mocks it. Keep `fireConfetti` as the only call site.
- **Timer leaks:** the hook MUST clear its timer on unmount and before starting a new `play`,
  or a fast unmount/replay could fire a stale `onDone`.
- **Hold timing is feel-tuned:** 1100/700ms are starting values, adjustable in playtest.

## Out of scope

- Sound effects.
- Reward-screen / level-clear juice (separate polish pass).
- Free Play, difficulty dials, other drills.

## Branch

`feat/sentence-feedback`, stacked on `feat/drag-and-drop-tiles`. Drag merges to `main`
first, then this branch.
