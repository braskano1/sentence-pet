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
