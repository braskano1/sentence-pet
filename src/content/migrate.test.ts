import { describe, it, expect } from 'vitest';
import { bundleToDefaultCourse, DEFAULT_COURSE_ID } from './migrate';
import type { ContentBundle } from './model';
import { isDragDrop } from '../data/types';

const legacy: ContentBundle = {
  pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{
    id: 'u0', title: 'U0', emoji: '🐣', order: 0,
    // legacy units/lessons have neither l1Enabled nor kind:
    lessons: [{ id: 'l0', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  } as any],
};

describe('bundleToDefaultCourse', () => {
  it('wraps a legacy bundle into a default course with a synthesized final boss', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.id).toBe(DEFAULT_COURSE_ID);
    expect(c.pool).toBe(legacy.pool);
    expect(c.gates).toEqual([]);
    expect(c.finalBoss).toBeDefined();
    expect(c.finalBoss!.scope).toBe('final');
    expect(c.finalBoss!.onClear).toBe('completeCourse');
    // reviews every authored unit
    expect(c.finalBoss!.reviewsUnitIds).toEqual(c.units.map((u) => u.id));
    expect(c.finalBoss!.reviewCount).toBeGreaterThanOrEqual(1);
    expect(c.finalBoss!.boss).toBeDefined();
  });
  it('defaults l1Enabled=false on units and kind=dragdrop on lessons', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.units[0].l1Enabled).toBe(false);
    expect(c.units[0].lessons[0].kind).toBe('dragdrop');
  });
  it('is idempotent — re-running on already-migrated content keeps kind/l1Enabled', () => {
    const once = bundleToDefaultCourse(legacy);
    const twice = bundleToDefaultCourse(once as unknown as ContentBundle);
    expect(twice.units[0].l1Enabled).toBe(false);
    expect(twice.units[0].lessons[0].kind).toBe('dragdrop');
    expect(twice.id).toBe(DEFAULT_COURSE_ID);
    expect(twice.finalBoss?.reviewsUnitIds).toEqual(twice.units.map((u) => u.id));
  });
});

describe('migrate stamps kind', () => {
  it('legacy items without kind become dragdrop', () => {
    const legacy = {
      pool: { d1: { id: 'd1', drill: 'pattern', level: 1, thaiHint: 'แมว', slots: ['Pronoun'], answer: ['I'] } },
      units: [{ id: 'u1', title: 'U', emoji: '📘', order: 0, lessons: [
        { id: 'l1', drill: 'pattern', level: 1, itemIds: ['d1'], isCheckpoint: true },
      ] }],
    } as never;
    const course = bundleToDefaultCourse(legacy);
    expect(isDragDrop(course.pool.d1)).toBe(true);
    expect(course.pool.d1.kind).toBe('dragdrop');
  });
});
