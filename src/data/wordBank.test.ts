import { describe, it, expect } from 'vitest';
import { WORD_BANK, itemsFor, trayWords } from './wordBank';

describe('WORD_BANK', () => {
  it('has 5 pattern items at level 1 and level 2', () => {
    expect(itemsFor('pattern', 1).length).toBe(5);
    expect(itemsFor('pattern', 2).length).toBe(5);
  });

  it('has 5 word-choice items at level 1, each with 2 distractors', () => {
    const wc = itemsFor('wordChoice', 1);
    expect(wc.length).toBe(5);
    for (const item of wc) {
      expect(item.distractors?.length).toBe(2);
    }
  });

  it('every item answer length equals its slots length', () => {
    for (const item of WORD_BANK) {
      expect(item.answer.length).toBe(item.slots.length);
    }
  });

  it('trayWords appends distractors to the answer', () => {
    const item = itemsFor('wordChoice', 1)[0];
    expect(trayWords(item)).toEqual([...item.answer, ...item.distractors!]);
  });

  it('trayWords equals the answer when there are no distractors', () => {
    const item = itemsFor('pattern', 1)[0];
    expect(trayWords(item)).toEqual(item.answer);
  });
});
