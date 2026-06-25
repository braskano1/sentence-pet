import { describe, expect, it } from 'vitest';
import { pullEgg } from './gacha';
import type { Rarity } from '../data/types';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

const TABLE = [
  { rarity: 'common' as Rarity,    weight: 65, band: [40, 60] as [number, number] },
  { rarity: 'rare' as Rarity,      weight: 25, band: [55, 75] as [number, number] },
  { rarity: 'epic' as Rarity,      weight: 8,  band: [72, 88] as [number, number] },
  { rarity: 'legendary' as Rarity, weight: 2,  band: [85, 90] as [number, number] },
];
const PRICE = 60;
// rng order consumed: [0] rarity, [1] species, [2..6] five stats.
const args = (rng: () => number) => ({ price: PRICE, id: 'pet-1', rng, table: TABLE });

describe('pullEgg', () => {
  it('rejects insufficient-coins, no mutation', () => {
    const state = { coins: 59 };
    expect(pullEgg(state, args(() => 0))).toEqual({ ok: false, reason: 'insufficient-coins' });
    expect(state).toEqual({ coins: 59 });
  });

  it('succeeds at exactly the price (coins -> 0)', () => {
    const res = pullEgg({ coins: 60 }, args(seq([0, 0, 0.5, 0.5, 0.5, 0.5, 0.5])));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.coins).toBe(0);
  });

  it('deducts price and returns a hatched pet with the rolled rarity + in-band stats', () => {
    const res = pullEgg({ coins: 200 }, args(seq([0, 0, 0.5, 0.5, 0.5, 0.5, 0.5])));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.coins).toBe(140);
    expect(res.pet).toMatchObject({ id: 'pet-1', hatched: true, rarity: 'common', xp: 0 });
    for (const v of Object.values(res.pet.stats)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(60);
    }
  });

  it('rolls a legendary with near-max stats when rng is high', () => {
    const res = pullEgg({ coins: 200 }, args(seq([0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999])));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pet.rarity).toBe('legendary');
    expect(res.pet.stats.hp).toBe(90);
  });

  it('picks species uniformly from the 4 by the species rng', () => {
    const water = pullEgg({ coins: 200 }, args(seq([0, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5])));
    expect(water.ok && water.pet.species).toBe('water');
  });

  it('does not mutate input state on success', () => {
    const state = { coins: 200 };
    pullEgg(state, args(seq([0, 0, 0.5, 0.5, 0.5, 0.5, 0.5])));
    expect(state).toEqual({ coins: 200 });
  });
});
