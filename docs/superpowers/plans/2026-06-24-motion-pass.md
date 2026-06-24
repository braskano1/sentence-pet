# Motion Pass (framer-motion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add motion across four areas — screen transitions, pet life, reward juice, and number/bar motion — with framer-motion, so the game feels alive and the care-loop bars are legible. No new art assets.

**Architecture:** framer-motion for all motion; one global `<MotionConfig reducedMotion="user">` handles `prefers-reduced-motion`. A small `useCountUp` hook tweens numbers and a pure `barColor` helper drives low-value warn colors — both unit-tested, keeping framer-motion internals out of the test surface. Screens stay render-testable because `motion.*` elements render as plain DOM in jsdom.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand + Vitest; **new:** `framer-motion`.

**Working dir:** `D:\ai_projects\AI_design_thinking\sentence-pet` (git repo, branch `feat/motion-pass`, stacked on `feat/sentence-feedback`). Baseline: **68 tests** passing. All paths relative to the repo root.

---

## Slice 1 — Foundation

### Task 1: Add framer-motion + global reduced-motion config

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/App.tsx`

- [ ] **Step 1: Confirm baseline**

Run: `npm run test`
Expected: `Tests  68 passed (68)`.

- [ ] **Step 2: Install framer-motion**

Run: `npm install framer-motion`
Expected: installs (a React-19 peer warning is acceptable; an install error is not — if it errors, pin to a React-19-compatible version and note it).

- [ ] **Step 3: Stub `window.matchMedia` in the test setup** — framer-motion's `reducedMotion="user"` reads `window.matchMedia`, which jsdom does not provide. REPLACE the entire contents of `src/test/setup.ts` with EXACTLY:

```ts
import '@testing-library/jest-dom';

// jsdom lacks matchMedia; framer-motion's reducedMotion="user" reads it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 4: Wrap the app in MotionConfig** — REPLACE the entire contents of `src/App.tsx` with EXACTLY:

```tsx
import { MotionConfig } from 'framer-motion';
import { useGameStore } from './state/gameStore';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => s.pet.hatched);

  if (!hatched) return <EggHatch />;
  switch (screen) {
    case 'drill': return <DrillScreen level={1} />;
    case 'reward': return <RewardScreen />;
    case 'petRoom':
    default: return <PetRoom />;
  }
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <CurrentScreen />
      </AppShell>
    </MotionConfig>
  );
}
```

- [ ] **Step 5: Confirm green + note bundle size**

Run: `npm run test && npm run build`
Expected: 68 tests pass, build clean. Note the new JS bundle size from the build output (framer-motion adds ~30–50kb gzipped).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/test/setup.ts
git commit -m "build: add framer-motion with global reduced-motion config"
```

---

### Task 2: `useCountUp` number-tween hook

**Files:**
- Create: `src/effects/useCountUp.ts`
- Test: `src/effects/useCountUp.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/effects/useCountUp.test.ts`:

```ts
// src/effects/useCountUp.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

