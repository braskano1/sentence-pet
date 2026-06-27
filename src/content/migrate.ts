import type { ContentBundle } from './model';
import type { Course } from './course';
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

/** Wrap the legacy two-doc bundle into a single default Course.
 *  Units missing l1Enabled default to false; lessons missing kind default to
 *  'dragdrop' (legacy content was all slot-fill). Pool items missing kind are
 *  likewise stamped 'dragdrop'. Idempotent. */
export function bundleToDefaultCourse(bundle: ContentBundle): Course {
  return {
    id: DEFAULT_COURSE_ID,
    title: 'Beginner Course',
    emoji: '📘',
    pool: stampPoolKind(bundle.pool),
    units: bundle.units.map((u) => ({
      ...u,
      l1Enabled: u.l1Enabled ?? false,
      lessons: u.lessons.map((l) => ({ ...l, kind: l.kind ?? 'dragdrop' })),
    })),
    gates: [],
  };
}
