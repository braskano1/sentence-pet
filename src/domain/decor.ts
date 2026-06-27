import type { DecorItem } from './shop';

export type BuyOwnableResult =
  | { ok: true; coins: number; owned: string[] }
  | { ok: false; reason: 'already-owned' | 'insufficient-coins' };

export type BuyDecorResult = BuyOwnableResult;

export function isOwned(owned: string[], id: string): boolean {
  return owned.includes(id);
}

/**
 * Pure. The generic "buy a permanently-owned thing" rule shared by decor + music.
 * already-owned is checked first: re-buying an owned item is meaningless
 * regardless of coins, and the UI shows Equip (not Buy) in that case.
 */
export function buyOwnable(
  state: { coins: number; owned: string[] },
  item: { id: string; price: number },
): BuyOwnableResult {
  if (isOwned(state.owned, item.id)) return { ok: false, reason: 'already-owned' };
  if (state.coins < item.price) return { ok: false, reason: 'insufficient-coins' };
  return {
    ok: true,
    coins: state.coins - item.price,
    owned: [...state.owned, item.id],
  };
}

/**
 * Pure. Validates then applies a decor purchase. No mutation.
 * Delegates to {@link buyOwnable}; kept as a named seam for the decor call site.
 */
export function buyDecor(
  state: { coins: number; owned: string[] },
  item: DecorItem,
): BuyDecorResult {
  return buyOwnable(state, item);
}
