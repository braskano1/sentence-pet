# Shop / economy (treats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coin sink — a Shop screen selling 3 happiness-treat tiers, bought instantly with coins.

**Architecture:** Pure `shop.ts` (catalog types, `canAfford`, `purchase` with clamp + reject reasons) → treat catalog data in `gameConfig.ts` → `buyTreat` store action (NO persist bump) → `Shop.tsx` screen + `'shop'` Screen value → PetRoom nav button → App route. Confetti on buy. Real logic in the pure module (jsdom-safe); component tests render-only.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest. `canvas-confetti` (mock in tests).

Spec: `docs/superpowers/specs/2026-06-25-shop-economy-design.md`.

**Conventions (carry forward):**
- Typecheck = `npx tsc -b` (NOT `tsc --noEmit` — no-op here). `npm run build` runs it.
- Tests: `npm test -- --run`.
- Mock confetti in any test transitively importing `src/effects/celebrate.ts`: `vi.mock('canvas-confetti', () => ({ default: vi.fn() }))`.
- Confetti export is `fireConfetti` (+ `buzz`), from `src/effects/celebrate.ts`.
- `happiness.max` = 100 (`GAME_CONFIG.happiness.max`).
- Verify `git branch --show-current` is `shop-economy` before committing (detached-HEAD trap after agents run `git show`/`checkout`).

---

## File Structure

- Create `src/domain/shop.ts` — pure: `ShopItem`/`ShopItemKind`/`PurchaseResult` types, `canAfford`, `purchase`.
- Create `src/domain/shop.test.ts` — exhaustive unit tests.
- Modify `src/config/gameConfig.ts` — add `shop.treats` catalog.
- Modify `src/data/types.ts` — `Screen` gains `'shop'`.
- Modify `src/state/gameStore.ts` — `buyTreat` action + `addCoinsForTest` helper. No persist change.
- Modify `src/state/gameStore.test.ts` — `buyTreat` tests.
- Create `src/components/Shop.tsx` — shop screen.
- Create `src/components/Shop.test.tsx` — render-only test.
- Modify `src/components/PetRoom.tsx` — Shop nav button.
- Modify `src/components/PetRoom.test.tsx` — Shop button navigates.
- Modify `src/App.tsx` — route `'shop'` → `<Shop />`.
- Modify `GAME_DESIGN.md` (repo root + H: copy) — "Shop (treats shipped)" note.

---

### Task 1: Pure shop domain (`shop.ts`)

**Files:**
- Create: `src/domain/shop.ts`
- Test: `src/domain/shop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/shop.test.ts
import { describe, expect, it } from 'vitest';
import { canAfford, purchase, type ShopItem } from './shop';

const snack: ShopItem = { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 };
const feast: ShopItem = { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 };
const MAX = 100;

describe('canAfford', () => {
  it('false when coins below price', () => expect(canAfford(10, snack)).toBe(false));
  it('true when coins equal price', () => expect(canAfford(15, snack)).toBe(true));
  it('true when coins above price', () => expect(canAfford(99, snack)).toBe(true));
});

describe('purchase', () => {
  it('succeeds: decrements coins, adds happiness', () => {
    expect(purchase({ coins: 100, happiness: 50 }, snack, MAX)).toEqual({
      ok: true, coins: 85, happiness: 65,
    });
  });

  it('clamps happiness to max', () => {
    expect(purchase({ coins: 100, happiness: 80 }, feast, MAX)).toEqual({
      ok: true, coins: 40, happiness: 100,
    });
  });

  it('rejects when unaffordable', () => {
    expect(purchase({ coins: 10, happiness: 50 }, snack, MAX)).toEqual({
      ok: false, reason: 'insufficient-coins',
    });
  });

  it('rejects when happiness already full, even if affordable', () => {
    expect(purchase({ coins: 100, happiness: 100 }, snack, MAX)).toEqual({
      ok: false, reason: 'happiness-full',
    });
  });

  it('does not mutate input state', () => {
    const state = { coins: 100, happiness: 50 };
    purchase(state, snack, MAX);
    expect(state).toEqual({ coins: 100, happiness: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/shop.test.ts`
Expected: FAIL — cannot find module `./shop`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/shop.ts

export type ShopItemKind = 'treat'; // future: 'decor' | 'pet'

export interface ShopItem {
  id: string;
  name: string;
  kind: ShopItemKind;
  price: number;     // coins
  happiness: number; // boost applied (treat kind)
}

export type PurchaseResult =
  | { ok: true; coins: number; happiness: number }
  | { ok: false; reason: 'insufficient-coins' | 'happiness-full' };

export function canAfford(coins: number, item: ShopItem): boolean {
  return coins >= item.price;
}

/**
 * Pure. Validates then applies a treat purchase. No mutation.
 * happiness-full is checked first: when happiness is maxed there is no point
 * spending regardless of coins, and the UI greys every Buy button in that case.
 */
