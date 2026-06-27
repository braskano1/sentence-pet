// src/content/seedCourse.test.ts
import { describe, it, expect } from 'vitest';
import { SEED_COURSE } from './seedCourse';
import { validateCourse } from './validate';
import { resolveCourseBundle } from './journey';
import { findLesson } from './model';

const zero = () => 0;

describe('SEED_COURSE', () => {
  it('is a valid course', () => {
    expect(validateCourse(SEED_COURSE)).toEqual({ ok: true, errors: [] });
  });

  it('has one gated boss and a final boss', () => {
    expect(SEED_COURSE.gates).toHaveLength(1);
    expect(SEED_COURSE.gates[0].scope).toBe('gated');
    expect(SEED_COURSE.finalBoss?.scope).toBe('final');
    expect(SEED_COURSE.finalBoss?.onClear).toBe('completeCourse');
  });

  it('resolves to extra playable boss units with non-empty sampled items', () => {
    const b = resolveCourseBundle(SEED_COURSE, zero);
    const gate = findLesson(b, SEED_COURSE.gates[0].id);
    const final = findLesson(b, SEED_COURSE.finalBoss!.id);
    expect(gate?.lesson.itemIds.length).toBeGreaterThan(0);
    expect(final?.lesson.itemIds.length).toBeGreaterThan(0);
    expect(final?.lesson.onClear).toBe('completeCourse');
  });
});
