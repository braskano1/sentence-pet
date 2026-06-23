import { describe, it, expect } from 'vitest';
import { decayBars, feedBar, health, decayHappiness, clamp } from './pet';
import type { NutritionBars } from '../data/types';

const full: NutritionBars = { protein: 60, veggie: 60, vitamin: 60, treat: 60 };

describe('clamp', () => {
  it('keeps value within 0..100', () => {
    expect(clamp(120)).toBe(100);
    expect(clamp(-5)).toBe(0);
    expect(clamp(50)).toBe(50);
  });
});

describe('decayBars', () => {
  it('subtracts 5 from every bar, floored at 0', () => {
    expect(decayBars({ protein: 3, veggie: 60, vitamin: 60, treat: 60 })).toEqual({
      protein: 0, veggie: 55, vitamin: 55, treat: 55,
    });
  });
});

describe('feedBar', () => {
  it('adds 15 to the named bar, capped at 100', () => {
    expect(feedBar(full, 'protein', 1).protein).toBe(75);
    expect(feedBar({ ...full, protein: 95 }, 'protein', 1).protein).toBe(100);
  });
  it('feeding N items adds 15*N', () => {
    expect(feedBar(full, 'protein', 5).protein).toBe(100); // 60 + 75 capped
    expect(feedBar({ ...full, protein: 0 }, 'protein', 5).protein).toBe(75);
  });
});

describe('health', () => {
  it('equals the lowest bar (min)', () => {
    expect(health({ protein: 80, veggie: 10, vitamin: 90, treat: 50 })).toBe(10);
  });
});

describe('decayHappiness', () => {
  it('subtracts 5, floored at 0', () => {
    expect(decayHappiness(3)).toBe(0);
    expect(decayHappiness(60)).toBe(55);
  });
});
