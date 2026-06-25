# App-wide animation / interaction polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify interaction feedback app-wide — a shared `PressButton`, DrillPicker stagger-in + taps, button squish across PetRoom/RewardScreen, SentenceSlots drop juice, and minor egg/flag-tip polish.

**Architecture:** Purely presentational. A new `PressButton` (`motion.button` wrapper) centralizes the tap squish; the rest are framer-motion wrappers around existing markup. No store / persist / domain / config change. Global `MotionConfig reducedMotion="user"` (App.tsx) gates all transforms.

**Tech Stack:** React 19 + framer-motion + Tailwind v4 + @dnd-kit + Vitest. Component tests are render-only.

Spec: `docs/superpowers/specs/2026-06-25-app-animation-polish-design.md`.

**Conventions (carry forward):**
- Typecheck = `npx tsc -b` (NOT `tsc --noEmit`). `npm run build` runs it.
- Tests: `npm test -- --run`. Render-only — never assert animated style values. Mock confetti where a test imports `celebrate`: `vi.mock('canvas-confetti', () => ({ default: vi.fn() }))`.
- Queries: `userEvent` + `getByRole`/`getByText`.
- Verify `git branch --show-current` is `shop-economy` before committing. LF→CRLF warnings cosmetic.

---

## File Structure

- Create `src/components/PressButton.tsx` — shared tap-squish button wrapper.
- Create `src/components/PressButton.test.tsx` — render test.
- Modify `src/components/DrillPicker.tsx` — card stagger-in + chips/Back → PressButton.
- Modify `src/components/PetRoom.tsx` — Play/Feed/Shop → PressButton.
- Modify `src/components/RewardScreen.tsx` — Continue → PressButton.
- Modify `src/components/SentenceSlots.tsx` — slot swell on isOver + word pop-in.
- Modify `src/components/EggHatch.tsx` — egg idle bob.
- Modify `src/components/DrillScreen.tsx` — flag-tip fade-in.

No logic/state files touched.

---

### Task 1: `PressButton` shared component

**Files:**
- Create: `src/components/PressButton.tsx`
- Test: `src/components/PressButton.test.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/PressButton.tsx
import { motion, type HTMLMotionProps } from 'framer-motion';

type PressButtonProps = HTMLMotionProps<'button'>;

/**
 * A button with a consistent press-squish. Forwards all native button props
 * (className, onClick, disabled, children, ...). whileTap is suppressed when disabled.
 */
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

- [ ] **Step 2: Write the test**

```tsx
// src/components/PressButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PressButton } from './PressButton';

