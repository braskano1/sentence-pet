import { describe, it, expect } from 'vitest';
import { WORD_BANK, itemsForLevel } from './wordBank';

describe('WORD_BANK', () => {
  it('has level 1 and level 2 items', () => {
    expect(itemsForLevel(1).length).toBeGreaterThanOrEqual(5);
    expect(itemsForLevel(2).length).toBeGreaterThanOrEqual(5);
  });

  it('every item answer length equals its slots length', () => {
    for (const item of WORD_BANK) {
      expect(item.answer.length).toBe(item.slots.length);
    }
  });

  it('level 1 items are two-word S+V', () => {
    for (const item of itemsForLevel(1)) {
      expect(item.answer.length).toBe(2);
    }
  });
});
