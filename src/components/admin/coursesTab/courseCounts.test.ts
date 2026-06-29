import { describe, it, expect } from 'vitest';
import { courseCounts } from './courseCounts';
import type { Course } from '../../../content/course';

const COURSE: Course = {
  id: 'c1',
  title: 'C1',
  pool: { a: {} as never, b: {} as never, c: {} as never },
  units: [
    { id: 'u1', title: 'U1', emoji: '🐣', order: 1, l1Enabled: false,
      lessons: [{ id: 'l1', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['a'] },
                { id: 'l2', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['b'] }] },
    { id: 'u2', title: 'U2', emoji: '🐥', order: 2, l1Enabled: false,
      lessons: [{ id: 'l3', kind: 'dragdrop', drill: 'mixed', level: 1, itemIds: ['c'] }] },
  ],
  gates: [{ id: 'g1' } as never, { id: 'g2' } as never],
  finalBoss: { id: 'fb' } as never,
};

describe('courseCounts', () => {
  it('counts units, lessons, items, and bosses (gates + final)', () => {
    expect(courseCounts(COURSE)).toEqual({ units: 2, lessons: 3, items: 3, bosses: 3 });
  });

  it('counts a bare course with no final boss', () => {
    expect(courseCounts({ ...COURSE, gates: [], finalBoss: undefined }))
      .toEqual({ units: 2, lessons: 3, items: 3, bosses: 0 });
  });
});