export function purchase(
  state: { coins: number; happiness: number },
  item: ShopItem,
  happinessMax: number,
): PurchaseResult {
  if (state.happiness >= happinessMax) return { ok: false, reason: 'happiness-full' };
  if (!canAfford(state.coins, item)) return { ok: false, reason: 'insufficient-coins' };
  return {
    ok: true,
    coins: state.coins - item.price,
    happiness: Math.min(happinessMax, state.happiness + item.happiness),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/shop.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/domain/shop.ts src/domain/shop.test.ts
git commit -m "feat: pure shop domain (canAfford, purchase)"
```

---

### Task 2: Treat catalog in config

**Files:**
- Modify: `src/config/gameConfig.ts`

- [ ] **Step 1: Add the catalog**

Add a `shop` block to `GAME_CONFIG` (after `xp`). Import the type at top of file.

```ts
import type { ShopItem } from '../domain/shop';
```

```ts
  shop: {
    treats: [
      { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 },
      { id: 'treat', name: 'Treat', kind: 'treat', price: 30, happiness: 35 },
      { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 },
    ] satisfies ShopItem[],
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean. (`satisfies ShopItem[]` validates shape without widening the `as const` literal types.)

- [ ] **Step 3: Run full suite (nothing should break)**

Run: `npm test -- --run`
Expected: all existing tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add src/config/gameConfig.ts
git commit -m "feat: add happiness-treat catalog to game config"
```

---

### Task 3: `Screen` type adds `'shop'`

**Files:**
- Modify: `src/data/types.ts:24`

- [ ] **Step 1: Extend the union**

Change:
```ts
export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward';
```
to:
```ts
export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward' | 'shop';
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -b
git add src/data/types.ts
git commit -m "feat: add 'shop' to Screen union"
```

---

### Task 4: `buyTreat` store action

**Files:**
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `gameStore.test.ts` (uses real store; reset first). The existing tests show the import + reset pattern — match it. Use the catalog from config.

```ts
import { GAME_CONFIG } from '../config/gameConfig';
// ... within the describe block:

describe('buyTreat', () => {
  const snack = GAME_CONFIG.shop.treats[0]; // price 15, +15 happiness

  it('spends coins and raises happiness', () => {
    const s = useGameStore.getState();
    s.resetForTest();
    s.addCoinsForTest(100);
    useGameStore.getState().buyTreat(snack);
    const pet = useGameStore.getState().pet;
    expect(pet.coins).toBe(85);
    expect(pet.happiness).toBe(GAME_CONFIG.happiness.start + 15); // 60 + 15 = 75
  });

  it('is a no-op when unaffordable', () => {
    const s = useGameStore.getState();
    s.resetForTest(); // coins 0
    useGameStore.getState().buyTreat(snack);
    const pet = useGameStore.getState().pet;
    expect(pet.coins).toBe(0);
    expect(pet.happiness).toBe(GAME_CONFIG.happiness.start);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `buyTreat` / `addCoinsForTest` not a function.

- [ ] **Step 3: Implement**

In `gameStore.ts`:

Add imports:
```ts
import { purchase } from '../domain/shop';
import type { ShopItem } from '../domain/shop';
```

Add to the `GameState` interface (near `feed`):
```ts
  buyTreat: (item: ShopItem) => void;
```
and near the test helpers:
```ts
  addCoinsForTest: (coins: number) => void;
```

Add the action implementation (after `feed`):
```ts
      buyTreat: (item) =>
        set((st) => {
          const res = purchase(
            { coins: st.pet.coins, happiness: st.pet.happiness },
            item,
            GAME_CONFIG.happiness.max,
          );
          if (!res.ok) return st; // no-op; UI disables the button, this is defensive
          return { pet: { ...st.pet, coins: res.coins, happiness: res.happiness } };
        }),
```

Add the helper (near `addXpForTest`):
```ts
      addCoinsForTest: (coins) => set((st) => ({ pet: { ...st.pet, coins: st.pet.coins + coins } })),
```

**Do NOT touch `version` or `migrate`** — no new persisted field.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: buyTreat store action (instant-apply, no persist bump)"
```

---

### Task 5: `Shop.tsx` screen

**Files:**
- Create: `src/components/Shop.tsx`
- Test: `src/components/Shop.test.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/Shop.tsx
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { canAfford } from '../domain/shop';
import { fireConfetti, buzz } from '../effects/celebrate';

export function Shop() {
  const coins = useGameStore((s) => s.pet.coins);
  const happiness = useGameStore((s) => s.pet.happiness);
  const buyTreat = useGameStore((s) => s.buyTreat);
  const setScreen = useGameStore((s) => s.setScreen);
  const full = happiness >= GAME_CONFIG.happiness.max;

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {coins}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {GAME_CONFIG.shop.treats.map((item) => {
          const afford = canAfford(coins, item);
          const disabled = full || !afford;
          const reason = full ? 'Already happy!' : !afford ? 'Not enough coins' : '';
          return (
            <button
              key={item.id}
              disabled={disabled}
              onClick={() => {
                buyTreat(item);
                fireConfetti();
                buzz();
              }}
              className={`min-h-16 w-full rounded-xl px-5 py-3 text-left shadow ${
                disabled ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white'
              }`}
            >
              <span className="font-semibold">{item.name}</span>{' '}
              <span>🪙 {item.price} · +{item.happiness} 😊</span>
              {disabled && <span className="block text-xs">{reason}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write the render-only test**

```tsx
// src/components/Shop.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shop } from './Shop';
import { useGameStore } from '../state/gameStore';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

beforeEach(() => {
  useGameStore.getState().resetForTest();
});

describe('Shop', () => {
  it('renders title, coin balance, all 3 treats, and Back', () => {
    render(<Shop />);
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /snack/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /treat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /feast/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('Back returns to petRoom', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('buying a treat (with coins) spends coins', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /snack/i }));
    expect(useGameStore.getState().pet.coins).toBe(85);
  });
});
```

Note: with coins 0 (default after reset), the Buy buttons are disabled, so the
balance/Back render test still works but a click on a disabled button is a no-op —
that's why the buy test calls `addCoinsForTest(100)` first to enable Snack.

- [ ] **Step 3: Run test**

Run: `npm test -- --run src/components/Shop.test.tsx`
Expected: PASS. (Confetti mocked; `userEvent` respects the `disabled` attribute.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -b
git add src/components/Shop.tsx src/components/Shop.test.tsx
git commit -m "feat: Shop screen with happiness treats"
```

---

### Task 6: PetRoom Shop nav button

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `PetRoom.test.tsx` (match its existing render/reset pattern; mock confetti if the file transitively pulls it — PetRoom does not import celebrate, so likely unneeded, but keep if the existing file already mocks it):

```tsx
it('Shop button navigates to shop', async () => {
  useGameStore.getState().hatch();
  render(<PetRoom />);
  await userEvent.click(screen.getByRole('button', { name: /shop/i }));
  expect(useGameStore.getState().screen).toBe('shop');
});
```

(`userEvent` is already imported in this file; `beforeEach` already resets the store.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: FAIL — no element with text `Shop 🛒`.

- [ ] **Step 3: Add the button**

In `PetRoom.tsx`, in the bottom actions zone, add a Shop button **above** the Play button:

```tsx
        <button
          onClick={() => setScreen('shop')}
          className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Shop 🛒
        </button>
```

(`setScreen` is already pulled from the store in this component.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "feat: Shop nav button in PetRoom"
```

---

### Task 7: Route `'shop'` in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import Shop**

Add: `import { Shop } from './components/Shop';`

- [ ] **Step 2: Add the case**

In `screenKeyAndNode`, add before the `petRoom`/default case:
```ts
    case 'shop': return { key: 'shop', node: <Shop /> };
```

- [ ] **Step 3: Typecheck + full suite + build**

```bash
npx tsc -b
npm test -- --run
npm run build
```
Expected: tsc clean, all tests PASS, build clean.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: route shop screen in App"
```

---

### Task 8: Sync GAME_DESIGN docs

**Files:**
- Modify: `GAME_DESIGN.md` (repo root)
- Modify: `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`

- [ ] **Step 1: Add a shipped note**

Under §7 (Economy) in BOTH copies, add:
```
### Shop (treats shipped)
- Shop screen reachable from PetRoom; sells 3 happiness-treat tiers (Snack 15→+15, Treat 30→+35, Feast 60→+80). Instant-apply, clamps happiness to 100. Coins now have a sink. Decor + pet-unlocks deferred (need art + a 2→3 persist bump for an owned-items set).
```

- [ ] **Step 2: Commit (repo copy only; H: copy is outside git)**

```bash
git add GAME_DESIGN.md
git commit -m "docs: note shop (treats) shipped in GAME_DESIGN"
```

---

## Manual verification (after Task 7)

- [ ] `npm run dev -- --host` → open on phone/LAN.
- [ ] Play a round to earn coins → PetRoom shows coins → tap **Shop 🛒**.
- [ ] Affordable treat: Buy → confetti, coins drop, happiness bar rises.
- [ ] Spend down: cheaper tiers stay buyable, pricier greyed "Not enough coins".
- [ ] Max happiness: all treats greyed "Already happy!".
- [ ] Back → PetRoom.

## Finishing

When green (tsc clean, full suite passing, build clean): branch `shop-economy` → PR → merge-commit (`gh pr merge N --merge --delete-branch`), per the PR #2/#3/#4 pattern. Use `superpowers:finishing-a-development-branch`.

## Self-review notes

- **Spec coverage:** shop.ts (Task 1) ✓, catalog/config (Task 2) ✓, Screen value (Task 3) ✓, buyTreat no-bump (Task 4) ✓, Shop screen + disabled states + confetti (Task 5) ✓, PetRoom nav (Task 6) ✓, App route (Task 7) ✓, docs sync (Task 8) ✓.
- **No persist bump** preserved across Tasks 4 — version/migrate untouched.
- **Type consistency:** `ShopItem`/`PurchaseResult`/`canAfford`/`purchase`/`buyTreat`/`addCoinsForTest` names identical across tasks.
- **Confetti:** real export `fireConfetti`/`buzz` used; mocked at `canvas-confetti` level in tests.
