import { describe, expect, it } from 'vitest';
import { canAfford, purchase, type ShopItem, type TreatItem, type DecorItem } from './shop';

const snack: TreatItem = { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 };
const feast: TreatItem = { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 };

// compile-time: a decor item is a valid ShopItem and carries a sprite, not happiness
const _room: ShopItem = { id: 'decor:x', name: 'X', kind: 'decor', price: 50, sprite: 'x.webp' } satisfies DecorItem;
void _room;

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
