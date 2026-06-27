import { describe, it, expect } from 'vitest';
import { bundleToDefaultCourse, DEFAULT_COURSE_ID } from './migrate';
import type { ContentBundle } from './model';

const legacy: ContentBundle = {
  pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{
    id: 'u0', title: 'U0', emoji: '🐣', order: 0,
    // legacy units/lessons have neither l1Enabled nor kind:
    lessons: [{ id: 'l0', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  } as any],
};

describe('bundleToDefaultCourse', () => {
  it('wraps a legacy bundle into a default course', () => {
    const c = bundleToDefaultCourse(legacy);
    expect(c.id).toBe(DEFAULT_COURSE_ID);
    expect(c.pool).toBe(legacy.pool);
    expect(c.gates).toEqual([]);
    expect(c.finalBoss).toBeUndefined();
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
  });
});
