import { describe, it, expect } from 'vitest';
import { JOURNEY, findLesson } from './journey';
import { itemsFor } from './wordBank';

describe('JOURNEY content', () => {
  it('has at least two units, ordered ascending with unique orders', () => {
    expect(JOURNEY.length).toBeGreaterThanOrEqual(2);
    const orders = JOURNEY.map((u) => u.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('every unit has lessons, exactly one checkpoint, and it is last', () => {
    for (const u of JOURNEY) {
      expect(u.lessons.length).toBeGreaterThan(0);
      const checkpoints = u.lessons.filter((l) => l.isCheckpoint);
      expect(checkpoints.length).toBe(1);
      expect(u.lessons[u.lessons.length - 1].isCheckpoint).toBe(true);
    }
  });

  it('all lesson ids are unique across the whole journey', () => {
    const ids = JOURNEY.flatMap((u) => u.lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every lesson (drill, level) resolves to at least one item', () => {
    for (const u of JOURNEY) {
      for (const l of u.lessons) {
        expect(itemsFor(l.drill, l.level).length).toBeGreaterThan(0);
      }
    }
  });

  it('findLesson resolves a known id to its unit + lesson', () => {
    const first = JOURNEY[0].lessons[0];
    const found = findLesson(first.id);
    expect(found?.lesson.id).toBe(first.id);
    expect(found?.unit.id).toBe(JOURNEY[0].id);
    expect(findLesson('nope')).toBeUndefined();
  });
});
