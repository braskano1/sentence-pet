import { describe, it, expect } from 'vitest';
import type { CourseIndexEntry } from '../content/course';
import { isCourseLocked } from './courseLock';

const idx: CourseIndexEntry[] = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

describe('isCourseLocked', () => {
  it('never locks the first course', () => {
    expect(isCourseLocked(idx, 0, {})).toBe(false);
  });
  it('locks a course whose predecessor is not complete', () => {
    expect(isCourseLocked(idx, 1, {})).toBe(true);
    expect(isCourseLocked(idx, 2, { a: true })).toBe(true);
  });
  it('unlocks a course once its predecessor is complete', () => {
    expect(isCourseLocked(idx, 1, { a: true })).toBe(false);
    expect(isCourseLocked(idx, 2, { a: true, b: true })).toBe(false);
  });
  it('respects a server-set locked flag', () => {
    const withLocked: CourseIndexEntry[] = [{ id: 'a', title: 'A', locked: true }];
    expect(isCourseLocked(withLocked, 0, {})).toBe(true);
  });
});
