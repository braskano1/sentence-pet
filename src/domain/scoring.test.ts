import { describe, it, expect } from 'vitest';
import { computeStars } from './scoring';

describe('computeStars', () => {
  it('3 stars for a clean clear (no hints, no mistakes)', () => {
    expect(computeStars({ hints: 0, mistakes: 0 })).toBe(3);
  });
  it('2 stars for one or two slips', () => {
    expect(computeStars({ hints: 1, mistakes: 0 })).toBe(2);
    expect(computeStars({ hints: 0, mistakes: 2 })).toBe(2);
  });
  it('1 star when slips reach three or more', () => {
    expect(computeStars({ hints: 2, mistakes: 1 })).toBe(1);
    expect(computeStars({ hints: 0, mistakes: 5 })).toBe(1);
  });
  it('never below 1 star (level is still cleared)', () => {
    expect(computeStars({ hints: 9, mistakes: 9 })).toBe(1);
  });
});
