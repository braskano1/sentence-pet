# Drill Submit button + intro/egg restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Submit button (appears only when the sentence is full) to `DrillScreen` and `EggHatch`, so grading/audio no longer fire the instant the last word lands; and restyle `EggHatch` to match `DrillScreen`'s visual language.

**Architecture:** A new presentational `SubmitBar` component is shared by both screens. Each screen stops auto-grading on the last placement; instead it mounts `SubmitBar` when every slot is filled and runs its existing grade/hatch logic only on Submit. `EggHatch` markup is updated to the gradient + white-card + centre-stage-egg layout used by `DrillScreen`.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, framer-motion 12, @dnd-kit, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-26-drill-submit-and-intro-restyle-design.md`

**Conventions:** typecheck `npx tsc -b`; tests `npx vitest run <path>`; build `npm run build`. Component tests render framer-motion fine in jsdom (no mock needed); `useRoundFeedback` is mocked to run `play` synchronously (see existing `DrillScreen.test.tsx`). End commits with the `Co-Authored-By: Claude Opus 4.8` trailer.

---

## Task 1: SubmitBar component

**Files:**
- Create: `src/components/drill/SubmitBar.tsx`
- Test: `src/components/drill/SubmitBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/drill/SubmitBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubmitBar } from './SubmitBar';

describe('SubmitBar', () => {
  it('renders a Submit button and calls onSubmit when tapped', () => {
    const onSubmit = vi.fn();
    render(<SubmitBar onSubmit={onSubmit} />);
    const btn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not call onSubmit when disabled', () => {
    const onSubmit = vi.fn();
    render(<SubmitBar onSubmit={onSubmit} disabled />);
    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/drill/SubmitBar.test.tsx`
Expected: FAIL — cannot resolve `./SubmitBar`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/drill/SubmitBar.tsx
import { motion } from 'framer-motion';

export function SubmitBar({ onSubmit, disabled = false }: { onSubmit: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onSubmit}
      disabled={disabled}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full rounded-2xl bg-emerald-500 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 active:scale-[.98] disabled:opacity-50"
    >
      Submit ✓
    </motion.button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/drill/SubmitBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/drill/SubmitBar.tsx src/components/drill/SubmitBar.test.tsx
git commit -m "feat(drill): add shared SubmitBar component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: DrillScreen — defer grading behind Submit

**Files:**
- Modify: `src/components/DrillScreen.tsx` (remove auto-evaluate at line 75; add SubmitBar render between the slots area `</div>` at line 201 and the tray `<div className="pb-2">` at line 203)
- Test: `src/components/DrillScreen.test.tsx` (extend)

- [ ] **Step 1: Write the failing tests**

Add a hoisted `useSpeech` mock at the top of the file (after the existing `vi.mock('./useRoundFeedback', ...)` block) and three new tests. The hoisted spies let us assert `speakSentence` timing.

```tsx
// Add near the other vi.mock calls, before `import { DrillScreen } ...`
const speech = vi.hoisted(() => ({
  speakWord: vi.fn(),
  speakThai: vi.fn(),
  speakSentence: vi.fn(),
}));
vi.mock('../hooks/useSpeech', () => ({ useSpeech: () => speech }));
```

```tsx
// Add inside `describe('DrillScreen', () => { ... })`.
// ITEM answer is ['She','feeds','the cat'] with distractor 'eats'.

it('shows no Submit button until every slot is filled', () => {
  render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('tile-She'));
  fireEvent.click(screen.getByTestId('tile-feeds'));
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('tile-the cat'));
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});

it('does not speak the sentence or grade until Submit is tapped', () => {
  speech.speakSentence.mockClear();
  render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
  fireEvent.click(screen.getByTestId('tile-She'));
  fireEvent.click(screen.getByTestId('tile-feeds'));
  fireEvent.click(screen.getByTestId('tile-the cat'));
  // last word placed, but not yet submitted
  expect(speech.speakSentence).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(speech.speakSentence).toHaveBeenCalledTimes(1);
});

it('hides the Submit button again when a filled slot is cleared', () => {
  render(<DrillScreen items={[ITEM]} drill="pattern" level={1} />);
  fireEvent.click(screen.getByTestId('tile-She'));
  fireEvent.click(screen.getByTestId('tile-feeds'));
  fireEvent.click(screen.getByTestId('tile-the cat'));
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('slot-0')); // tap-to-clear
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: the three new tests FAIL — Submit button never renders, and `speakSentence` is called on the last placement (so the "shows no Submit" / "until Submit is tapped" assertions fail).

- [ ] **Step 3: Implement — defer evaluate and render SubmitBar**

In `src/components/DrillScreen.tsx`:

a) Add the import alongside the other drill imports (near line 17-20):

```tsx
import { SubmitBar } from './drill/SubmitBar';
```

b) In `commit()` (lines 70-76), remove the auto-evaluate line. Change:

```tsx
  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    setWhy(null);
    if (next.placed.every((p) => p !== null)) evaluate(next.placed);
  }
```

to:

```tsx
  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    setWhy(null);
  }
```

c) Add a `ready` derivation next to the existing `stage`/`line` derivations (after line 158):

