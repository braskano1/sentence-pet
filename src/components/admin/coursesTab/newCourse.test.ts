import { describe, it, expect } from 'vitest';
import { makeCourseId, emptyCourse } from './newCourse';

describe('makeCourseId', () => {
  it('slugifies the title', () => {
    expect(makeCourseId('Survival Thai!', [])).toBe('survival-thai');
  });

  it('disambiguates against existing ids', () => {
    expect(makeCourseId('Thai', ['thai'])).toBe('thai-2');
    expect(makeCourseId('Thai', ['thai', 'thai-2'])).toBe('thai-3');
  });

  it('falls back to "course" when the title has no slug characters', () => {
    expect(makeCourseId('!!!', [])).toBe('course');
  });
});

describe('emptyCourse', () => {
  it('builds a structurally-valid-but-empty course with the given meta', () => {
    const c = emptyCourse({ id: 'thai', title: 'Thai', emoji: '🇹🇭' });
    expect(c).toEqual({ id: 'thai', title: 'Thai', emoji: '🇹🇭', pool: {}, units: [], gates: [] });
  });
});
