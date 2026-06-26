import { describe, it, expect } from 'vitest';
import { SEED } from './seed';
import { validateContent } from './validate';
import { findLesson, itemsForLesson } from './model';

describe('SEED content bundle', () => {
  it('passes validation', () => {
    expect(validateContent(SEED)).toEqual({ ok: true, errors: [] });
  });

  // Snapshot tripwire: the bundled SEED only changes via a deliberate `npm run seed:export`
  // commit (admin edits go to Firestore, not this file). Bump these if you regenerate SEED.
  it('has the expected migrated shape', () => {
    expect(SEED.units.length).toBe(2);
    expect(Object.keys(SEED.pool).length).toBe(30);
  });

  it('no item carries a strictness field anymore', () => {
    for (const item of Object.values(SEED.pool)) {
      expect('strictness' in item).toBe(false);
    }
  });

  it('L2 grammar sentences differ from L1 grammar sentences', () => {
    const sentences = (level: number) =>
      Object.values(SEED.pool)
        .filter((i) => i.drill === 'grammar' && i.level === level)
        .map((i) => i.answer.join(' '))
        .sort();
    const l1 = sentences(1);
    const l2 = sentences(2);
    expect(l2.length).toBe(5);
    for (const s of l2) expect(l1).not.toContain(s);
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
        if (!token) continue;
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
        expect(item.distractors ?? []).not.toContain(trap.word);
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
