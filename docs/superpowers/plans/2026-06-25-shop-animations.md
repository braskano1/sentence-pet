# Shop animations / interaction polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate every Shop interaction (coin count-down, tap squish, card stagger-in, purchase juice, can't-afford shake) using existing patterns, with no logic/persist change.

**Architecture:** Extract a `TreatCard` subcomponent (owns its own framer-motion `useAnimationControls` + floating-label state). `Shop` becomes a thin container: count-up coin header + a stagger map of `TreatCard`s + animated Back button. Affordability stays in pure `canAfford`/`purchase`. Button model goes 2→3 states: amber (buy), muted-amber (tappable, shakes on deny), grey (disabled when happiness full).

**Tech Stack:** React 19 + framer-motion + Tailwind v4 + Zustand + Vitest. Global `MotionConfig reducedMotion="user"` (in App.tsx) already gates transform animations.

Spec: `docs/superpowers/specs/2026-06-25-shop-animations-design.md`.

**Conventions (carry forward):**
- Typecheck = `npx tsc -b` (NOT `tsc --noEmit`). `npm run build` runs it.
- Tests: `npm test -- --run`. Component tests are RENDER-ONLY — never assert animated style values. Mock confetti: `vi.mock('canvas-confetti', () => ({ default: vi.fn() }))`.
- Test queries use `userEvent` + `getByRole`/`getByText` (`@testing-library`).
- Verify `git branch --show-current` is `shop-economy` before committing.
- LF→CRLF git warnings cosmetic — ignore.

---

## File Structure

- Modify `src/effects/celebrate.ts` — add `buzzError()` (error haptic).
- Modify `src/effects/celebrate.test.ts` — test `buzzError`.
- Create `src/components/TreatCard.tsx` — one treat card; owns pop/shake/float animation; buy-vs-deny tap logic.
- Create `src/components/TreatCard.test.tsx` — render-only tests for the 3 states.
- Modify `src/components/Shop.tsx` — refactor to count-up header + `TreatCard` map + animated Back; remove inline buy/disable/confetti logic.
- Modify `src/components/Shop.test.tsx` — verify still green; adjust only if a selector assumed `disabled` on unaffordable buttons.

No store / persist / gameConfig / domain changes.

---

### Task 1: `buzzError` error haptic

**Files:**
- Modify: `src/effects/celebrate.ts`
- Test: `src/effects/celebrate.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/effects/celebrate.test.ts`. First extend the import line:
```ts
import { fireConfetti, buzz, buzzError } from './celebrate';
```
Then add this describe block (mirrors the existing `buzz` block):
```ts
describe('buzzError', () => {
  afterEach(() => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
  it('calls navigator.vibrate with a double-buzz pattern when available', () => {
    const vibrate = vi.fn();
    (navigator as unknown as { vibrate: unknown }).vibrate = vibrate;
    buzzError();
    expect(vibrate).toHaveBeenCalledWith([40, 30, 40]);
  });
  it('no-ops when navigator.vibrate is unavailable', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    expect(() => buzzError()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/effects/celebrate.test.ts`
Expected: FAIL — `buzzError` is not exported.

- [ ] **Step 3: Implement**

Append to `src/effects/celebrate.ts`:
```ts
/** Distinct error haptic (double buzz); no-op on unsupported devices. */
export function buzzError(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([40, 30, 40]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/effects/celebrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/effects/celebrate.ts src/effects/celebrate.test.ts
git commit -m "feat: buzzError error haptic"
```

---

### Task 2: `TreatCard` component

**Files:**
- Create: `src/components/TreatCard.tsx`
- Test: `src/components/TreatCard.test.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/TreatCard.tsx
import { useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { canAfford, type ShopItem } from '../domain/shop';
import { fireConfetti, buzz, buzzError } from '../effects/celebrate';

interface TreatCardProps {
  item: ShopItem;
  coins: number;   // live store coins (for affordability)
  full: boolean;   // happiness at max
  index: number;   // for stagger-in delay
}

export function TreatCard({ item, coins, full, index }: TreatCardProps) {
  const buyTreat = useGameStore((s) => s.buyTreat);
  const controls = useAnimationControls();
  const [floating, setFloating] = useState(false);
  const afford = canAfford(coins, item);

  const reason = full ? 'Already happy!' : !afford ? 'Not enough coins' : '';
  const style = full
    ? 'bg-slate-200 text-slate-400'
    : afford
      ? 'bg-amber-500 text-white'
      : 'bg-amber-200 text-amber-800';

  function handleClick() {
    if (afford) {
      buyTreat(item);
      controls.start({ scale: [1, 1.08, 1], transition: { duration: 0.3 } });
      setFloating(true);
      fireConfetti();
      buzz();
    } else {
      controls.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.4 } });
      buzzError();
    }
  }

  return (
    <motion.button
      type="button"
      disabled={full}
      onClick={handleClick}
      whileTap={full ? undefined : { scale: 0.95 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`relative min-h-16 w-full overflow-visible rounded-xl px-5 py-3 text-left shadow ${style}`}
    >
      <motion.div animate={controls}>
        <span className="font-semibold">{item.name}</span>{' '}
        <span>🪙 {item.price} · +{item.happiness} 😊</span>
        {reason && <span className="block text-xs">{reason}</span>}
      </motion.div>

      <AnimatePresence>
        {floating && (
          <motion.span
            key="float"
            className="pointer-events-none absolute right-5 top-2 text-lg font-bold text-emerald-600"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.8 }}
            onAnimationComplete={() => setFloating(false)}
          >
            +{item.happiness} 😊
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
```

