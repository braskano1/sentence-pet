import { describe, it, expect, beforeEach } from 'vitest';
import { useContentStore } from './store';
import { bundleToDefaultCourse } from './migrate';
import { BOSS_UNIT_PREFIX } from './journey';
import { SEED } from './seed';

describe('content store (course-aware)', () => {
  beforeEach(() => {
    const course = bundleToDefaultCourse(SEED);
    useContentStore.setState({ course, activeCourseId: course.id, status: 'fallback', bundle: { pool: course.pool, units: course.units } });
  });

  it('derives bundle from the active course', () => {
    const s = useContentStore.getState();
    expect(s.bundle.units).toBe(s.course!.units);
    expect(s.bundle.pool).toBe(s.course!.pool);
  });

  it('setCourse swaps the active course and status', () => {
    const next = { ...bundleToDefaultCourse(SEED), id: 'other', title: 'Other' };
    useContentStore.getState().setCourse(next, 'live');
    const s = useContentStore.getState();
    expect(s.activeCourseId).toBe('other');
    expect(s.status).toBe('live');
    // resolveCourseBundle appends synthetic boss units; authored units still match
    const authoredUnits = s.bundle.units.filter((u) => !u.id.startsWith(BOSS_UNIT_PREFIX));
    expect(authoredUnits).toStrictEqual(next.units);
  });

  it('setBundle wraps a bundle into the default course and syncs', () => {
    useContentStore.getState().setBundle({ pool: SEED.pool, units: SEED.units }, 'live');
    const s = useContentStore.getState();
    expect(s.activeCourseId).toBe('default');
    expect(s.status).toBe('live');
    // resolveCourseBundle appends synthetic boss units; authored units still match course units
    const authoredUnits = s.bundle.units.filter((u) => !u.id.startsWith(BOSS_UNIT_PREFIX));
    expect(authoredUnits).toStrictEqual(s.course!.units);
  });
});