describe('PressButton', () => {
  it('renders children and forwards className', () => {
    render(<PressButton className="my-class">Hello</PressButton>);
    const btn = screen.getByRole('button', { name: 'Hello' });
    expect(btn).toHaveClass('my-class');
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<PressButton onClick={onClick}>Tap</PressButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Tap' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<PressButton disabled onClick={onClick}>Nope</PressButton>);
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- --run src/components/PressButton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -b
git add src/components/PressButton.tsx src/components/PressButton.test.tsx
git commit -m "feat: PressButton shared tap-squish wrapper"
```

---

### Task 2: DrillPicker — stagger-in cards + PressButton taps

**Files:**
- Modify: `src/components/DrillPicker.tsx`
- Test: `src/components/DrillPicker.test.tsx` (run only; should stay green)

- [ ] **Step 1: Edit `DrillPicker.tsx`**

Add imports at the top (after the existing imports):
```ts
import { motion } from 'framer-motion';
import { PressButton } from './PressButton';
```

Change the Back button from:
```tsx
        <button
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </button>
```
to:
```tsx
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </PressButton>
```

Change the card map. From:
```tsx
        {DRILLS.map(({ drill, title }) => {
          const meta = FOOD_META[DRILL_FOOD[drill]];
          const levels = levelsFor(drill);
          return (
            <div
              key={drill}
              className="flex items-center gap-4 rounded-2xl bg-white p-6 text-left shadow"
            >
```
to:
```tsx
        {DRILLS.map(({ drill, title }, index) => {
          const meta = FOOD_META[DRILL_FOOD[drill]];
          const levels = levelsFor(drill);
          return (
            <motion.div
              key={drill}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex items-center gap-4 rounded-2xl bg-white p-6 text-left shadow"
            >
```

Change the level chip from:
```tsx
                  <button
                    key={level}
                    onClick={() => startDrill(drill, level)}
                    className="min-h-11 min-w-11 rounded-xl bg-indigo-100 px-3 font-semibold text-indigo-700"
                  >
                    L{level}
                  </button>
```
to:
```tsx
                  <PressButton
                    key={level}
                    onClick={() => startDrill(drill, level)}
                    className="min-h-11 min-w-11 rounded-xl bg-indigo-100 px-3 font-semibold text-indigo-700"
                  >
                    L{level}
                  </PressButton>
```

Change the card's closing tag from `</div>` (the one matching the opened card element) to `</motion.div>`.

- [ ] **Step 2: Run the existing DrillPicker test + typecheck**

Run: `npm test -- --run src/components/DrillPicker.test.tsx`
Expected: PASS unchanged (queries are by role/text; PressButton still renders a `button`).
Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/DrillPicker.tsx
git commit -m "feat: DrillPicker stagger-in cards + PressButton taps"
```

---

### Task 3: PetRoom + RewardScreen — PressButton

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Modify: `src/components/RewardScreen.tsx`
- Tests: `src/components/PetRoom.test.tsx`, `src/components/RewardScreen.test.tsx` (run only)

- [ ] **Step 1: Edit `PetRoom.tsx`**

Add import (after existing imports):
```ts
import { PressButton } from './PressButton';
```

Change the Feed button from:
```tsx
              <button
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className={`min-h-12 flex-1 rounded-xl ${FOOD_META[g].color} px-4 py-3 text-base font-semibold text-white shadow`}
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </button>
```
to (same content, `button` → `PressButton`):
```tsx
              <PressButton
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className={`min-h-12 flex-1 rounded-xl ${FOOD_META[g].color} px-4 py-3 text-base font-semibold text-white shadow`}
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </PressButton>
```

Change the Shop button from:
```tsx
        <button
          onClick={() => setScreen('shop')}
          className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Shop 🛒
        </button>
```
to:
```tsx
        <PressButton
          onClick={() => setScreen('shop')}
          className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Shop 🛒
        </PressButton>
```

Change the Play button from:
```tsx
        <button
          onClick={() => setScreen('pickDrill')}
          className="min-h-12 w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </button>
```
to:
```tsx
        <PressButton
          onClick={() => setScreen('pickDrill')}
          className="min-h-12 w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </PressButton>
```

- [ ] **Step 2: Edit `RewardScreen.tsx`**

Add import (after the existing `framer-motion` import):
```ts
import { PressButton } from './PressButton';
```

Change the Continue button from:
```tsx
      <button
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </button>
```
to:
```tsx
      <PressButton
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </PressButton>
```

- [ ] **Step 3: Run both tests + typecheck**

Run: `npm test -- --run src/components/PetRoom.test.tsx src/components/RewardScreen.test.tsx`
Expected: PASS unchanged (role/text queries unaffected; the existing Feed-button test uses `getByRole('button', { name: /feed/i })` which still matches).
Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/PetRoom.tsx src/components/RewardScreen.tsx
git commit -m "feat: PressButton in PetRoom + RewardScreen"
```

---

### Task 4: SentenceSlots — drop swell + word pop-in

**Files:**
- Modify: `src/components/SentenceSlots.tsx`
- Test: `src/components/SentenceSlots.test.tsx` (run only)

- [ ] **Step 1: Edit `SentenceSlots.tsx`**

Add import at the top:
```ts
import { motion } from 'framer-motion';
```

Replace the entire `Slot` component's `return (...)` with this (button → `motion.button`, swell on isOver, word token wrapped in `motion.span`):
```tsx
  return (
    <motion.button
      ref={setNodeRef}
      onClick={() => !empty && onClear(index)}
      animate={{ scale: isOver && empty ? 1.06 : 1 }}
      transition={{ duration: 0.15 }}
      className={`min-h-12 min-w-20 px-4 py-3 rounded-xl border-2 border-dashed text-lg font-semibold ${
        isOver && empty ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'
      }`}
    >
      <span className="block text-xs text-slate-400">{label}</span>
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
    </motion.button>
  );
```

(Note: `word` is non-null inside the `else` branch because `empty === (word === null)`. `displayToken(word, index)` keeps the existing capitalize-first behavior.)

- [ ] **Step 2: Run the existing SentenceSlots test + typecheck**

Run: `npm test -- --run src/components/SentenceSlots.test.tsx`
Expected: PASS unchanged. (Tests query slot text/labels/roles; the placed word still renders as text inside the button.)
Run: `npx tsc -b`
Expected: clean. If TS complains that `word` is possibly null inside the `motion.span`, change `key={word}` / `displayToken(word, index)` to use `word as string` is NOT needed — the `empty ? ... : ...` ternary already narrows `word` to `string` in the else branch; if the compiler does not narrow (because `empty` is a separate const), inline the check instead: replace `{empty ? (...) : (...)}` with `{word === null ? (<span className="block text-slate-900"> </span>) : (<motion.span key={word} ...>{displayToken(word, index)}</motion.span>)}`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SentenceSlots.tsx
git commit -m "feat: SentenceSlots drop swell + word pop-in"
```

---

### Task 5: Minor polish — egg bob + flag-tip fade

**Files:**
- Modify: `src/components/EggHatch.tsx`
- Modify: `src/components/DrillScreen.tsx`
- Tests: `src/components/EggHatch.test.tsx`, `src/components/DrillScreen.test.tsx` (run only)

- [ ] **Step 1: Edit `EggHatch.tsx`**

Add import at the top (after the existing react import line):
```ts
import { motion } from 'framer-motion';
```

Change the egg element from:
```tsx
          <div className="text-[clamp(3rem,14vh,5rem)] leading-none">🥚</div>
```
to:
```tsx
          <motion.div
            className="text-[clamp(3rem,14vh,5rem)] leading-none"
            animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            🥚
          </motion.div>
```

- [ ] **Step 2: Edit `DrillScreen.tsx`**

Add import at the top (after the dnd-kit import block / with the other imports):
```ts
import { motion } from 'framer-motion';
```

Change the flag-tip box from:
```tsx
          {feedback === 'flag' && tip && (
            <div className="pointer-events-none absolute bottom-2 rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-semibold text-sky-800 shadow">
              {tip}
            </div>
          )}
```
to:
```tsx
          {feedback === 'flag' && tip && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute bottom-2 rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-semibold text-sky-800 shadow"
            >
              {tip}
            </motion.div>
          )}
```

- [ ] **Step 3: Run both tests + typecheck**

Run: `npm test -- --run src/components/EggHatch.test.tsx src/components/DrillScreen.test.tsx`
Expected: PASS unchanged. (EggHatch test asserts the prompt text / drag behavior; DrillScreen test asserts sentence counter / drag behavior — neither asserts the egg tag or tip animation.)
Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/EggHatch.tsx src/components/DrillScreen.tsx
git commit -m "feat: egg idle bob + flag-tip fade-in"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + full suite + build**

```bash
npx tsc -b
npm test -- --run
npm run build
```
Expected: tsc clean, all tests PASS, build clean.

- [ ] **Step 2: Manual verification (dev server)**

`npm run dev -- --host` → open on phone/LAN. Verify:
- DrillPicker: cards stagger in; L-chips + Back squish on tap.
- PetRoom: Play / Feed / Shop squish on tap.
- Drill: dragging a tile into a slot → slot swells while hovering, word pops in on landing.
- RewardScreen: Continue squishes.
- EggHatch: egg gently bobs; (flag-tip fades in during a Grammar flag accept).

(No commit — observation only.)

---

## Finishing

When green: this completes the animation polish. Branch `shop-economy` → PR → merge-commit (PR #5), per the PR #2/#3/#4 pattern. Use `superpowers:finishing-a-development-branch`.

## Self-review notes

- **Spec coverage:** PressButton (Task 1) ✓; DrillPicker stagger + chips/Back (Task 2, gaps A + part of B) ✓; PetRoom Play/Feed/Shop + RewardScreen Continue (Task 3, rest of B) ✓; SentenceSlots swell + word pop (Task 4, gap C) ✓; egg bob + flag-tip fade (Task 5, gap D) ✓; full verify (Task 6) ✓.
- **No churn:** Shop Back + TreatCard untouched (per spec).
- **No logic change:** no task edits store/domain/config; all wrappers preserve handlers, dnd-kit refs, and store reads.
- **Type consistency:** `PressButton` (HTMLMotionProps<'button'>) used identically in Tasks 2–3; `motion` import added wherever used (DrillPicker, SentenceSlots, EggHatch, DrillScreen).
- **Render-only tests:** only PressButton adds a behavior test; all other tasks rely on existing tests staying green.