Notes for the implementer:
- The outer `motion.button` carries the declarative **enter** animation (`initial`/`animate`/stagger `delay`) + `whileTap` squish. The inner `motion.div animate={controls}` carries the imperative **pop/shake** — this avoids two animation sources fighting over one `animate` prop.
- `disabled={full}` only — can't-afford stays tappable so it can shake. `buyTreat` is also a defensive no-op, but the `if (afford)` guard means it is never called when unaffordable.
- Confetti/buzz fire ONLY in the affordable branch (gates the previously-unconditional confetti).

- [ ] **Step 2: Write the render-only test**

```tsx
// src/components/TreatCard.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreatCard } from './TreatCard';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const snack = GAME_CONFIG.shop.treats[0]; // price 15, +15

beforeEach(() => {
  useGameStore.getState().resetForTest();
});

describe('TreatCard', () => {
  it('affordable card is enabled, shows price, and spends coins on click', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<TreatCard item={snack} coins={100} full={false} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(useGameStore.getState().pet.coins).toBe(85);
  });

  it('unaffordable card is tappable (not disabled), shows reason, and does not spend', async () => {
    // store coins are 0 after reset
    render(<TreatCard item={snack} coins={0} full={false} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).not.toBeDisabled();
    expect(screen.getByText('Not enough coins')).toBeInTheDocument();
    await userEvent.click(btn);
    expect(useGameStore.getState().pet.coins).toBe(0);
  });

  it('happiness-full card is disabled and shows the full reason', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<TreatCard item={snack} coins={100} full={true} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText('Already happy!')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- --run src/components/TreatCard.test.tsx`
Expected: PASS. (`userEvent` respects `disabled`; confetti mocked; `buzz`/`buzzError` no-op without `navigator.vibrate` in jsdom.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -b
git add src/components/TreatCard.tsx src/components/TreatCard.test.tsx
git commit -m "feat: TreatCard with buy/deny animations and floating juice"
```

---

### Task 3: Refactor `Shop.tsx` to use `TreatCard` + count-up

**Files:**
- Modify: `src/components/Shop.tsx`
- Test: `src/components/Shop.test.tsx`

- [ ] **Step 1: Replace `Shop.tsx` contents**

```tsx
// src/components/Shop.tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { TreatCard } from './TreatCard';

export function Shop() {
  const coins = useGameStore((s) => s.pet.coins);
  const happiness = useGameStore((s) => s.pet.happiness);
  const setScreen = useGameStore((s) => s.setScreen);
  const shownCoins = useCountUp(coins);
  const full = happiness >= GAME_CONFIG.happiness.max;

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {shownCoins}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {GAME_CONFIG.shop.treats.map((item, index) => (
          <TreatCard key={item.id} item={item} coins={coins} full={full} index={index} />
        ))}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </motion.button>
    </div>
  );
}
```

(The old `canAfford`/`fireConfetti`/`buzz`/`buyTreat` imports and inline logic are gone — all moved to `TreatCard`.)

- [ ] **Step 2: Run the existing Shop test**

Run: `npm test -- --run src/components/Shop.test.tsx`
Expected: PASS unchanged. The three existing cases (renders title + 3 treats + Back; Back → petRoom; buying with coins spends) query by role/text and add coins before buying, so they survive the refactor. The header now shows `shownCoins` (count-up), which initialises to the target value on mount — so the rendered balance is correct immediately.

If any case fails because it asserted a `disabled` attribute on an unaffordable button (it should not — those tests added coins first), fix that assertion to match the new tappable-muted model. Do not weaken a passing test.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -b
git add src/components/Shop.tsx src/components/Shop.test.tsx
git commit -m "refactor: Shop uses TreatCard + count-up coin balance"
```

---

### Task 4: Full verification

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
- Open Shop → cards stagger in.
- Tap an affordable treat → button squishes, card pops, `+N 😊` floats up, confetti, coin balance ticks down.
- Tap a treat you can't afford → card shakes, no purchase, balance unchanged.
- Spend until a tier is unaffordable → it turns muted-amber "Not enough coins" but still shakes when tapped.
- Reach max happiness → all treats greyed "Already happy!" and not tappable.
- Back button squishes → returns to PetRoom.

(No commit — this task is observation only.)

---

## Finishing

When green: this completes the shop slice (treats + polish). Branch `shop-economy` → PR → merge-commit (PR #5), per the PR #2/#3/#4 pattern. Use `superpowers:finishing-a-development-branch`.

## Self-review notes

- **Spec coverage:** buzzError (Task 1) ✓; TreatCard with A-coin-countdown(prop pipeline)/B-whileTap/C-stagger/D-pop+float+confetti/E-shake+buzzError + 3-state buttons (Task 2) ✓; Shop count-up header + TreatCard map + animated Back (Task 3) ✓; full verify (Task 4) ✓.
- **A (coin count-down)** lives in Shop's header (`useCountUp(coins)`, Task 3); TreatCard receives raw `coins` for affordability — both consistent.
- **No logic/persist change:** no task touches store/gameConfig/domain. `canAfford`/`purchase`/`buyTreat` reused as-is.
- **Type consistency:** `ShopItem`, `TreatCardProps {item,coins,full,index}`, `buzzError`, `canAfford`, `buyTreat` used identically across tasks.
- **Confetti gating:** confetti only in TreatCard's affordable branch — resolves the prior final-review no-op note.
