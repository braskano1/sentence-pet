# Shop / economy — design (Phase 2 slice)

**Date:** 2026-06-25
**Status:** approved, ready for plan
**Slice:** Shop shell + plumbing, **happiness treats** as first stock. Decor / pet-unlocks deferred to later slices.

## Problem

Coins are earned every round (`pet.coins += 10 + 5×stars`, `gameConfig.coins`) and displayed, but there is **no spend path**. The core earn-loop has no sink, so coins and stars carry no weight. `GAME_DESIGN.md §7` calls for a shop (decor / treats / pet unlocks). Decor and pet-unlocks need partner art that is not delivered (`PetSprite` is still emoji). Treats are pure logic and buildable end-to-end today.

## Goal

Close the coin sink now with a **shop shell** whose first stock is **happiness treats** (instant-apply consumables). Build the catalog/affordability/purchase plumbing so decor and pet-unlocks later are mostly data + their own persist bump.

## Decisions (from brainstorming)

1. **Scope:** shop shell + plumbing + treats first; decor/pets are later stock slots (option D).
2. **Treat effect:** boosts **happiness** only. Chosen because happiness is the one stat with no inventory path today (otherwise grows only by playing, decays −5/round). Keeps treats **orthogonal to the nutrition engine** — bars stay drill-fed → no balance risk to the play→food→feed core loop. Avoids collision with the existing `treat` nutrition bar (4th food group, fed by mixed drill).
3. **Purchase model:** **instant-apply**. Tap buy → coins decrement, happiness increases immediately. No treat inventory.
4. **Persist:** **NO bump.** Coins and happiness are already persisted; instant-apply adds no new field. version stays **2**, `migrate` untouched. The 2→3 bump arrives later with decor/pets (which need a persisted `owned` set). YAGNI — do not add an empty `owned` set for items that don't exist yet.
5. **Catalog:** 3 happiness-treat tiers (value ladder so a treats-only shop feels alive and exercises affordability logic at multiple price points).
6. **Nav:** Shop button in **PetRoom** (the hub); back returns to petRoom.
7. **Feedback:** confetti on successful purchase (reuse `src/effects/celebrate.ts`).

## Components

### 1. Pure domain — `src/domain/shop.ts` (new)
jsdom-safe, unit-tested exhaustively (real logic lives in pure modules per project convention).

```ts
export type ShopItemKind = 'treat'; // future: 'decor' | 'pet'

export interface ShopItem {
  id: string;
  name: string;
  kind: ShopItemKind;
  price: number;       // coins
  happiness: number;   // boost applied (treat kind)
}

export function canAfford(coins: number, item: ShopItem): boolean;

// Pure. No mutation. Validates affordability; applies effect with happiness clamped to max.
// Returns { ok: true, coins, happiness } on success,
//         { ok: false, reason: 'insufficient-coins' | 'happiness-full' } otherwise.
export function purchase(
  state: { coins: number; happiness: number },
  item: ShopItem,
  happinessMax: number,
): PurchaseResult;
```

- `canAfford` — `coins >= item.price`.
- `purchase` — rejects with `'insufficient-coins'` if not affordable; rejects with `'happiness-full'` if `happiness >= happinessMax` (no point spending); else returns `coins - price` and `min(happinessMax, happiness + item.happiness)`.
- The reject reasons drive the disabled-button copy in the UI.

### 2. Config — `src/config/gameConfig.ts`
Add a `shop` block with the treat catalog (data, tunable):

```ts
shop: {
  treats: [
    { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 },
    { id: 'treat', name: 'Treat', kind: 'treat', price: 30, happiness: 35 },
    { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 },
  ],
}
```

(Numbers tunable. `happiness.max` already in config = 100; Feast overflow clamps.)

### 3. Store — `src/state/gameStore.ts`
- New action `buyTreat(item: ShopItem)`:
  - calls `purchase({ coins, happiness }, item, GAME_CONFIG.happiness.max)`.
  - on `ok`, sets `pet.coins` + `pet.happiness`.
  - on reject, no-op (UI already disables the button; action is defensive).
- **No persist changes.** version 2, migrate untouched.
- Add a test-helper path if needed for setting coins (there is `addXpForTest`; mirror with a coin setter only if tests need it — prefer driving via `finishRound`/`resetForTest`).

### 4. Screen — `src/components/Shop.tsx` (new)
- `Screen` type (`src/data/types.ts`) gains `'shop'`.
- Renders: coin balance, 3 treat cards (name / price / `+happiness` / Buy button), Back button → `setScreen('petRoom')`.
- Buy button **disabled** when `!canAfford(coins, item)` **OR** `happiness >= max`. Greyed + reason text ("Not enough coins" / "Already happy!").
- On successful buy: call `buyTreat`, fire `celebrate()` confetti.
- Component test = render-only: mount-without-throwing, static text present, clicking plain Buy/Back buttons. **Mock `canvas-confetti`** (transitively imports `celebrate.ts`). Never assert animated values.

### 5. Nav — `src/components/PetRoom.tsx`
- Add "Shop" button → `setScreen('shop')`.

### 6. Routing — `src/App.tsx`
- Add `case 'shop'` → `<Shop />`.

## Data flow

`PetRoom` → Shop button → `screen='shop'` → `Shop` reads `pet.coins`/`pet.happiness` + `GAME_CONFIG.shop.treats` → tap Buy → `buyTreat(item)` → `purchase()` pure logic → store updates `pet.coins`/`pet.happiness` → confetti → card re-evaluates affordability/full-state (button may now disable).

## Edge cases

- **Happiness full (100):** all Buy buttons disabled with "Already happy!". Prevents wasted coins.
- **Unaffordable tier:** that tier's Buy disabled with "Not enough coins"; cheaper tiers may still be buyable.
- **Feast overflow:** `happiness + 80` clamps to 100 (some boost wasted, but buy was allowed since happiness < 100). Acceptable.
- **Exact-coins purchase:** `coins == price` is affordable (`>=`).

## Testing

- `src/domain/shop.test.ts` — exhaustive: `canAfford` boundaries (below/equal/above price), `purchase` success (coins decrement, happiness add, clamp), both reject reasons, no-mutation of input.
- `gameStore.test.ts` — `buyTreat` happy path (coins down, happiness up), unaffordable no-op, happiness-full no-op.
- `Shop.test.tsx` — render-only: mounts, shows balance + 3 tiers, Buy disabled states render, Back button clickable. Mock confetti.
- `PetRoom.test.tsx` — Shop button present + navigates.

## Out of scope (later slices)

- Decor (room furniture/backgrounds) — needs art + persisted `owned` set → **2→3 persist bump**.
- Pet unlocks (new species) — blocked on art (`PetSprite` emoji).
- Treat stockpiling / inventory — treats are instant-apply by decision.
- a11y pass on shop buttons — fold into the deferred accessibility pass (project has `accessibility` skill).

## Docs to sync on landing

`GAME_DESIGN.md` (repo root + H: copy) — add "Shop (treats shipped)" note under §7 / §12 matrix.
