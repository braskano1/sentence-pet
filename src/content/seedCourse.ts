// src/content/seedCourse.ts
import type { Course } from './course';
import { SEED } from './seed';
import { bundleToDefaultCourse } from './migrate';

/**
 * P3a fallback course: the migrated default course plus hand-authored example
 * gated + final bosses so the new boss-tier runtime is playable before P3b adds
 * admin authoring + seed regen. The gate sits after Next Steps and reviews the
 * first two units; the final boss reviews all three and completes the course.
 * All referenced item ids are dragdrop items in src/content/seed.ts.
 */
export const SEED_COURSE: Course = (() => {
  const base = bundleToDefaultCourse(SEED);
  return {
    ...base,
    gates: [
      {
        id: 'gate-midcourse',
        title: 'Midway Review',
        scope: 'gated',
        afterUnitId: 'u2-next-steps',
        reviewsUnitIds: ['u1-basics', 'u2-next-steps'],
        reviewCount: 5,
        pinnedItemIds: ['mx-l1-1'],
        boss: { tierId: 'tier-2', element: 'water', name: 'Riptide Reviewer', rivalSprite: { species: 'water', stage: 'adult' } },
      },
    ],
    finalBoss: {
      id: 'final-course',
      title: 'Grand Finale',
      scope: 'final',
      onClear: 'completeCourse',
      reviewsUnitIds: ['u1-basics', 'u2-next-steps', 'u3-challenge'],
      reviewCount: 6,
      pinnedItemIds: ['gr-l1-1'],
      boss: { tierId: 'tier-3', element: 'leaf', name: 'Course Champion', rivalSprite: { species: 'leaf', stage: 'adult' } },
    },
  };
})();
