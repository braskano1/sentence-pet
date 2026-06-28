import type { ContentBundle } from './model';
import type { Course, BossNode } from './course';
import type { ContentItem } from '../data/types';

/** Firestore document id for the default/legacy course. */
export const DEFAULT_COURSE_ID = 'default';

/** Stamp kind='dragdrop' on any pool item missing it (legacy content was all
 *  slot-fill). Preserves the original pool reference when nothing changes. */
function stampPoolKind(pool: Record<string, ContentItem>): Record<string, ContentItem> {
  let changed = false;
  const stamped: Record<string, ContentItem> = {};
  for (const [id, raw] of Object.entries(pool)) {
    const item = raw as ContentItem;
    if (item.kind) {
      stamped[id] = item;
    } else {
      stamped[id] = { ...(raw as object), kind: 'dragdrop' } as ContentItem;
      changed = true;
    }
  }
  return changed ? stamped : pool;
}

/** A default final boss reviewing every unit, so every Course shape always has
 *  one (lets validateCourse enforce final-boss presence without rejecting
 *  migrated/legacy courses). Authored courses override this in the admin UI. */
function defaultFinalBoss(courseId: string, unitIds: string[]): BossNode {
  return {
    id: `${courseId}-final`,
    title: 'Final Boss',
    scope: 'final',
    reviewsUnitIds: unitIds,
    reviewCount: 6,
    boss: { tierId: 'tier-3', element: 'leaf', name: 'Course Champion', rivalSprite: { species: 'leaf', stage: 'adult' } },
    onClear: 'completeCourse',
  };
}

/** Wrap the legacy two-doc bundle into a single default Course.
 *  Units missing l1Enabled default to false; lessons missing kind default to
 *  'dragdrop' (legacy content was all slot-fill). Pool items missing kind are
 *  likewise stamped 'dragdrop'. Idempotent. */
export function bundleToDefaultCourse(bundle: ContentBundle): Course {
  const units = bundle.units.map((u) => ({
    ...u,
    l1Enabled: u.l1Enabled ?? false,
    lessons: u.lessons.map((l) => ({ ...l, kind: l.kind ?? 'dragdrop' })),
  }));
  return {
    id: DEFAULT_COURSE_ID,
    title: 'Beginner Course',
    emoji: '📘',
    pool: stampPoolKind(bundle.pool),
    units,
    gates: [],
    finalBoss: defaultFinalBoss(DEFAULT_COURSE_ID, units.map((u) => u.id)),
  };
}
