# Per-Sentence Feedback (Full Juice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short, locked correct/incorrect feedback phase (green flash + ✓ + confetti on correct; red shake + ✗ + haptic buzz on wrong) after each sentence is fully placed, before the drill advances or retries.

**Architecture:** A feedback phase is inserted between "sentence fully placed" and "apply the round action". Side effects live in a tiny `src/effects/celebrate.ts` (confetti + vibrate). A shared `useRoundFeedback` hook owns the `feedback` state, fires the effects, holds for a timed window, then runs the screen's `onDone` callback. CSS `@keyframes` in `index.css` do the flash/shake/pop. `resolveRound`, scoring, store, and `placeTile` are unchanged — they decide *what* happens; this slice only delays and decorates *when*.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand + Vitest; **new:** `canvas-confetti` (+ `@types/canvas-confetti`).

**Working dir:** `D:\ai_projects\AI_design_thinking\sentence-pet` (git repo, branch `feat/sentence-feedback`, stacked on `feat/drag-and-drop-tiles`). All paths relative to it.

---

### Task 1: Add canvas-confetti and confirm baseline green

**Files:** Modify `package.json` (via npm)

- [ ] **Step 1: Confirm clean baseline**

Run: `npm run test`
Expected: `Tests  62 passed (62)`.

- [ ] **Step 2: Install canvas-confetti + types**

Run: `npm install canvas-confetti && npm install -D @types/canvas-confetti`
Expected: installs cleanly.

- [ ] **Step 3: Confirm still green**

Run: `npm run test && npm run build`
Expected: 62 tests pass, build clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add canvas-confetti for sentence feedback"
```

---

### Task 2: Celebration side effects (`celebrate.ts`)

Thin, mockable wrappers for the two external side effects.

**Files:**
- Create: `src/effects/celebrate.ts`
- Test: `src/effects/celebrate.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/effects/celebrate.test.ts`:

```ts
// src/effects/celebrate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
import confetti from 'canvas-confetti';
import { fireConfetti, buzz } from './celebrate';

describe('fireConfetti', () => {
  beforeEach(() => vi.clearAllMocks());
  it('calls canvas-confetti once', () => {
    fireConfetti();
    expect(confetti).toHaveBeenCalledTimes(1);
  });
});

describe('buzz', () => {
  afterEach(() => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
  it('calls navigator.vibrate with the given duration when available', () => {
    const vibrate = vi.fn();
    (navigator as unknown as { vibrate: unknown }).vibrate = vibrate;
    buzz(50);
    expect(vibrate).toHaveBeenCalledWith(50);
  });
  it('no-ops when navigator.vibrate is unavailable', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    expect(() => buzz()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/effects/celebrate.test.ts`
Expected: FAIL — `./celebrate` does not exist.

- [ ] **Step 3: Write the implementation** — create `src/effects/celebrate.ts`:

```ts
// src/effects/celebrate.ts
import confetti from 'canvas-confetti';

/** Fire a celebratory confetti burst from just below center. */
export function fireConfetti(): void {
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.6 },
  });
}

/** Short haptic buzz on devices that support it; no-op otherwise. */
export function buzz(ms = 60): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/effects/celebrate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/effects/celebrate.ts src/effects/celebrate.test.ts
git commit -m "feat: celebrate effects (confetti + haptic buzz)"
```

---

### Task 3: Feedback engine hook (`useRoundFeedback.ts`)

Owns `feedback` state, fires the effects, holds for a timed window, then runs `onDone`. Shared by both screens.

**Files:**
- Create: `src/components/useRoundFeedback.ts`
- Test: `src/components/useRoundFeedback.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/components/useRoundFeedback.test.ts`:

```ts
// src/components/useRoundFeedback.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../effects/celebrate', () => ({ fireConfetti: vi.fn(), buzz: vi.fn() }));
import { fireConfetti, buzz } from '../effects/celebrate';
import { useRoundFeedback } from './useRoundFeedback';

describe('useRoundFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('correct: sets feedback, fires confetti, calls onDone after 1100ms, then clears', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('correct', onDone));
    expect(result.current.feedback).toBe('correct');
    expect(result.current.locked).toBe(true);
    expect(fireConfetti).toHaveBeenCalledTimes(1);
    expect(buzz).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
    expect(result.current.locked).toBe(false);
  });

  it('wrong: buzzes and calls onDone after 700ms', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRoundFeedback());

    act(() => result.current.play('wrong', onDone));
    expect(result.current.feedback).toBe('wrong');
    expect(buzz).toHaveBeenCalledTimes(1);
    expect(fireConfetti).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(699);
    });
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: FAIL — `./useRoundFeedback` does not exist.

- [ ] **Step 3: Write the implementation** — create `src/components/useRoundFeedback.ts`:

