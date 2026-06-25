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
