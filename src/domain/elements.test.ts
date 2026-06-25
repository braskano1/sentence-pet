import { describe, expect, it } from 'vitest';
import { typeMultiplier, strongAgainst, weakAgainst, STRONG_VS, TYPE_STRONG, TYPE_WEAK, TYPE_NEUTRAL } from './elements';
import type { Species } from '../data/types';

const ALL: Species[] = ['leaf', 'fire', 'air', 'water'];

describe('STRONG_VS wheel', () => {
  it('is the cycle water>fire>air>leaf>water', () => {
    expect(STRONG_VS).toEqual({ water: 'fire', fire: 'air', air: 'leaf', leaf: 'water' });
  });
  it('is a 4-cycle: every species appears exactly once as a value', () => {
    const values = ALL.map((s) => STRONG_VS[s]).sort();
    expect(values).toEqual([...ALL].sort());
  });
});

describe('typeMultiplier', () => {
  it('strong matchups return 1.5', () => {
    expect(typeMultiplier('water', 'fire')).toBe(TYPE_STRONG);
    expect(typeMultiplier('fire', 'air')).toBe(TYPE_STRONG);
    expect(typeMultiplier('air', 'leaf')).toBe(TYPE_STRONG);
    expect(typeMultiplier('leaf', 'water')).toBe(TYPE_STRONG);
  });
  it('weak matchups (defender beats attacker) return 0.75', () => {
    expect(typeMultiplier('fire', 'water')).toBe(TYPE_WEAK);
    expect(typeMultiplier('air', 'fire')).toBe(TYPE_WEAK);
    expect(typeMultiplier('leaf', 'air')).toBe(TYPE_WEAK);
    expect(typeMultiplier('water', 'leaf')).toBe(TYPE_WEAK);
  });
  it('everything else (incl. same element) is neutral 1.0', () => {
    for (const a of ALL) {
      expect(typeMultiplier(a, a)).toBe(TYPE_NEUTRAL);
    }
    expect(typeMultiplier('water', 'air')).toBe(TYPE_NEUTRAL);
    expect(typeMultiplier('fire', 'leaf')).toBe(TYPE_NEUTRAL);
  });
  it('covers all 16 pairs as exactly 4 strong / 4 weak / 8 neutral', () => {
    let strong = 0, weak = 0, neutral = 0;
    for (const a of ALL) for (const d of ALL) {
      const m = typeMultiplier(a, d);
      if (m === TYPE_STRONG) strong++;
      else if (m === TYPE_WEAK) weak++;
      else neutral++;
    }
    expect([strong, weak, neutral]).toEqual([4, 4, 8]);
  });
});

describe('strongAgainst / weakAgainst', () => {
  it('strongAgainst returns the beaten element', () => {
    expect(strongAgainst('water')).toBe('fire');
    expect(strongAgainst('leaf')).toBe('water');
  });
  it('weakAgainst returns the element that beats it', () => {
    expect(weakAgainst('fire')).toBe('water');
    expect(weakAgainst('leaf')).toBe('air');
  });
});