```tsx
  const ready = placed.every((p) => p !== null);
```

d) Render `SubmitBar` between the slots area block (closes at line 201 `</div>`) and the tray block (`<div className="pb-2">`, line 203):

```tsx
        {ready && !locked && <SubmitBar onSubmit={() => evaluate(placed)} />}

        <div className="pb-2">
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: PASS — all original tests plus the three new ones.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean (no output / exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat(drill): grade only on Submit, not on last word drop

Filling the last slot now reveals a Submit button instead of
auto-evaluating, so the full-sentence audio no longer cuts off the
last word's audio and the player can review before grading.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: EggHatch — defer hatch behind Submit + restyle

**Files:**
- Modify: `src/components/EggHatch.tsx` (remove inline grade at lines 45-48 and 95-98; add `submit()`; restyle render block lines 101-149)
- Test: `src/components/EggHatch.test.tsx` (extend)

- [ ] **Step 1: Write the failing tests**

```tsx
// Add inside `describe('EggHatch', () => { ... })`.
// The tutorial item's answer order is deterministic; tiles are shuffled,
// so fill by clicking each remaining tile until all slots are full.

it('shows no Submit button until all slots are filled, then reveals it', () => {
  render(<EggHatch />);
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  // Fill every slot by tapping tiles (tap-place fills the current slot left-to-right).
  const tileCount = screen.getAllByTestId(/^tile-/).length;
  for (let i = 0; i < tileCount; i++) {
    const tiles = screen.getAllByTestId(/^tile-/);
    fireEvent.click(tiles[0]);
  }
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});

it('renders the Thai hint card with a play-audio button', () => {
  render(<EggHatch />);
  expect(screen.getByRole('button', { name: /hear the meaning/i })).toBeInTheDocument();
});
```

Note: tap-place always fills the leftmost empty slot, so repeatedly tapping the first remaining tile fills the sentence regardless of shuffle order. An incorrect order is fine for this test — it only asserts the Submit button appears once full; it does not tap Submit (which could hatch/reset).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/EggHatch.test.tsx`
Expected: the two new tests FAIL — no Submit button, no "Hear the meaning" button.

- [ ] **Step 3: Implement — defer hatch, add submit(), restyle**

In `src/components/EggHatch.tsx`:

a) Add the import (near line 23-25):

```tsx
import { SubmitBar } from './drill/SubmitBar';
```

b) In `onTapPlace` (lines 38-49), remove the inline grade. Change the tail:

```tsx
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) {
      const correct = isPlacementCorrect(next.placed, item.answer);
      play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
    }
  }
```

to:

```tsx
    setPlaced(next.placed);
    setUsed(next.used);
  }
```

