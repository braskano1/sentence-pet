// src/domain/round.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRound } from './round';
import type { DrillItem } from '../data/types';

const pattern: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };
const grammar: Pick<DrillItem, 'answer' | 'traps'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};

describe('resolveRound', () => {
  it('returns retry with the wrong slot indices and a trap tip when present', () => {
    const item = {
      answer: ['She', 'feeds', 'the cat'],
      traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
    };
    const action = resolveRound({ item, filled: ['She', 'feed', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('feeds (he/she) takes -s');
    }
  });

  it('returns retry with tip null when no trap explains the slip', () => {
    const item = { answer: ['She', 'feeds', 'the cat'], traps: [] };
    const action = resolveRound({ item, filled: ['She', 'eats', 'the cat'], index: 0, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBeNull();
    }
  });

  it('a grammar near-miss now routes to retry and carries the trap tip', () => {
    const action = resolveRound({ item: grammar, filled: ['he', 'eat'], index: 1, total: 5, mistakes: 0 });
    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.wrongSlots).toEqual([1]);
      expect(action.tip).toBe('เขา → he eats 👍');
    }
  });

  it('correct but not last item -> advance', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 2, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 3 });
  });

  it('correct and last item with no mistakes -> finish with 3 stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'finish', stars: 3 });
  });

  it('correct last item WITH prior mistakes -> finish with fewer stars', () => {
    const action = resolveRound({ item: pattern, filled: ['I', 'run'], index: 4, total: 5, mistakes: 2 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBeLessThan(3);
    }
  });
});
