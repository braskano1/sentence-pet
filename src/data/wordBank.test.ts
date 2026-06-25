import { describe, it, expect } from 'vitest';
import { WORD_BANK, itemsFor, trayWords, levelsFor } from './wordBank';

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

  it('no item has a distractor that duplicates one of its answer words', () => {
    for (const item of WORD_BANK) {
      for (const d of item.distractors ?? []) {
        expect(item.answer).not.toContain(d);
      }
    }
  });

  it('has 5 grammar items at level 1 (flag) and level 2 (enforce)', () => {
    const l1 = itemsFor('grammar', 1);
    const l2 = itemsFor('grammar', 2);
    expect(l1.length).toBe(5);
    expect(l2.length).toBe(5);
    expect(l1.every((i) => i.strictness === 'flag')).toBe(true);
    expect(l2.every((i) => i.strictness === 'enforce')).toBe(true);
  });

  it('every grammar item has at least one trap', () => {
    for (const item of itemsFor('grammar', 1).concat(itemsFor('grammar', 2))) {
      expect(item.traps?.length).toBeGreaterThan(0);
    }
  });

  it('trayWords includes trap words after answer + distractors', () => {
    const item = itemsFor('grammar', 1)[0];
    const expected = [...item.answer, ...(item.distractors ?? []), ...(item.traps ?? []).map((t) => t.word)];
    expect(trayWords(item)).toEqual(expected);
  });

  it('no item has a trap word that duplicates an answer word or a distractor', () => {
    for (const item of WORD_BANK) {
      const otherTiles = [...item.answer, ...(item.distractors ?? [])];
      for (const t of item.traps ?? []) {
        expect(otherTiles).not.toContain(t.word);
      }
    }
  });

  it('every trap slot index is within the item answer range', () => {
    for (const item of WORD_BANK) {
      for (const t of item.traps ?? []) {
        expect(t.slot).toBeGreaterThanOrEqual(0);
        expect(t.slot).toBeLessThan(item.answer.length);
      }
    }
  });

  it('has 5 mixed items at level 1, each enforce with 1 trap + 1 distractor', () => {
    const mx = itemsFor('mixed', 1);
    expect(mx.length).toBe(5);
    for (const item of mx) {
      expect(item.strictness).toBe('enforce');
      expect(item.traps?.length).toBe(1);
      expect(item.distractors?.length).toBe(1);
      expect(item.slots.length).toBe(3);
    }
  });

  it('levelsFor returns sorted unique authored levels per drill', () => {
    expect(levelsFor('pattern')).toEqual([1, 2]);
    expect(levelsFor('grammar')).toEqual([1, 2]);
    expect(levelsFor('wordChoice')).toEqual([1]);
    expect(levelsFor('mixed')).toEqual([1]);
  });

  it('levelsFor returns [] for a drill with no items', () => {
    expect(levelsFor('nonexistent' as never)).toEqual([]);
  });
});