describe('useCountUp', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial target immediately', () => {
    const { result } = renderHook(({ t }) => useCountUp(t, 600), { initialProps: { t: 10 } });
    expect(result.current).toBe(10);
  });

  it('animates to a new target and lands exactly on it', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 600), { initialProps: { t: 0 } });
    rerender({ t: 100 });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(100);
  });

  it('is partway between old and new before the duration elapses', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 1000), { initialProps: { t: 0 } });
    rerender({ t: 100 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/effects/useCountUp.test.ts`
Expected: FAIL — `./useCountUp` does not exist.

- [ ] **Step 3: Write the implementation** — create `src/effects/useCountUp.ts`:

```ts
// src/effects/useCountUp.ts
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a displayed integer from its previous value to `target` over `durationMs`,
 * using the requestAnimationFrame timestamp (no dependency on performance.now, so it is
 * drivable by Vitest fake timers). Returns the current tweened integer.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    function tick(now: number) {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(from + (target - from) * t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/effects/useCountUp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/effects/useCountUp.ts src/effects/useCountUp.test.ts
git commit -m "feat: useCountUp number-tween hook"
```

---

## Slice 2 — Number & bar motion

### Task 3: `barColor` helper (low-value warn)

**Files:**
- Create: `src/domain/bars.ts`
- Test: `src/domain/bars.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/domain/bars.test.ts`:

```ts
// src/domain/bars.test.ts
import { describe, it, expect } from 'vitest';
import { barColor } from './bars';

describe('barColor', () => {
  it('uses the healthy identity color at or above 30', () => {
    expect(barColor(30, 'bg-orange-500')).toBe('bg-orange-500');
    expect(barColor(100, 'bg-rose-500')).toBe('bg-rose-500');
  });
  it('warns amber below 30', () => {
    expect(barColor(29, 'bg-orange-500')).toBe('bg-amber-500');
    expect(barColor(15, 'bg-orange-500')).toBe('bg-amber-500');
  });
  it('alarms red below 15', () => {
    expect(barColor(14, 'bg-orange-500')).toBe('bg-red-500');
    expect(barColor(0, 'bg-rose-500')).toBe('bg-red-500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/bars.test.ts`
Expected: FAIL — `./bars` does not exist.

- [ ] **Step 3: Write the implementation** — create `src/domain/bars.ts`:

```ts
// src/domain/bars.ts

/** Bar fill color: identity color when healthy, amber when low, red when critical. */
export function barColor(value: number, healthyColor: string): string {
  if (value < 15) return 'bg-red-500';
  if (value < 30) return 'bg-amber-500';
  return healthyColor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/bars.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/bars.ts src/domain/bars.test.ts
git commit -m "feat: barColor helper (low-value warn colors)"
```

---

### Task 4: Animated StatBars (width + count-up label + highlight + warn color)

**Files:**
- Modify: `src/components/StatBars.tsx`
- Modify: `src/index.css` (append a pulse keyframe)
- Test: `src/components/StatBars.test.tsx` (create)

- [ ] **Step 1: Append the pulse keyframe** — add to the END of `src/index.css`:

```css

/* --- Stat bar change highlight --- */
@keyframes bar-pulse {
  0% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7); }
  100% { box-shadow: 0 0 0 6px rgba(250, 204, 21, 0); }
}
.bar-pulse {
  animation: bar-pulse 0.5s ease-out;
}
```

- [ ] **Step 2: Write the failing test** — create `src/components/StatBars.test.tsx`:

```tsx
// src/components/StatBars.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatBars } from './StatBars';

describe('StatBars', () => {
  const bars = { protein: 50, veggie: 50, vitamin: 50, treat: 50 };

  it('renders a row for health, happiness, and protein with their values', () => {
    render(<StatBars bars={bars} happiness={42} />);
    expect(screen.getByText(/Health/)).toBeInTheDocument();
    expect(screen.getByText(/Happiness/)).toBeInTheDocument();
    expect(screen.getByText(/Protein/)).toBeInTheDocument();
    // health = min(bars) = 50, happiness shown as 42
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails (or passes trivially) before refactor**

Run: `npx vitest run src/components/StatBars.test.tsx`
Expected: it should compile against the current StatBars; if the `42` assertion fails because the label format differs, the refactor in Step 4 makes it pass. Proceed to Step 4.

- [ ] **Step 4: Write the implementation** — REPLACE the entire contents of `src/components/StatBars.tsx` with EXACTLY:

```tsx
// src/components/StatBars.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { NutritionBars } from '../data/types';
import { health } from '../domain/pet';
import { barColor } from '../domain/bars';
import { useCountUp } from '../effects/useCountUp';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const shown = useCountUp(value);
  const prev = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 500);
      return () => clearTimeout(id);
    }
  }, [value]);

  return (
    <div className="w-64">
      <div className="flex justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span>{shown}</span>
      </div>
      <div className={`h-3 rounded-full bg-slate-200 overflow-hidden ${pulsing ? 'bar-pulse' : ''}`}>
        <motion.div
          className={`h-full ${barColor(value, color)}`}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function StatBars({ bars, happiness }: { bars: NutritionBars; happiness: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Bar label="❤️ Health" value={health(bars)} color="bg-rose-500" />
      <Bar label="😊 Happiness" value={happiness} color="bg-yellow-400" />
      <Bar label="🥩 Protein" value={bars.protein} color="bg-orange-500" />
    </div>
  );
}
```

- [ ] **Step 5: Run the StatBars test + full suite**

Run: `npx vitest run src/components/StatBars.test.tsx && npm run test`
Expected: StatBars test passes; full suite green.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/StatBars.tsx src/components/StatBars.test.tsx src/index.css
git commit -m "feat: animated stat bars (width, count-up, pulse, warn color)"
```

---

### Task 5: Count-up XP/coins in PetRoom + stagger-in tray tiles

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Modify: `src/components/WordTray.tsx`

- [ ] **Step 1: Animate PetRoom XP/coins** — In `src/components/PetRoom.tsx`, add this import near the top (after the existing imports):

```tsx
import { useCountUp } from '../effects/useCountUp';
```

Then, inside the `PetRoom` component body, AFTER the existing `const` hooks (e.g. after `const setScreen = ...`), add:

```tsx
  const xp = useCountUp(pet.xp);
  const coins = useCountUp(pet.coins);
```

Then REPLACE the existing XP/coins line:

```tsx
        <p className="text-slate-500">XP {pet.xp} · 🪙 {pet.coins}</p>
```

with:

```tsx
        <p className="text-slate-500">XP {xp} · 🪙 {coins}</p>
```

- [ ] **Step 2: Stagger-in tray tiles** — REPLACE the entire contents of `src/components/WordTray.tsx` with EXACTLY:

```tsx
// src/components/WordTray.tsx
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
}

function Tile({ word, index }: { word: string; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <motion.button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      className={`min-h-12 touch-none px-5 py-3 rounded-xl bg-indigo-500 text-white text-lg font-semibold shadow active:scale-95 ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {word}
    </motion.button>
  );
}

export function WordTray({ tiles, used }: Props) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {tiles.map((word, i) =>
        used[i] ? null : <Tile key={`tile-${i}`} word={word} index={i} />,
      )}
    </div>
  );
}
```

Note: `motion.button` still forwards the dnd-kit `ref`, `listeners`, and `attributes`, so dragging is unchanged; only an entrance animation is added.

- [ ] **Step 3: Run the full suite + build**

Run: `npm run test && npm run build`
Expected: all green (the existing WordTray and PetRoom tests still pass — `motion.button` renders as a button in jsdom). Build clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/PetRoom.tsx src/components/WordTray.tsx
git commit -m "feat: count-up XP/coins and stagger-in tray tiles"
```

---

## Slice 3 — Pet life

### Task 6: Idle bob, feed bounce, evolution pop in PetSprite

**Files:**
- Modify: `src/components/PetSprite.tsx`
- Modify: `src/components/PetRoom.tsx` (pass a feed trigger)

- [ ] **Step 1: Rewrite PetSprite** — REPLACE the entire contents of `src/components/PetSprite.tsx` with EXACTLY:

```tsx
// src/components/PetSprite.tsx
import { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { PetStage } from '../data/types';

const ART: Record<PetStage, string> = {
  egg: '🥚',
  baby: '🐣',
  young: '🐕',
  adult: '🐕‍🦺',
};

/**
 * Pet emoji with: a gentle infinite idle bob, a one-shot bounce when `feedTrigger`
 * increments, and a scale pop when `stage` changes (evolution).
 */
export function PetSprite({ stage, feedTrigger = 0 }: { stage: PetStage; feedTrigger?: number }) {
  const controls = useAnimationControls();
  const prevStage = useRef(stage);
  const prevFeed = useRef(feedTrigger);

  // feed bounce
  useEffect(() => {
    if (prevFeed.current !== feedTrigger) {
      prevFeed.current = feedTrigger;
      controls.start({ scale: [1, 1.3, 0.95, 1], transition: { duration: 0.5 } });
    }
  }, [feedTrigger, controls]);

  // evolution pop
  useEffect(() => {
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      controls.start({ scale: [1, 1.6, 1], rotate: [0, -8, 8, 0], transition: { duration: 0.7 } });
    }
  }, [stage, controls]);

  return (
    <motion.div
      className="select-none leading-none text-[clamp(4rem,18vh,8rem)]"
      aria-label={`pet-${stage}`}
      animate={controls}
      // idle bob runs as the base animation; controls.start overrides briefly then it resumes
      initial={false}
    >
      <motion.div
        animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      >
        {ART[stage]}
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Pass a feed trigger from PetRoom** — In `src/components/PetRoom.tsx`:

(a) add `useState` to the React import — change `import { useGameStore } from '../state/gameStore';` block region so a React import exists. At the top add:

```tsx
import { useState } from 'react';
```

(b) Inside the component, add a feed-trigger counter and bump it when feeding. Find:

```tsx
  const feedAll = useGameStore((s) => s.feedAll);
```

and AFTER it add:

```tsx
  const [feedTrigger, setFeedTrigger] = useState(0);
```

(c) Change the Feed button's handler from `onClick={feedAll}` to:

```tsx
          onClick={() => {
            feedAll();
            setFeedTrigger((n) => n + 1);
          }}
```

(d) Pass the trigger to the sprite — change `<PetSprite stage={stage} />` to:

```tsx
        <PetSprite stage={stage} feedTrigger={feedTrigger} />
```

- [ ] **Step 3: Run the full suite + build**

Run: `npm run test && npm run build`
Expected: green (PetRoom/PetSprite render-based tests still pass; `motion.div` renders as div). Build clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/PetSprite.tsx src/components/PetRoom.tsx
git commit -m "feat: pet idle bob, feed bounce, evolution pop"
```

---

## Slice 4 — Reward juice

### Task 7: RewardScreen confetti + staggered entrance + count-up

**Files:**
- Modify: `src/components/RewardScreen.tsx`
- Test: `src/components/RewardScreen.test.tsx` (update — add canvas-confetti mock)

- [ ] **Step 1: Rewrite RewardScreen** — REPLACE the entire contents of `src/components/RewardScreen.tsx` with EXACTLY:

```tsx
// src/components/RewardScreen.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { fireConfetti } from '../effects/celebrate';
import { useCountUp } from '../effects/useCountUp';

export function RewardScreen() {
  const reward = useGameStore((s) => s.lastReward);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    if (reward) fireConfetti();
  }, [reward]);

  const coins = useCountUp(reward?.coins ?? 0);
  const food = useCountUp(reward?.food ?? 0);

  if (!reward) return null;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.18 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <motion.div
        className="flex flex-1 flex-col items-center justify-center gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h1 variants={item} className="text-3xl font-bold text-amber-700">
          Level cleared!
        </motion.h1>
        <motion.p variants={item} className="text-4xl">
          {Array.from({ length: reward.stars }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.25, type: 'spring', stiffness: 400 }}
              className="inline-block"
            >
              ⭐
            </motion.span>
          ))}
        </motion.p>
        <motion.p variants={item} className="text-lg text-slate-700">
          You earned {food} 🥩 protein
        </motion.p>
        <motion.p variants={item} className="text-lg text-slate-700">
          +{coins} coins
        </motion.p>
      </motion.div>
      <button
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update the RewardScreen test** — REPLACE the entire contents of `src/components/RewardScreen.test.tsx` with EXACTLY:

```tsx
// src/components/RewardScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { RewardScreen } from './RewardScreen';
import { useGameStore } from '../state/gameStore';

describe('RewardScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders nothing when there is no reward', () => {
    const { container } = render(<RewardScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the reward details when a reward is present', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25 } });
    render(<RewardScreen />);
    expect(screen.getByText(/Level cleared/)).toBeInTheDocument();
    expect(screen.getByText(/protein/)).toBeInTheDocument();
    expect(screen.getByText(/coins/)).toBeInTheDocument();
  });
});
```

Note: if the existing `RewardScreen.test.tsx` asserted exact counted values (e.g. "+25 coins") those now count up from 0, so the test matches on the stable label text (`/coins/`, `/protein/`) instead. Keep the assertions as written above.

- [ ] **Step 3: Run the RewardScreen test + full suite**

Run: `npx vitest run src/components/RewardScreen.test.tsx && npm run test`
Expected: RewardScreen tests pass; full suite green.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/RewardScreen.tsx src/components/RewardScreen.test.tsx
git commit -m "feat: reward screen confetti, stagger entrance, count-up"
```

---

## Slice 5 — Screen transitions

### Task 8: AnimatePresence screen transitions in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Wrap CurrentScreen in AnimatePresence** — REPLACE the entire contents of `src/App.tsx` with EXACTLY:

```tsx
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useGameStore } from './state/gameStore';
import { AppShell } from './components/AppShell';
import { EggHatch } from './components/EggHatch';
import { PetRoom } from './components/PetRoom';
import { DrillScreen } from './components/DrillScreen';
import { RewardScreen } from './components/RewardScreen';

function screenKeyAndNode(screen: string, hatched: boolean) {
  if (!hatched) return { key: 'egg', node: <EggHatch /> };
  switch (screen) {
    case 'drill': return { key: 'drill', node: <DrillScreen level={1} /> };
    case 'reward': return { key: 'reward', node: <RewardScreen /> };
    case 'petRoom':
    default: return { key: 'petRoom', node: <PetRoom /> };
  }
}

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  const hatched = useGameStore((s) => s.pet.hatched);
  const { key, node } = screenKeyAndNode(screen, hatched);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        className="flex flex-1 flex-col"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {node}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <CurrentScreen />
      </AppShell>
    </MotionConfig>
  );
}
```

Note: the `motion.div` is `flex flex-1 flex-col` so it fills the AppShell `<main>` (which is `flex flex-col`), and each screen's own `h-full` resolves against it. Layout is otherwise unchanged.

- [ ] **Step 2: Run the full suite + build**

Run: `npm run test && npm run build`
Expected: all green; build clean. (Screens render inside the keyed `motion.div`, which is a plain div in jsdom — existing tests that render `<App />` or individual screens are unaffected.)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: animated screen transitions (AnimatePresence)"
```

---

### Task 9: Manual e2e

**Files:** none (verification only)

- [ ] **Step 1: Manual e2e on a touch viewport**

Run: `npm run dev` → open the printed URL → DevTools device-toolbar, phone-portrait.
Verify each area:
- **Transitions:** moving egg→room→drill→reward→room fades/slides, no hard cuts.
- **Pet life:** pet gently bobs at rest; pressing Feed makes it bounce; (evolution pop needs an XP threshold cross — optional to force).
- **Reward:** finishing a round shows confetti, the title + stars pop in sequence, coins/food count up.
- **Bars/numbers:** after a round, bars animate down; after feeding, bars animate up; a bar under 30 turns amber, under 15 red; the changed bar pulses; XP/coins count up.
- **Reduced motion:** set OS/browser "reduce motion" → animations are minimized/instant (MotionConfig).

- [ ] **Step 2: Note tuning**

Adjust durations/delays in the touched components if anything feels too slow/fast. No structural change needed if it feels right.

---

## Self-review notes for the implementer

- `resolveRound`, `placeTile`, scoring, store, and the feedback slice are NOT touched.
- framer-motion `motion.*` elements render as their base DOM tag in jsdom, so render tests keep working; never assert on animated style values in tests.
- The only logic with real unit tests is `useCountUp` and `barColor` — keep them pure and covered.
- `WordTray` becomes `motion.button` but MUST keep forwarding dnd-kit's `ref`/`listeners`/`attributes`, or dragging breaks.
- Count-up labels (`useCountUp`) mean tests should assert on stable label text, not the in-flight number.
- Reduced motion is global via `<MotionConfig reducedMotion="user">` — do not re-implement per component.
