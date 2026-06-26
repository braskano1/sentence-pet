# Drill: reject near-miss grammar + add a drill exit

**Date:** 2026-06-27
**Status:** Approved for planning
**Repo:** `D:\ai_projects\AI_design_thinking\sentence-pet` (`main`). React 19 + TS + Tailwind v4 + Zustand + Firebase.

## Summary

Two independent fixes to the Living Drill, bundled because they touch the same screen:

1. **Reject near-miss grammar.** A subject-verb-agreement near-miss like "She run" (answer "She runs") is currently *accepted* as correct under the `flag` strictness mode. It must be marked **wrong** and force a retry, while still showing the trap's teaching tip. The `flag`/`strictness` mechanic is removed entirely.
2. **Add a drill exit.** There is no way to leave a drill except finishing every item. Add an exit control that returns to the journey map, behind a confirm.

---

## Feature 1 — Near-misses reject instead of accept

### Current behavior (root cause, confirmed)

`src/domain/grade.ts` `gradePlacement`: a placed word that ≠ the answer but matches a registered `trap` returns `status: 'flagged'`, `passes: strictness !== 'enforce'`. So under `strictness: 'flag'` (or undefined) the near-miss **passes** — accepted as correct with a gentle tip, counted as one "slip" but still advancing.

### New behavior

- Any placed word that is not the exact answer is **wrong** and non-passing — including a registered trap word. Only the exact answer advances.
- On a wrong placement that matches a trap, the trap's **tip still shows** (e.g. "เธอ → she walks 👍"). This already works: `round.ts` `firstTrapTip` recomputes the tip from `item.traps` on every non-pass, and `DrillScreen.tsx:138` renders `action.tip` in the `WhyTip`. No new plumbing.
- The `flag`/`enforce` `strictness` dial and the entire `flagged` accept-path are **removed**.
- **Gentle ramp:** none added. Learners stuck on an item use the existing **Hint** button. Difficulty lives in content, not grading leniency.

### Changes by file

| File | Change |
|------|--------|
| `src/data/types.ts` | Remove the `strictness?: 'flag' \| 'enforce'` field from `DrillItem`. Keep `traps` and `GrammarTrap.tip`; update the `tip` comment from "shown on a flagged accept" to "shown on a near-miss retry". |
| `src/domain/grade.ts` | `GradeStatus` → `'ideal' \| 'wrong'`. Remove `'flagged'`, the `flags: string[]` field, and all `strictness` logic. A trap match falls into the wrong path. `slotResults`: a trap slot is now `'wrong'` (so partial retry clears it). |
| `src/domain/round.ts` | `RoundAction`: drop `flags` from the `finish` and `advance` variants. Remove the `grade.status === 'flagged' ? 1 : 0` slip addition (no more flagged-accept slips). Keep `firstTrapTip` — it still feeds the retry tip. |
| `src/components/DrillScreen.tsx` | Delete the `'flag'` feedback branch (line ~110: `kind` is always `'correct'` on a pass). Delete the flags-based streak-reset / mistake-increment in the `advance` case (lines ~120–121) — a pass is always a clean advance now. Remove `'flag'` from the flash/✓ styling (lines ~188, ~197). |
| `src/components/useRoundFeedback.ts` | Remove the `'flag'` feedback kind: drop it from the `Feedback` type, the `HOLD_MS` map, and the `play` signature. `'correct'` and `'wrong'` only. |
| `src/content/seed.ts` | Remove `strictness` from every item. Grammar L1 (`gr-l1-*`) and L2 (`gr-l2-*`) were the *same* 5 sentences differing only by strictness (the gentle→strict ramp). With strictness gone they would be identical, so **replace the 5 L2 grammar items (`gr-l2-*`) with new, harder 3-slot S+V+O agreement sentences** to keep a real difficulty ramp. L1 grammar (2-slot) is unchanged. Pool size stays 30. |
| `src/content/validate.ts` | Keep the trap slot-range check unchanged. |

### Live content

`strictness` is an optional stored field. Once the code stops reading it, existing Firestore docs are harmless — **no migration needed**. A reseed picks up the deduped seed; not required for correctness.

### Tests to update to the new behavior

`src/domain/grade.test.ts`, `src/domain/round.test.ts`, `src/components/DrillScreen.test.tsx`, `src/components/useRoundFeedback.test.ts`, `src/content/seed.test.ts`, and `src/content/validate.test.ts` / `src/content/model.test.ts` if they assert on `strictness`. New assertions: a trap near-miss grades `wrong`, routes to retry, and surfaces its tip; the seed has no `strictness` field; L2 grammar items are the new harder 3-slot sentences and differ from L1.

---

## Feature 2 — Drill exit

### Current behavior

`DrillScreen` / `DrillHeader` have no back/exit control. The only way out is completing all items (`finishRound` → reward). Drills launch from `JourneyMap` (the `pickDrill` screen) via `startDrill`.

### New behavior

- Add an exit control (✕) to `DrillHeader`, placed left of the streak chip.
- Tapping ✕ opens a small **confirm**: "Leave drill? Your progress won't be saved" with **Leave** and **Stay** actions.
- **Leave** → `setScreen('pickDrill')` (back to the journey map). Round state is component-local, so it is discarded with no `finishRound` call — no stars, coins, or XP awarded.
- **Stay** → dismiss the confirm, drill continues unchanged.

### Changes by file

| File | Change |
|------|--------|
| `src/components/drill/DrillHeader.tsx` | Add an `onExit: () => void` prop. Render a ✕ button left of the streak chip (`aria-label="Leave drill"`, min 44px touch target). |
| `src/components/DrillScreen.tsx` | Add `const setScreen = useGameStore((s) => s.setScreen)`. Add local `confirmExit` state. Pass `onExit={() => setConfirmExit(true)}` to `DrillHeader`. Render an inline confirm overlay when `confirmExit` is true — a centered rounded card over a dimmed backdrop, reusing the app's `PressButton`; **Leave** calls `setScreen('pickDrill')`, **Stay** clears `confirmExit`. The overlay must sit above the drill content and block input to it. |

No new shared component — the confirm is a local overlay in `DrillScreen` matching the app's rounded-card / `PressButton` style. If the confirm proves reusable later, extract then (YAGNI now).

### Tests

`src/components/DrillScreen.test.tsx`: ✕ opens the confirm; **Stay** dismisses and keeps the drill mounted; **Leave** sets `screen` to `'pickDrill'` in the store and does not call `finishRound`.

---

## Out of scope

- Severity tiers / per-trap soft-vs-hard distinction (rejected in favor of "reject all").
- Any new gentle-difficulty mechanic (existing Hint covers it).
- Saving or resuming abandoned-drill progress.
- A reusable shared confirm/modal component.

## Verification

Per `superpowers:verification-before-completion`, after implementation verify live in headed Chrome (run/QA recipe in the companion handoff `drill-page-improve-handoff.md`):
1. Build the "She runs" grammar item; place "She run"; confirm it is **rejected** with a shake + the trap tip, and does not advance.
2. Mid-drill, tap ✕ → confirm appears → **Leave** returns to the journey map with no reward.
