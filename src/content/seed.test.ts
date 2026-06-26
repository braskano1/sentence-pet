import { describe, it, expect } from 'vitest';
import { SEED } from './seed';
import { validateContent } from './validate';
import { findLesson, itemsForLesson } from './model';

describe('SEED content bundle', () => {
  it('passes validation', () => {
    expect(validateContent(SEED)).toEqual({ ok: true, errors: [] });
  });

  it('has the expected migrated shape', () => {
    expect(SEED.units.length).toBe(2);
    expect(Object.keys(SEED.pool).length).toBe(30);
  });

  it('every lesson resolves to at least one pool item', () => {
    for (const u of SEED.units) for (const l of u.lessons) {
      expect(itemsForLesson(SEED, l).length).toBeGreaterThan(0);
    }
  });

  it('preserves the first lesson id and its items', () => {
    const found = findLesson(SEED, 'u1-pattern');
    expect(found?.lesson.id).toBe('u1-pattern');
    expect(found?.lesson.itemIds).toEqual(['l1-1', 'l1-2', 'l1-3', 'l1-4', 'l1-5']);
  });
});

describe('SEED.pool content invariants', () => {
  it('tokens are lowercase except "I" and all-caps acronyms like "TV"', () => {
    const allWords = Object.values(SEED.pool).flatMap((item) => [
      ...item.answer,
      ...(item.distractors ?? []),
      ...(item.traps ?? []).map((t) => t.word),
    ]);
    for (const word of allWords) {
      // Each space-separated token must be: lowercase, OR === 'I', OR all-uppercase
      for (const token of word.split(' ')) {
        const startsUpper = token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase();
        if (startsUpper) {
          expect(token === 'I' || token === token.toUpperCase()).toBe(true);
        }
      }
    }
  });

  it('every grammar item has at least one trap and each trap.word differs from every answer word', () => {
    const grammarItems = Object.values(SEED.pool).filter((i) => i.drill === 'grammar' || i.drill === 'mixed');
    for (const item of grammarItems) {
      expect(item.traps?.length).toBeGreaterThan(0);
      for (const trap of item.traps ?? []) {
        expect(item.answer).not.toContain(trap.word);
      }
    }
  });

  it('wordChoice items have distractors', () => {
    const wcItems = Object.values(SEED.pool).filter((i) => i.drill === 'wordChoice');
    for (const item of wcItems) {
      expect(item.distractors?.length).toBeGreaterThan(0);
    }
  });
});
