# Decor Shop Implementation Plan (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the kid buy room backgrounds with coins in the shop and apply one behind the pet in PetRoom.

**Architecture:** A generic persisted `owned: string[]` set (id-namespaced, e.g. `decor:fire-room`) plus an `activeBackground` selector at the store root — the ownership primitive Phase B (pet-unlocks) reuses. Pure `buyDecor`/`isOwned` domain reducer (mirrors existing `purchase`). `ShopItem` becomes a discriminated union (`treat` | `decor`). Shop gains a `Treats | Decor` tab; PetRoom renders the active room webp full-bleed behind a radial scrim that keeps the pet legible. Persist bumps 3→4 with a backfilling migrate.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest + framer-motion. ImageMagick `magick` for asset prep.

**Conventions (from Phase 0, carry forward):**
- Pure logic in domain modules, exhaustively unit-tested. Component tests render-only (jsdom can't drive @dnd-kit/framer-motion). `motion.*`/`PressButton` render native elements → `getByRole` works.
- Typecheck = `npx tsc -b` (NOT `tsc --noEmit` — root `tsconfig` is a no-op). `npm run build` runs `tsc -b`.
- Tests: `npm test -- --run`. Mock `canvas-confetti` in any test transitively importing `src/effects/celebrate.ts`.
- Persist schema change ⇒ version bump + migrate + a migrate test against the real `persist.getOptions().migrate`.
- Ids always derived from the catalog config — never hand-typed decor-id string literals in store/UI.
- Branch off `main` per slice. Run each Verify step before its Commit. Windows LF→CRLF git warnings are cosmetic — ignore.

**Branch setup (before Task 1):**
```bash
cd /d/ai_projects/AI_design_thinking/sentence-pet
git checkout main && git pull --ff-only
git checkout -b decor-shop
```

---

## Task 1: Refactor `ShopItem` into a discriminated union

Make room for a `decor` kind without polluting treats. No behaviour change — existing treat tests must stay green. `purchase` narrows to treat-only.

**Files:**
- Modify: `src/domain/shop.ts`
- Modify: `src/components/TreatCard.tsx:7-14` (prop type `ShopItem` → `TreatItem`)
- Modify: `src/state/gameStore.ts` (`buyTreat` param type)
- Test: `src/domain/shop.test.ts` (already exists; add a decor-type compile assertion)

- [ ] **Step 1: Rewrite `src/domain/shop.ts` with the union**

```ts
export type ShopItemKind = 'treat' | 'decor';

interface ShopItemBase {
  id: string;
  name: string;
  price: number; // coins
}

export interface TreatItem extends ShopItemBase {
  kind: 'treat';
  happiness: number; // boost applied
}

export interface DecorItem extends ShopItemBase {
  kind: 'decor';
  sprite: string; // imported webp url
}

export type ShopItem = TreatItem | DecorItem;

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
  item: TreatItem,
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

- [ ] **Step 2: Update `src/domain/shop.test.ts` — type the fixtures + add a decor compile-assertion**

Change the two fixtures and add a decor item that must satisfy the union (compile-time coverage that `DecorItem` exists and has no `happiness`):

```ts
import { describe, expect, it } from 'vitest';
import { canAfford, purchase, type ShopItem, type TreatItem, type DecorItem } from './shop';

const snack: TreatItem = { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 };
const feast: TreatItem = { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 };

// compile-time: a decor item is a valid ShopItem and carries a sprite, not happiness
const _room: ShopItem = { id: 'decor:x', name: 'X', kind: 'decor', sprite: 'x.webp' } satisfies DecorItem;

const MAX = 100;
```

(Leave the existing `canAfford`/`purchase` describe blocks unchanged — they still pass.)

- [ ] **Step 3: Update `src/components/TreatCard.tsx`**

Line 4 import and the prop type — treats only:

```ts
import { canAfford, type TreatItem } from '../domain/shop';
```
```ts
interface TreatCardProps {
  item: TreatItem;
  coins: number;   // live store coins (for affordability)
  full: boolean;   // happiness at max
  index: number;   // for stagger-in delay
}

export function TreatCard({ item, coins, full, index }: TreatCardProps) {
```

- [ ] **Step 4: Update `src/state/gameStore.ts` `buyTreat` signature**

Change the import + the `buyTreat` declaration to take a `TreatItem`:

```ts
import { purchase } from '../domain/shop';
import type { TreatItem } from '../domain/shop';
```
```ts
  buyTreat: (item: TreatItem) => void;
```

(The `buyTreat` implementation body is unchanged.)

- [ ] **Step 5: Verify — full suite + typecheck green**

Run: `npm test -- --run`
Expected: PASS (159 tests, unchanged count).

Run: `npx tsc -b`
Expected: clean, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/shop.ts src/domain/shop.test.ts src/components/TreatCard.tsx src/state/gameStore.ts
git commit -m "refactor: ShopItem discriminated union (treat | decor)"
```

---

## Task 2: Pure decor domain — `buyDecor` + `isOwned`

The ownership reducer. Exhaustively unit-tested. Mirrors `purchase`: validate, return new values, no mutation. `already-owned` rejected before `insufficient-coins`.

**Files:**
- Create: `src/domain/decor.ts`
- Test: `src/domain/decor.test.ts`

- [ ] **Step 1: Write the failing test `src/domain/decor.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buyDecor, isOwned } from './decor';
import type { DecorItem } from './shop';

const fireRoom: DecorItem = { id: 'decor:fire-room', name: 'Fire Room', kind: 'decor', price: 150, sprite: 'fire.webp' };
const beach: DecorItem = { id: 'decor:beach', name: 'Beach', kind: 'decor', price: 50, sprite: 'beach.webp' };

describe('isOwned', () => {
  it('true when id present', () => expect(isOwned(['decor:beach'], 'decor:beach')).toBe(true));
  it('false when id absent', () => expect(isOwned(['decor:beach'], 'decor:fire-room')).toBe(false));
  it('false for empty set', () => expect(isOwned([], 'decor:beach')).toBe(false));
});

describe('buyDecor', () => {
  it('succeeds: decrements coins, appends id to owned', () => {
    expect(buyDecor({ coins: 200, owned: [] }, fireRoom)).toEqual({
      ok: true, coins: 50, owned: ['decor:fire-room'],
    });
  });

  it('preserves existing owned ids on success', () => {
    expect(buyDecor({ coins: 60, owned: ['decor:fire-room'] }, beach)).toEqual({
      ok: true, coins: 10, owned: ['decor:fire-room', 'decor:beach'],
    });
  });

  it('rejects already-owned, even if affordable', () => {
    expect(buyDecor({ coins: 999, owned: ['decor:beach'] }, beach)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('rejects when unaffordable', () => {
    expect(buyDecor({ coins: 10, owned: [] }, beach)).toEqual({
      ok: false, reason: 'insufficient-coins',
    });
  });

  it('checks already-owned BEFORE insufficient-coins', () => {
    // owned + too poor → already-owned wins (mirrors purchase ordering)
    expect(buyDecor({ coins: 0, owned: ['decor:beach'] }, beach)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('does not mutate input state', () => {
    const state = { coins: 200, owned: ['decor:fire-room'] };
    buyDecor(state, beach);
    expect(state).toEqual({ coins: 200, owned: ['decor:fire-room'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/decor.test.ts`
Expected: FAIL — `buyDecor`/`isOwned` not defined (cannot find module `./decor`).

- [ ] **Step 3: Write `src/domain/decor.ts`**

```ts
import { canAfford, type DecorItem } from './shop';

export type BuyDecorResult =
  | { ok: true; coins: number; owned: string[] }
  | { ok: false; reason: 'already-owned' | 'insufficient-coins' };

export function isOwned(owned: string[], id: string): boolean {
  return owned.includes(id);
}

/**
 * Pure. Validates then applies a decor purchase. No mutation.
 * already-owned is checked first: re-buying an owned room is meaningless
 * regardless of coins, and the UI shows Equip (not Buy) in that case.
 */
export function buyDecor(
  state: { coins: number; owned: string[] },
  item: DecorItem,
): BuyDecorResult {
  if (isOwned(state.owned, item.id)) return { ok: false, reason: 'already-owned' };
  if (!canAfford(state.coins, item)) return { ok: false, reason: 'insufficient-coins' };
  return {
    ok: true,
    coins: state.coins - item.price,
    owned: [...state.owned, item.id],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/decor.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/decor.ts src/domain/decor.test.ts
git commit -m "feat: pure buyDecor/isOwned ownership reducer"
```

---

## Task 3: Decor assets — prep script, webp output, sprite config (MAIN-THREAD / visual QA gate)

**This task is driven by the main thread, not a subagent** — it runs ImageMagick and a montage QA gate on the converted rooms before wiring. No unit logic; a tiny config test guards the sprite map shape.

**Files:**
- Create: `scripts/prep-decor.sh`
- Create (generated): `src/assets/sprites/decor/*.webp` (7 files)
- Create: `src/config/decorSprites.ts`
- Test: `src/config/decorSprites.test.ts`

Source PNGs live in `H:\My Drive\01 Current Projects\AI\AI_design_thinking\Pictures\room\`. Mapping (source → slug):

| slug | source png |
|---|---|
| `beach` | `ChatGPT Image Jun 24, 2026, 10_14_23 PM.png` |
| `forest-path` | `ChatGPT Image Jun 24, 2026, 10_14_20 PM.png` |
| `night-room` | `ChatGPT Image Jun 24, 2026, 10_14_17 PM.png` |
| `forest-room` | `ChatGPT Image Jun 24, 2026, 10_13_51 PM.png` |
| `sky-room` | `ChatGPT Image Jun 24, 2026, 10_14_00 PM.png` |
| `fire-room` | `ChatGPT Image Jun 24, 2026, 10_13_47 PM.png` |
| `water-room` | `ChatGPT Image Jun 24, 2026, 10_13_55 PM.png` |

- [ ] **Step 1: Write `scripts/prep-decor.sh`**

Resize each room to 1280px wide + convert to webp. **No background removal** — full frame. Mirrors `scripts/prep-sprites.sh` style.

```bash
#!/usr/bin/env bash
# Prep decor room backgrounds: resize to 1280w + webp. No bg removal (full-frame scenes).
set -euo pipefail

SRC="H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures/room"
OUT="src/assets/sprites/decor"
mkdir -p "$OUT"

# slug => source filename (no extension juggling; exact names)
declare -A ROOMS=(
  [beach]="ChatGPT Image Jun 24, 2026, 10_14_23 PM.png"
  [forest-path]="ChatGPT Image Jun 24, 2026, 10_14_20 PM.png"
  [night-room]="ChatGPT Image Jun 24, 2026, 10_14_17 PM.png"
  [forest-room]="ChatGPT Image Jun 24, 2026, 10_13_51 PM.png"
  [sky-room]="ChatGPT Image Jun 24, 2026, 10_14_00 PM.png"
  [fire-room]="ChatGPT Image Jun 24, 2026, 10_13_47 PM.png"
  [water-room]="ChatGPT Image Jun 24, 2026, 10_13_55 PM.png"
)

for slug in "${!ROOMS[@]}"; do
  src="$SRC/${ROOMS[$slug]}"
  magick "$src" -resize 1280x\> -quality 80 "$OUT/$slug.webp"
  echo "  $slug.webp  $(du -h "$OUT/$slug.webp" | cut -f1)"
done

echo "Done. QA montage:"
magick montage "$OUT"/*.webp -tile 4x2 -geometry 320x180+4+4 "$OUT/_montage-qa.png"
echo "  $OUT/_montage-qa.png"
```

- [ ] **Step 2: Run it + QA gate**

Run: `bash scripts/prep-decor.sh`
Expected: 7 `.webp` files in `src/assets/sprites/decor/`, each well under ~200kb (tune `-quality` down if any is larger). Open `src/assets/sprites/decor/_montage-qa.png` and confirm all 7 rooms look correct (right scene per slug, no clipping, colours intact). **If any room is wrong or too large, fix quality/resize and re-run before continuing.** Delete the montage after QA:

```bash
rm src/assets/sprites/decor/_montage-qa.png
```

- [ ] **Step 3: Write `src/config/decorSprites.ts`**

```ts
import beach from '../assets/sprites/decor/beach.webp';
import forestPath from '../assets/sprites/decor/forest-path.webp';
import nightRoom from '../assets/sprites/decor/night-room.webp';
import forestRoom from '../assets/sprites/decor/forest-room.webp';
import skyRoom from '../assets/sprites/decor/sky-room.webp';
import fireRoom from '../assets/sprites/decor/fire-room.webp';
import waterRoom from '../assets/sprites/decor/water-room.webp';

/** Decor id (namespaced) -> imported room webp. Single source of truth for room art. */
export const DECOR_SPRITES: Record<string, string> = {
  'decor:beach': beach,
  'decor:forest-path': forestPath,
  'decor:night-room': nightRoom,
  'decor:forest-room': forestRoom,
  'decor:sky-room': skyRoom,
  'decor:fire-room': fireRoom,
  'decor:water-room': waterRoom,
};
```

- [ ] **Step 4: Write `src/config/decorSprites.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DECOR_SPRITES } from './decorSprites';

describe('DECOR_SPRITES', () => {
  it('has all 7 rooms', () => {
    expect(Object.keys(DECOR_SPRITES)).toHaveLength(7);
  });

  it('every id is decor-namespaced and maps to a non-empty string', () => {
    for (const [id, sprite] of Object.entries(DECOR_SPRITES)) {
      expect(id.startsWith('decor:')).toBe(true);
      expect(typeof sprite).toBe('string');
      expect(sprite.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 5: Verify**

Run: `npm test -- --run src/config/decorSprites.test.ts`
Expected: PASS (2 tests).

Run: `npx tsc -b`
Expected: clean (Vite webp module typing already configured from Phase 0).

- [ ] **Step 6: Commit**

```bash
git add scripts/prep-decor.sh src/assets/sprites/decor src/config/decorSprites.ts src/config/decorSprites.test.ts
git commit -m "feat: decor room assets (1280w webp) + sprite config"
```

---

## Task 4: Decor catalog in `GAME_CONFIG.shop.decor`

**Files:**
- Modify: `src/config/gameConfig.ts`
- Test: `src/config/gameConfig.test.ts` (add a decor describe block)

- [ ] **Step 1: Write the failing test — append to `src/config/gameConfig.test.ts`**

```ts
import { GAME_CONFIG } from './gameConfig';
import { DECOR_SPRITES } from './decorSprites';

describe('shop.decor catalog', () => {
  const decor = GAME_CONFIG.shop.decor;

  it('lists all 7 rooms', () => {
    expect(decor).toHaveLength(7);
  });

  it('every item is kind=decor, decor-namespaced id, positive price, real sprite', () => {
    for (const item of decor) {
      expect(item.kind).toBe('decor');
      expect(item.id.startsWith('decor:')).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      expect(item.sprite).toBe(DECOR_SPRITES[item.id]);
    }
  });

  it('prices follow the 50/100/150 tiers', () => {
    const prices = decor.map((d) => d.price).sort((a, b) => a - b);
    expect(prices).toEqual([50, 50, 50, 100, 100, 150, 150]);
  });

  it('ids are unique', () => {
    const ids = decor.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

(If `gameConfig.test.ts` lacks `describe`/`expect`/`it` imports, add `import { describe, expect, it } from 'vitest';` at the top — check existing top of file first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/config/gameConfig.test.ts`
Expected: FAIL — `GAME_CONFIG.shop.decor` is undefined.

- [ ] **Step 3: Add the catalog to `src/config/gameConfig.ts`**

Update the imports + add `decor` under `shop`:

```ts
import type { ShopItem } from '../domain/shop';
import { DECOR_SPRITES } from './decorSprites';
```

Inside `shop:` (after `treats: [...] satisfies ShopItem[],`):

```ts
    decor: [
      { id: 'decor:beach',       name: 'Beach',       kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:beach'] },
      { id: 'decor:forest-path', name: 'Forest Path', kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:forest-path'] },
      { id: 'decor:night-room',  name: 'Night Room',  kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:night-room'] },
      { id: 'decor:forest-room', name: 'Forest Room', kind: 'decor', price: 100, sprite: DECOR_SPRITES['decor:forest-room'] },
      { id: 'decor:sky-room',    name: 'Sky Room',    kind: 'decor', price: 100, sprite: DECOR_SPRITES['decor:sky-room'] },
      { id: 'decor:fire-room',   name: 'Fire Room',   kind: 'decor', price: 150, sprite: DECOR_SPRITES['decor:fire-room'] },
      { id: 'decor:water-room',  name: 'Water Room',  kind: 'decor', price: 150, sprite: DECOR_SPRITES['decor:water-room'] },
    ] satisfies ShopItem[],
```

Note: `GAME_CONFIG` is `as const`; `satisfies ShopItem[]` validates each literal against the union without widening. The `kind: 'decor'` literal narrows each to `DecorItem`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/config/gameConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/config/gameConfig.ts src/config/gameConfig.test.ts
git commit -m "feat: decor catalog (7 rooms, 50/100/150 tiers)"
```

---

## Task 5: Store — owned/activeBackground state, actions, persist v4 migrate

**Files:**
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts` (add decor + migrate-v4 blocks)

- [ ] **Step 1: Write failing tests — append to `src/state/gameStore.test.ts`**

```ts
describe('decor ownership', () => {
  const beach = GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!;

  it('starts with empty owned and null activeBackground', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().owned).toEqual([]);
    expect(useGameStore.getState().activeBackground).toBeNull();
  });

  it('buyDecor with enough coins spends coins and records ownership', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().pet.coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('buyDecor without enough coins is a no-op', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(10);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().pet.coins).toBe(10);
    expect(useGameStore.getState().owned).toEqual([]);
  });

  it('buyDecor twice does not double-charge or duplicate', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().buyDecor(beach);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().pet.coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('equipBackground sets and clears the active background', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipBackground('decor:beach');
    expect(useGameStore.getState().activeBackground).toBe('decor:beach');
    useGameStore.getState().equipBackground(null);
    expect(useGameStore.getState().activeBackground).toBeNull();
  });
});

describe('migrate v3 -> v4', () => {
  it('backfills owned=[] and activeBackground=null, preserves species backfill', () => {
    const { persist } = useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    };
    const migrated = persist.getOptions().migrate(
      { pet: { hatched: true, species: 'fire', coins: 5 }, inventory: { protein: 2 } },
      3,
    ) as { pet: { species: string; coins: number }; owned: string[]; activeBackground: string | null };
    expect(migrated.owned).toEqual([]);
    expect(migrated.activeBackground).toBeNull();
    expect(migrated.pet.species).toBe('fire'); // existing fields preserved
    expect(migrated.pet.coins).toBe(5);
  });

  it('preserves already-v4 owned/activeBackground values', () => {
    const { persist } = useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    };
    const migrated = persist.getOptions().migrate(
      { pet: { species: 'leaf' }, owned: ['decor:beach'], activeBackground: 'decor:beach' },
      4,
    ) as { owned: string[]; activeBackground: string | null };
    expect(migrated.owned).toEqual(['decor:beach']);
    expect(migrated.activeBackground).toBe('decor:beach');
  });
});
```

(`GAME_CONFIG` import: check the top of `gameStore.test.ts`; add `import { GAME_CONFIG } from '../config/gameConfig';` if absent.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `owned`/`activeBackground`/`buyDecor`/`equipBackground` undefined; migrate doesn't backfill.

- [ ] **Step 3: Implement in `src/state/gameStore.ts`**

(a) Imports — add `buyDecor` + `DecorItem`:

```ts
import { purchase } from '../domain/shop';
import type { TreatItem, DecorItem } from '../domain/shop';
import { buyDecor } from '../domain/decor';
```

(b) Extend `GameState` (after `lastReward`):

```ts
  owned: string[];
  activeBackground: string | null;
```

and in the actions section (after `buyTreat`):

```ts
  buyDecor: (item: DecorItem) => void;
  equipBackground: (id: string | null) => void;
```

(c) Initial state — add to the object passed to `create` (after `lastReward: null,`):

```ts
      owned: [],
      activeBackground: null,
```

(d) Action implementations — after `buyTreat`:

```ts
      buyDecor: (item) =>
        set((st) => {
          const res = buyDecor({ coins: st.pet.coins, owned: st.owned }, item);
          if (!res.ok) return st; // no-op; UI disables Buy when owned/too poor
          return { pet: { ...st.pet, coins: res.coins }, owned: res.owned };
        }),

      equipBackground: (id) => set({ activeBackground: id }),
```

(e) `resetForTest` — add the two fields to its `set({...})`:

```ts
        owned: [],
        activeBackground: null,
```

(f) Persist block — bump version + extend migrate:

```ts
      name: 'sentence-pet',
      version: 4,
      // v1->v2 inventory groups; v2->v3 pet.species; v3->v4 owned[] + activeBackground.
      migrate: (persisted: unknown) => {
        const st = persisted as
          | {
              inventory?: Partial<Record<FoodGroup, number>>;
              pet?: Partial<Pet>;
              owned?: string[];
              activeBackground?: string | null;
            }
          | null;
        if (!st) return st as unknown as GameState;
        return {
          selectedDrill: 'pattern',
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          pet: { ...freshPet(), ...(st.pet ?? {}), species: st.pet?.species ?? 'leaf' },
          owned: st.owned ?? [],
          activeBackground: st.activeBackground ?? null,
        } as GameState;
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify full suite + typecheck**

Run: `npm test -- --run`
Expected: PASS (all green).

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: persisted owned/activeBackground + buyDecor/equip + migrate v4"
```

---

## Task 6: `DecorCard` component

A card per room: thumbnail + name + price, with Buy / Owned-Equip / Equipped states.

**Files:**
- Create: `src/components/DecorCard.tsx`
- Test: `src/components/DecorCard.test.tsx`

- [ ] **Step 1: Write the failing test `src/components/DecorCard.test.tsx`**

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecorCard } from './DecorCard';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

const beach = GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!;

beforeEach(() => {
  useGameStore.getState().resetForTest();
});

describe('DecorCard', () => {
  it('shows name and price', () => {
    render(<DecorCard item={beach} coins={0} owned={false} active={false} index={0} />);
    expect(screen.getByText('Beach')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it('Buy with enough coins purchases the room', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<DecorCard item={beach} coins={100} owned={false} active={false} index={0} />);
    await userEvent.click(screen.getByRole('button', { name: /buy beach/i }));
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('Buy is disabled when unaffordable', () => {
    render(<DecorCard item={beach} coins={10} owned={false} active={false} index={0} />);
    expect(screen.getByRole('button', { name: /buy beach/i })).toBeDisabled();
  });

  it('owned + not active shows Equip; click equips', async () => {
    render(<DecorCard item={beach} coins={0} owned={true} active={false} index={0} />);
    await userEvent.click(screen.getByRole('button', { name: /equip beach/i }));
    expect(useGameStore.getState().activeBackground).toBe('decor:beach');
  });

  it('owned + active shows Equipped (disabled)', () => {
    render(<DecorCard item={beach} coins={0} owned={true} active={true} index={0} />);
    expect(screen.getByRole('button', { name: /equipped beach/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/DecorCard.test.tsx`
Expected: FAIL — cannot find module `./DecorCard`.

- [ ] **Step 3: Write `src/components/DecorCard.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { PressButton } from './PressButton';
import type { DecorItem } from '../domain/shop';

interface DecorCardProps {
  item: DecorItem;
  coins: number;   // live store coins (for affordability)
  owned: boolean;  // isOwned(owned, item.id)
  active: boolean; // activeBackground === item.id
  index: number;   // stagger-in delay
}

export function DecorCard({ item, coins, owned, active, index }: DecorCardProps) {
  const buyDecor = useGameStore((s) => s.buyDecor);
  const equipBackground = useGameStore((s) => s.equipBackground);
  const afford = coins >= item.price;

  // label drives the visible text AND the accessible name (aria via button text)
  const label = active ? 'Equipped' : owned ? 'Equip' : 'Buy';
  const disabled = active || (!owned && !afford);

  function handleClick() {
    if (active) return;
    if (owned) equipBackground(item.id);
    else if (afford) buyDecor(item);
  }

  const buttonStyle = active
    ? 'bg-emerald-600 text-white'
    : owned
      ? 'bg-emerald-500 text-white'
      : afford
        ? 'bg-amber-500 text-white'
        : 'bg-amber-200 text-amber-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex flex-col gap-2 rounded-xl bg-white/70 p-2 shadow"
    >
      <img
        src={item.sprite}
        alt={`${item.name} room`}
        className="h-24 w-full rounded-lg object-cover"
      />
      <div className="flex items-center justify-between px-1">
        <span className="font-semibold text-slate-700">{item.name}</span>
        {!owned && <span className="text-sm text-slate-500">🪙 {item.price}</span>}
      </div>
      <PressButton
        onClick={handleClick}
        disabled={disabled}
        aria-label={`${label} ${item.name}`}
        className={`min-h-10 w-full rounded-lg px-3 py-2 text-sm font-semibold shadow ${buttonStyle} ${disabled ? 'opacity-60' : ''}`}
      >
        {label}
      </PressButton>
    </motion.div>
  );
}
```

> If `PressButton` does not forward a `disabled` prop, check `src/components/PressButton.tsx` first. If it doesn't accept `disabled`, swap the `PressButton` for a `motion.button` (matching TreatCard's pattern) with `disabled={disabled}` and `whileTap={disabled ? undefined : { scale: 0.95 }}`. Keep the `aria-label`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/DecorCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/DecorCard.tsx src/components/DecorCard.test.tsx
git commit -m "feat: DecorCard (buy/equip/equipped states)"
```

---

## Task 7: Shop tabs — wire the Decor grid

**Files:**
- Modify: `src/components/Shop.tsx`
- Test: `src/components/Shop.test.tsx` (extend)

- [ ] **Step 1: Extend `src/components/Shop.test.tsx`**

**First fix a name collision the tabs introduce:** the existing test `renders title, coin balance, all 3 treats, and Back` asserts `getByRole('button', { name: /treat/i })`. Once a **"Treats" tab** button exists, `/treat/i` matches BOTH the tab and the Treat card → `getByRole` throws on multiple matches. Change that one assertion to target the card's fuller accessible name (the card shows price + happiness):

```tsx
// was: expect(screen.getByRole('button', { name: /treat/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /treat 🪙/i })).toBeInTheDocument();
```

(`/snack/i` and `/feast/i` are unambiguous — leave them.)

Then add tab + decor tests (keep the existing 3):

```tsx
  it('shows Treats and Decor tabs; treats visible by default', () => {
    render(<Shop />);
    expect(screen.getByRole('button', { name: /treats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decor/i })).toBeInTheDocument();
    // a treat is visible by default
    expect(screen.getByRole('button', { name: /snack/i })).toBeInTheDocument();
  });

  it('switching to Decor tab shows room cards', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /^decor$/i }));
    expect(screen.getByRole('button', { name: /buy beach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy fire room/i })).toBeInTheDocument();
  });

  it('buying a room (with coins) from the Decor tab records ownership', async () => {
    useGameStore.getState().addCoinsForTest(200);
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /^decor$/i }));
    await userEvent.click(screen.getByRole('button', { name: /buy beach/i }));
    expect(useGameStore.getState().owned).toContain('decor:beach');
  });
```

Note: the default-treats test (`renders title... all 3 treats`) still passes because treats is the default tab. The `Back` button stays visible across tabs.

- [ ] **Step 2: Run to verify new tests fail**

Run: `npm test -- --run src/components/Shop.test.tsx`
Expected: FAIL — no Treats/Decor tab buttons; decor cards not rendered.

- [ ] **Step 3: Rewrite `src/components/Shop.tsx` with tabs**

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { TreatCard } from './TreatCard';
import { DecorCard } from './DecorCard';
import { isOwned } from '../domain/decor';

type Tab = 'treats' | 'decor';

export function Shop() {
  const coins = useGameStore((s) => s.pet.coins);
  const happiness = useGameStore((s) => s.pet.happiness);
  const owned = useGameStore((s) => s.owned);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const setScreen = useGameStore((s) => s.setScreen);
  const shownCoins = useCountUp(coins);
  const full = happiness >= GAME_CONFIG.happiness.max;
  const [tab, setTab] = useState<Tab>('treats');

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {shownCoins}</p>
      </div>

      <div className="mt-3 flex gap-2">
        {(['treats', 'decor'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'treats' ? (
        <div className="flex flex-1 flex-col justify-center gap-3">
          {GAME_CONFIG.shop.treats.map((item, index) => (
            <TreatCard key={item.id} item={item} coins={coins} full={full} index={index} />
          ))}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto py-3">
          {GAME_CONFIG.shop.decor.map((item, index) => (
            <DecorCard
              key={item.id}
              item={item}
              coins={coins}
              owned={isOwned(owned, item.id)}
              active={activeBackground === item.id}
              index={index}
            />
          ))}
        </div>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setScreen('petRoom')}
        className="mt-3 min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </motion.button>
    </div>
  );
}
```

> `GAME_CONFIG.shop.treats` is typed `TreatItem[]` (via `satisfies ShopItem[]` + literal `kind: 'treat'`). If TS complains that `TreatCard`'s `item: TreatItem` doesn't accept the `treats` element, it means the literal widened — verify Task 1/Task 4 kept `kind: 'treat'`/`kind: 'decor'` as literals. No cast should be needed.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --run src/components/Shop.test.tsx`
Expected: PASS (existing 3 + new 3 = 6).

- [ ] **Step 5: Verify full suite + typecheck**

Run: `npm test -- --run`
Expected: PASS.

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Shop.tsx src/components/Shop.test.tsx
git commit -m "feat: shop Treats|Decor tabs with decor grid"
```

---

## Task 8: PetRoom renders the active background + legibility scrim

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx` (extend)

- [ ] **Step 1: Extend `src/components/PetRoom.test.tsx`**

Add (check existing imports for `useGameStore`/`GAME_CONFIG`; add `import { GAME_CONFIG } from '../config/gameConfig';` if missing). Use `resetForTest` in a `beforeEach` if the file doesn't already.

```tsx
  it('shows no room background image by default (free default)', () => {
    useGameStore.getState().resetForTest();
    render(<PetRoom />);
    expect(screen.queryByTestId('room-bg')).toBeNull();
  });

  it('renders the active room background when one is equipped', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipBackground('decor:beach');
    render(<PetRoom />);
    const bg = screen.getByTestId('room-bg');
    expect(bg).toBeInTheDocument();
    expect(bg).toHaveAttribute('src', GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!.sprite);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: FAIL — no `room-bg` testid element.

- [ ] **Step 3: Update `src/components/PetRoom.tsx`**

Add imports + a background layer behind the existing content. The root becomes `relative`; when a background is active, render the room `<img>` (`absolute inset-0`, `object-cover`) and a radial scrim behind the centred pet/stats.

Add near the other selectors:

```tsx
import { DECOR_SPRITES } from '../config/decorSprites';
```
```tsx
  const activeBackground = useGameStore((s) => s.activeBackground);
  const bgSprite = activeBackground ? DECOR_SPRITES[activeBackground] : null;
```

Change the outer wrapper to layer the background. Replace the opening `<div className="flex h-full flex-col bg-emerald-50 p-6">` with:

```tsx
    <div className={`relative flex h-full flex-col overflow-hidden p-6 ${bgSprite ? '' : 'bg-emerald-50'}`}>
      {bgSprite && (
        <>
          <img
            data-testid="room-bg"
            src={bgSprite}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* radial scrim: keeps the transparent-cutout pet + stats legible over busy art */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 45% at 50% 42%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)',
            }}
          />
        </>
      )}
      {/* content sits above the background layers */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
```

Then the existing pet/stats block continues inside that `z-10` middle zone, and the bottom action zone must also be raised. Wrap the bottom `<div className="flex flex-col gap-3">` to `<div className="relative z-10 flex flex-col gap-3">`.

Final structure (for reference — only the wrappers change, inner content is unchanged):

```tsx
    <div className={`relative flex h-full flex-col overflow-hidden p-6 ${bgSprite ? '' : 'bg-emerald-50'}`}>
      {bgSprite && ( /* img + scrim, as above */ )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
        <PetSprite ... />
        <p ...>XP {xp} · 🪙 {coins}</p>
        <StatBars ... />
      </div>

      <div className="relative z-10 flex flex-col gap-3">
        {/* feed buttons + Shop + Play, unchanged */}
      </div>
    </div>
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify full suite + typecheck + build**

Run: `npm test -- --run`
Expected: PASS (all green).

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Manual smoke (dev server + DevPanel)**

Run: `npm run dev -- --host`
In the browser: open DevPanel (`dev` button) → `+coins` until ≥150 → Shop → Decor tab → Buy a room → Equip → Back. Confirm the room renders behind a legible pet, free default (no equip) still shows `bg-emerald-50`, and a busy room (Fire/Water) keeps the pet readable. Stop the server when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "feat: render equipped room background behind legibility scrim"
```

---

## Task 9: Docs — note the shipped decor shop

**Files:**
- Modify: `GAME_DESIGN.md` (repo root) §7
- Modify: `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` (mirror copy)

- [ ] **Step 1: Update §7 in the repo-root `GAME_DESIGN.md`**

In the shop/economy section, change the decor line from a roadmap note to shipped, and record the pricing tiers:

```markdown
- **Room/habitat decor — SHIPPED (Phase A).** 7 room backgrounds buyable with coins,
  tiered **50 / 100 / 150**, equipped behind the pet in PetRoom (radial scrim for legibility).
  Ownership is a generic persisted `owned: string[]` set (id-namespaced `decor:<slug>`) +
  `activeBackground` selector — Phase B (pet-unlocks) reuses the same set with `pet:<species>` ids.
```

- [ ] **Step 2: Copy the same edit into the H:\ mirror**

Apply the identical change to `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` §7 so both copies match (Phase 0 convention: edit one, copy to the other).

- [ ] **Step 3: Commit (repo-root copy only — the H:\ mirror is outside the repo)**

```bash
git add GAME_DESIGN.md
git commit -m "docs: mark decor shop shipped in GAME_DESIGN §7"
```

---

## Final verification (before PR)

- [ ] `npm test -- --run` — all green (159 prior + ~25 new).
- [ ] `npx tsc -b` — clean.
- [ ] `npm run build` — clean.
- [ ] `git branch --show-current` → `decor-shop` (guard against detached-HEAD after any `git show`/`checkout`).
- [ ] Open the PR:

```bash
git push -u origin decor-shop
gh pr create --title "Phase A: decor shop" --body "Buy/equip 7 room backgrounds. Generic owned[] + activeBackground (Phase B reuses). Persist v4 migrate. See docs/superpowers/specs/2026-06-25-decor-shop-design.md."
```

- [ ] Merge (preserve TDD history): `gh pr merge <N> --merge --delete-branch`, then `git fetch --prune`.