```ts
// src/components/useRoundFeedback.ts
import { useEffect, useRef, useState } from 'react';
import { buzz, fireConfetti } from '../effects/celebrate';

export type Feedback = 'correct' | 'wrong' | null;

const HOLD_MS = { correct: 1100, wrong: 700 } as const;

/**
 * Plays a timed correct/incorrect feedback phase. `play` sets the feedback,
 * fires the side effect, holds for the kind's duration, then clears and runs onDone.
 * `locked` is true for the duration so callers can ignore input.
 */
export function useRoundFeedback() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function play(kind: 'correct' | 'wrong', onDone: () => void) {
    clear();
    setFeedback(kind);
    if (kind === 'correct') fireConfetti();
    else buzz();
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback(null);
      onDone();
    }, HOLD_MS[kind]);
  }

  useEffect(() => clear, []);

  return { feedback, play, locked: feedback !== null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/useRoundFeedback.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/useRoundFeedback.ts src/components/useRoundFeedback.test.ts
git commit -m "feat: useRoundFeedback hook (timed correct/wrong feedback)"
```

---

### Task 4: Feedback CSS keyframes

Real CSS `@keyframes` in `index.css` (matches the existing `.rotate-nudge` pattern). No unit test — verified by build + manual e2e.

**Files:**
- Modify: `src/index.css` (append)

- [ ] **Step 1: Append the keyframes** — add this block to the END of `src/index.css`:

```css

/* --- Per-sentence feedback (see useRoundFeedback) --- */
@keyframes flash-correct {
  0% { background-color: rgb(187 247 208); } /* emerald-200 */
  100% { background-color: transparent; }
}
.flash-correct {
  animation: flash-correct 1.1s ease-out;
}

@keyframes shake-wrong {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
.shake-wrong {
  animation: shake-wrong 0.5s ease-in-out;
}

@keyframes pop-check {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.pop-check {
  animation: pop-check 0.4s ease-out;
}
```

- [ ] **Step 2: Verify build compiles the CSS**

