# Design — Drill Submit button + intro/egg page restyle

**Date:** 2026-06-26
**Status:** Approved (brainstorming)
**Area:** in-round drill UX — `DrillScreen` (exercise) and `EggHatch` (first-time intro/egg drill)

## Problem

1. **Audio stomp / no time to check.** In `DrillScreen`, the moment the last slot is filled, `commit()` calls `evaluate()` (`DrillScreen.tsx:75`), which immediately calls `speak.speakSentence(...)` (`DrillScreen.tsx:108`). The speech provider does `synth.cancel()` before each utterance (`config/audio.ts`), so the still-playing last-word audio is cut off by the full-sentence audio. The player also gets no chance to review the completed sentence before it is graded.
2. **Intro/egg page looks unfinished.** `EggHatch` is the first-time, pre-hatch drill. It uses a plain `bg-indigo-50` layout with no Thai hint card and no audio button, while `DrillScreen` ("Living Drill") uses a warm gradient, a white Thai hint card with a 🔊 button, and a centre-stage pet. The two screens feel like different products.

## Goals

- Add a **Submit button** to both `DrillScreen` and `EggHatch`. Filling the last slot no longer auto-grades; the player taps Submit when ready.
- Restyle `EggHatch` to match `DrillScreen`'s visual language, scaled appropriately for a single-sentence tutorial (no streak/progress/why-tip).

## Non-goals

- No change to scoring, XP, food, persistence, or the reward screen.
- No change to grading logic (`resolveRound`, `gradePlacement`), partial-retry behavior, or the partial-retry tile-unmark edge case noted in the build handoff.
- No new recorded-audio assets; Web Speech seam unchanged.
- `EggHatch` does **not** gain a header, streak chip, progress dots, pet reactions, or why-tip.

## Decisions (locked in brainstorming)

- Submit **appears only when the sentence is full** (every slot filled); it is not a permanently-visible disabled button.
- Placement **A**: a **full-width emerald bar above the word tray**; the tray stays pinned at the bottom in its usual position.
- `EggHatch` restyle is **intro-appropriate** (demo variant **D**): gradient background + white Thai card + egg centre-stage + Submit bar.

## Design

### New component: `src/components/drill/SubmitBar.tsx`

Presentational, shared by both screens.

- **Props:** `{ onSubmit: () => void; disabled?: boolean }`.
- **Render:** full-width button, `rounded-2xl bg-emerald-500 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-500/30`, label `Submit ✓`, `active:scale-[.98]`.
- **Entrance:** framer-motion rise-in (translateY + fade), matching the demo. Mounted only when shown, so the entrance plays each time the sentence becomes full.
- No internal state; parent decides when it is mounted.

### `DrillScreen.tsx` changes

- **Defer evaluation.** Remove the auto-evaluate from `commit()` (`DrillScreen.tsx:75`). `commit()` keeps placement state updates and clearing `why`, but no longer calls `evaluate()`.
- **Ready signal.** Derive `ready = placed.every((p) => p !== null)` (or equivalent) and render `<SubmitBar onSubmit={() => evaluate(placed)} />` between the slots area and the `WordTray` when `ready && !locked`.
- **`evaluate()` unchanged** internally — still the single place that calls `speakSentence`, sets reaction, and runs `applyAction`. It is now reached only via Submit.
- **`hint()`** still fills a slot via `commit()`. If that fills the last slot, SubmitBar appears (no auto-eval). Submit then grades. Consistent with manual placement.
- **Clearing a slot** (`handleClear`) makes `ready` false, so SubmitBar unmounts.
- Last-word `speakWord` continues to fire on tap/drag placement; `speakSentence` now fires only inside `evaluate()` via Submit, so it can no longer cut off the last word.

### `EggHatch.tsx` changes

**Behavior — defer the hatch check.**

- Remove the inline `play(correct ? ... )` from `onTapPlace` (`EggHatch.tsx:45-47`) and `onDragEnd` (`EggHatch.tsx:95-98`).
- When all slots are filled, render `<SubmitBar onSubmit={submit} />` above the tray.
- New `submit()` runs the existing check: `const correct = isPlacementCorrect(placed, item.answer); play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));`
- `EggHatch` has no `speakSentence` today and does not gain one; Submit only defers the existing hatch/reset.

**Style — match `DrillScreen` (variant D).**

- Root: `bg-indigo-50` → `bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50`, layout `flex h-full flex-col gap-3 p-4`.
- Egg centre-stage: keep the bouncing `EGG_SPRITE`, add a white speech bubble below it — `rounded-2xl bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm`, text "Build the sentence to hatch me!".
- Thai hint card matching `DrillScreen.tsx:172-182`: `rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm` containing `item.thaiHint` (`text-xl font-extrabold text-slate-800`) and a 🔊 button (`ml-auto h-9 w-9 rounded-full bg-sky-100 text-sky-700`) wired to `speak.speakThai(item.thaiHint)`.
- Slots area and `WordTray` keep their shared components and existing feedback animation (`flash-correct` / `shake-wrong`, ✓/✗ pop).
- No header, streak, progress dots, pet reaction, or why-tip.

## Component boundaries

- `SubmitBar` — pure presentational; knows nothing about grading. Input: `onSubmit`. Used by both screens → single source of truth for the button's look and entrance.
- `DrillScreen` — owns round/grading state; decides when SubmitBar is mounted and what Submit does (`evaluate`).
- `EggHatch` — owns tutorial state; decides when SubmitBar is mounted and what Submit does (hatch check).

## Testing

Component tests (framer-motion mocked, per `src/App.test.tsx` pattern):

- **DrillScreen**
  - Submit bar is absent until every slot is filled; appears once full.
  - Filling the last slot does **not** call `speakSentence` and does **not** advance/grade.
  - Tapping Submit grades the round (advance/finish/retry) and calls `speakSentence` exactly once for a correct/flagged answer.
  - Clearing a filled slot while full removes the Submit bar.
- **EggHatch**
  - Submit bar appears only when all slots are filled.
  - Filling the last slot does **not** hatch/reset on its own.
  - Tapping Submit with a correct answer hatches; with a wrong answer resets.
  - Renders the Thai hint card and 🔊 button; 🔊 calls `speakThai`.

Full suite must stay green: `npx vitest run`, `npx tsc -b`, `npm run build`.

## Files touched

- **New:** `src/components/drill/SubmitBar.tsx` (+ test)
- **Edit:** `src/components/DrillScreen.tsx`, `src/components/EggHatch.tsx`
- **Tests:** `DrillScreen` and `EggHatch` test files (new or extended)
- Throwaway `drill-demo.html` at repo root is a brainstorming artifact — delete before the work merges.
