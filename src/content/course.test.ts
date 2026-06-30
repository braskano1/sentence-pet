import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import { activeBundle, courseUnits } from './course';

const course: Course = {
  id: 'default',
  title: 'Beginner',
  pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Subject'], answer: ['I'] } },
  units: [{ id: 'u1', title: 'U1', emoji: '🦊', order: 1, l1Enabled: false, lessons: [] },
          { id: 'u0', title: 'U0', emoji: '🐣', order: 0, l1Enabled: false, lessons: [] }],
  gates: [],
};

describe('course helpers', () => {
  it('activeBundle exposes the course pool + units as a ContentBundle', () => {
    const b = activeBundle(course);
    expect(b.pool).toBe(course.pool);
    expect(b.units).toBe(course.units);
  });
  it('courseUnits returns units sorted by order', () => {
    expect(courseUnits(course).map((u) => u.id)).toEqual(['u0', 'u1']);
  });
});
