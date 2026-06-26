import { describe, it, expect } from 'vitest';
import { SEED } from './seed';
import { validateContent } from './validate';
import { findLesson, itemsForLesson } from './model';
import { JOURNEY } from '../data/journey';
import { itemsFor } from '../data/wordBank';

describe('SEED content bundle', () => {
  it('passes validation', () => {
    expect(validateContent(SEED)).toEqual({ ok: true, errors: [] });
  });

  it('preserves every lesson id from the static JOURNEY', () => {
    const staticIds = JOURNEY.flatMap((u) => u.lessons.map((l) => l.id)).sort();
    const seedIds = SEED.units.flatMap((u) => u.lessons.map((l) => l.id)).sort();
    expect(seedIds).toEqual(staticIds);
  });

  it('migration parity: each lesson resolves to the same items as the old itemsFor(drill, level)', () => {
    for (const unit of SEED.units) {
      for (const lesson of unit.lessons) {
        const expected = itemsFor(lesson.drill, lesson.level).map((i) => i.id).sort();
        const got = itemsForLesson(SEED, lesson).map((i) => i.id).sort();
        expect(got).toEqual(expected);
        expect(got.length).toBeGreaterThan(0);
      }
    }
  });

  it('findLesson works against the seed', () => {
    const first = SEED.units[0].lessons[0];
    expect(findLesson(SEED, first.id)?.lesson.id).toBe(first.id);
  });
});