Run: `npm run build`
Expected: clean build (Tailwind v4 + the raw keyframes compile; no errors).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: feedback keyframes (flash, shake, pop)"
```

---

### Task 5: Wire DrillScreen feedback phase

Insert the feedback phase: on full placement, decide via `resolveRound`, `play` the feedback, and apply the action only after the hold. Lock input during feedback. Render the flash/shake class + ✓/✗ overlay.

**Files:**
- Modify: `src/components/DrillScreen.tsx`
- Modify: `src/components/DrillScreen.test.tsx` (add canvas-confetti mock)

- [ ] **Step 1: Rewrite DrillScreen** — REPLACE the entire contents of `src/components/DrillScreen.tsx` with EXACTLY:

```tsx
// src/components/DrillScreen.tsx
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { itemsForLevel } from '../data/wordBank';
import { shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { resolveRound, type RoundAction } from '../domain/round';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';

export function DrillScreen({ level }: { level: number }) {
  const items = useMemo(() => itemsForLevel(level), [level]);
  const finishRound = useGameStore((s) => s.finishRound);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [used, setUsed] = useState<boolean[]>(() => items[0].answer.map(() => false));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(items[0].answer));
  const [mistakes, setMistakes] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();

  const item = items[index];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function loadItem(i: number) {
    setPlaced(items[i].slots.map(() => null));
    setUsed(items[i].answer.map(() => false));
    setTiles(shuffle(items[i].answer));
  }

  function handleClear(slotIndex: number) {
    if (locked) return;
    const word = placed[slotIndex];
    if (word === null) return;
    const next = [...placed];
    next[slotIndex] = null;
    setPlaced(next);
    const ui = used.findIndex((u, i) => u && tiles[i] === word);
    if (ui !== -1) {
      const nextUsed = [...used];
      nextUsed[ui] = false;
      setUsed(nextUsed);
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (locked) return;
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    const next = placeTile({ placed, used }, tiles, from.index, to.index);
    if (next.placed === placed) return; // no-op (slot filled / tile used)
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) evaluate(next.placed);
  }

  function evaluate(filled: (string | null)[]) {
    const action = resolveRound({
      filled,
      answer: item.answer,
      index,
      total: items.length,
      mistakes,
    });
    play(action.type === 'retry' ? 'wrong' : 'correct', () => applyAction(action));
  }

  function applyAction(action: RoundAction) {
    switch (action.type) {
      case 'finish':
        finishRound({ level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
      case 'retry':
        setMistakes((m) => m + 1);
        loadItem(index);
        break;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col bg-slate-100 p-4">
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-slate-500">Sentence {index + 1} of {items.length}</p>
          <p className="text-2xl text-slate-700">{item.thaiHint}</p>
        </div>
        <div
          className={`relative flex flex-1 items-center justify-center rounded-xl ${
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          {feedback && (
            <div
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'correct' ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {feedback === 'correct' ? '✓' : '✗'}
            </div>
          )}
        </div>
        <div className="pb-2">
          <WordTray tiles={tiles} used={used} />
        </div>
      </div>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 px-5 py-3 rounded-xl bg-indigo-600 text-white text-lg font-semibold shadow">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Add the canvas-confetti mock to the DrillScreen test** — REPLACE the entire contents of `src/components/DrillScreen.test.tsx` with EXACTLY:

```tsx
// src/components/DrillScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    render(<DrillScreen level={1} />);
    expect(screen.getByText(/Sentence 1 of 5/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the DrillScreen test**

Run: `npx vitest run src/components/DrillScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean (note: `EggHatch.tsx` does NOT break — it is unchanged and still compiles; it just doesn't have feedback yet, which Task 6 adds).

- [ ] **Step 5: Commit**

```bash
git add src/components/DrillScreen.tsx src/components/DrillScreen.test.tsx
git commit -m "feat: per-sentence feedback phase in DrillScreen"
```

---

### Task 6: Wire EggHatch feedback phase

Same feedback phase for the single onboarding sentence: correct → juice → `hatch()`; wrong → shake/buzz → `reset()`.

**Files:**
- Modify: `src/components/EggHatch.tsx`
- Modify: `src/components/EggHatch.test.tsx` (add canvas-confetti mock)

- [ ] **Step 1: Rewrite EggHatch** — REPLACE the entire contents of `src/components/EggHatch.tsx` with EXACTLY:

```tsx
// src/components/EggHatch.tsx
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { itemsForLevel } from '../data/wordBank';
import { isPlacementCorrect, shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';

export function EggHatch() {
  const hatch = useGameStore((s) => s.hatch);
  const item = useMemo(() => itemsForLevel(1)[0], []);
  const [placed, setPlaced] = useState<(string | null)[]>(() => item.slots.map(() => null));
  const [used, setUsed] = useState<boolean[]>(() => item.answer.map(() => false));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(item.answer));
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function reset() {
    setPlaced(item.slots.map(() => null));
    setUsed(item.answer.map(() => false));
    setTiles(shuffle(item.answer));
  }

  function handleClear(i: number) {
    if (locked) return;
    const word = placed[i];
    if (word === null) return;
    const next = [...placed];
    next[i] = null;
    setPlaced(next);
    const ui = used.findIndex((u, k) => u && tiles[k] === word);
    if (ui !== -1) {
      const nextUsed = [...used];
      nextUsed[ui] = false;
      setUsed(nextUsed);
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (locked) return;
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    const next = placeTile({ placed, used }, tiles, from.index, to.index);
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) {
      const correct = isPlacementCorrect(next.placed, item.answer);
      play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col bg-indigo-50 p-4">
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="text-[clamp(3rem,14vh,5rem)] leading-none">🥚</div>
          <p className="text-slate-600">Build the sentence to hatch your pet!</p>
          <p className="text-2xl text-slate-700">{item.thaiHint}</p>
        </div>
        <div
          className={`relative flex flex-1 items-center justify-center rounded-xl ${
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          {feedback && (
            <div
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'correct' ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {feedback === 'correct' ? '✓' : '✗'}
            </div>
          )}
        </div>
        <div className="pb-2">
          <WordTray tiles={tiles} used={used} />
        </div>
      </div>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 px-5 py-3 rounded-xl bg-indigo-600 text-white text-lg font-semibold shadow">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Add the canvas-confetti mock to the EggHatch test** — REPLACE the entire contents of `src/components/EggHatch.test.tsx` with EXACTLY:

```tsx
// src/components/EggHatch.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { EggHatch } from './EggHatch';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('EggHatch', () => {
  it('renders the egg prompt, hint, and POS slots', () => {
    render(<EggHatch />);
    expect(screen.getByText(/Build the sentence to hatch/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
  });

  it('renders draggable tiles for the answer words', () => {
    render(<EggHatch />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <EggHatch />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: Full green gate**

Run: `npm run test && npm run build`
Expected: ALL tests pass (62 prior + 3 celebrate + 2 hook = 67), build clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/EggHatch.tsx src/components/EggHatch.test.tsx
git commit -m "feat: per-sentence feedback phase in EggHatch"
```

---

### Task 7: Manual e2e

**Files:** none (verification only)

- [ ] **Step 1: Manual e2e on a touch viewport**

Run: `npm run dev` → open the printed URL → DevTools device-toolbar, phone-portrait.
Verify:
- **Hatch:** drag tiles to build the correct sentence → green flash + ✓ + confetti, ~1.1s hold → pet hatches. Build a wrong order → red shake + ✗ (+ buzz on a real phone), ~0.7s → reshuffles.
- **Drill:** each correct sentence → flash + ✓ + confetti, then next; the 5th → reward. A wrong fill → shake + ✗, then retry.
- During the feedback hold, dragging and tapping a slot do nothing (locked).
- No console errors; confetti renders above the column.

- [ ] **Step 2: Note tuning**

If 1100/700ms feels too long/short on repeat, adjust `HOLD_MS` in `src/components/useRoundFeedback.ts`. No code change required to ship if it feels right.

---

## Self-review notes for the implementer

- `resolveRound`, `placeTile`, scoring, store are NOT touched — only the screens' `evaluate` and the new hook/effects.
- The `if (locked) return;` guards in `onDragEnd` and `handleClear` are what make the feedback phase safe — do not omit them.
- `canvas-confetti` is mocked in every test that (transitively) imports it, because it touches the DOM canvas. It is only *called* on the correct path, never at mount.
- The hook clears its timer on unmount and at the start of each `play` — keep both, or a fast replay/unmount can fire a stale `onDone`.