c) In `onDragEnd` (lines 84-99), remove the inline grade. Change the tail:

```tsx
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) {
      const correct = isPlacementCorrect(next.placed, item.answer);
      play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
    }
  }
```

to:

```tsx
    setPlaced(next.placed);
    setUsed(next.used);
  }
```

d) Add a `submit()` function and a `ready` derivation just after `reset()` (after line 61):

```tsx
  const ready = placed.every((p) => p !== null);

  function submit() {
    if (locked || !ready) return;
    const correct = isPlacementCorrect(placed, item.answer);
    play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
  }
```

e) Replace the render block (lines 108-141, the `<div className="flex h-full flex-col bg-indigo-50 p-4"> ... </div>`) with the restyled layout:

```tsx
      <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50 p-4">
        <div className="flex flex-col items-center gap-2 pt-3">
          <motion.img
            src={EGG_SPRITE}
            alt="egg"
            draggable={false}
            className="h-[clamp(3rem,14vh,5rem)] w-auto object-contain"
            animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
          <div className="rounded-2xl bg-white/90 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            Build the sentence to hatch me! ✨
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-slate-800">{item.thaiHint}</span>
            <button
              type="button"
              aria-label="Hear the meaning"
              onClick={() => speak.speakThai(item.thaiHint)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700"
            >
              🔊
            </button>
          </div>
        </div>

        <div
          className={`relative flex flex-1 items-center justify-center rounded-xl ${
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          {feedback && (
            <div
              aria-hidden="true"
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'correct' ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {feedback === 'correct' ? '✓' : '✗'}
            </div>
          )}
        </div>

        {ready && !locked && <SubmitBar onSubmit={submit} />}

        <div className="pb-2">
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>
      </div>
```

Keep the existing test that asserts `/Build the sentence to hatch/` — the new bubble text "Build the sentence to hatch me! ✨" still matches that regex.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/EggHatch.test.tsx`
Expected: PASS — original tests plus the two new ones.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/EggHatch.tsx src/components/EggHatch.test.tsx
git commit -m "feat(egg): Submit button + restyle intro to match the drill

Egg/intro drill now uses the same gradient, white Thai hint card with a
play-audio button, and centre-stage egg as DrillScreen, and grades only
on Submit instead of the instant the last word lands.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full verification + remove demo artifact

**Files:**
- Delete: `drill-demo.html` (brainstorming artifact at repo root)

- [ ] **Step 1: Remove the throwaway demo**

```bash
git rm --ignore-unmatch drill-demo.html 2>/dev/null || rm -f drill-demo.html
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all green (~426 passing baseline + the new SubmitBar/DrillScreen/EggHatch tests; previously-skipped tests still skipped).

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke check (headed Chrome, optional but recommended)**

Per the handoff's emulator/Playwright recipe, reach a drill and the egg page; confirm: filling the last word shows the Submit bar; the last word's audio finishes before tapping Submit; Submit grades and (drill) speaks the sentence; the egg page now shows the gradient + Thai card + Submit.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove drill-demo brainstorming artifact

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** SubmitBar (Task 1) → spec "New component". Defer-grade + appears-when-full + placement-A (Tasks 2,3) → spec "Submit button". EggHatch restyle (Task 3) → spec "EggHatch restyle (→ D)". Tests (Tasks 1-3) → spec "Testing". Demo cleanup (Task 4) → spec "Files touched".
- **No new sentence audio in EggHatch:** preserved — `submit()` only calls `play`/`hatch`/`reset`, matching the spec non-goal.
- **Type/name consistency:** `SubmitBar({ onSubmit, disabled })`, `ready`, `submit()`, `evaluate(placed)` used consistently across tasks.
- **`hint()` path:** unchanged; it routes through `commit()`, which no longer auto-evaluates, so a hint that fills the last slot simply reveals SubmitBar — consistent with manual placement (spec decision).
