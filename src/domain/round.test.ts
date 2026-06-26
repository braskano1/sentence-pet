// src/domain/round.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRound } from './round';
import type { DrillItem } from '../data/types';

const pattern: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };
const flag: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
  strictness: 'flag',
};
const enforce = { ...flag, strictness: 'enforce' as const };

describe('resolveRound', () => {
  it('returns retry with the wrong slot indices and a trap tip when present', () => {
    const item = {
      answer: ['She', 'feeds', 'the cat'],
      traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
      strictness: 'enforce' as const,
    };
    const action = resolveRound({ item, filled: ['She', 'feed', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('feeds (he/she) takes -s');
    }
  });

  it('returns retry with tip null when no trap explains the slip', () => {
    const item = { answer: ['She', 'feeds', 'the cat'], traps: [], strictness: undefined };
    const action = resolveRound({ item, filled: ['She', 'eats', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBeNull();
    }
  });

  it('correct but not last item -> advance, no flags', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 2, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 3, flags: [] });
  });

  it('correct and last item with no mistakes -> finish with 3 stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'finish', stars: 3, flags: [] });
  });

  it('flag mode near-miss not last -> advance and carries the tip', () => {
    const action = resolveRound({ item: flag, filled: ['he', 'eat'], index: 1, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 2, flags: ['เขา → he eats 👍'] });
  });

  it('flag mode near-miss counts as one slip toward stars on the last item', () => {
    const action = resolveRound({ item: flag, filled: ['he', 'eat'], index: 4, total: 5, mistakes: 0 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBe(2); // one slip (the flag) -> 2 stars
      expect(action.flags).toEqual(['เขา → he eats 👍']);
    }
  });

  it('enforce mode near-miss -> retry (no pass, no food)', () => {
    const action = resolveRound({ item: enforce, filled: ['he', 'eat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
  });

  it('correct last item WITH prior mistakes -> finish with fewer stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 2 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBeLessThan(3);
    }
  });

  it('prior mistake plus a flag on the final item sum into the slip count', () => {
    // 1 prior retry mistake + 1 flag slip = 2 slips -> 2 stars
    const action = resolveRound({ item: flag, filled: ['he', 'eat'], index: 4, total: 5, mistakes: 1 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBe(2);
      expect(action.flags).toEqual(['เขา → he eats 👍']);
    }
  });
});
