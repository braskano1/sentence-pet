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
