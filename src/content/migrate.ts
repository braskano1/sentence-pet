import type { ContentBundle } from './model';
import type { Course } from './course';

/** Firestore document id for the default/legacy course. */
export const DEFAULT_COURSE_ID = 'default';

/** Wrap the legacy two-doc bundle into a single default Course.
 *  Units missing l1Enabled default to false; lessons missing kind default to
 *  'dragdrop' (legacy content was all slot-fill). Idempotent. */
export function bundleToDefaultCourse(bundle: ContentBundle): Course {
  return {
    id: DEFAULT_COURSE_ID,
    title: 'Beginner Course',
    emoji: '📘',
    pool: bundle.pool,
    units: bundle.units.map((u) => ({
      ...u,
      l1Enabled: u.l1Enabled ?? false,
      lessons: u.lessons.map((l) => ({ ...l, kind: l.kind ?? 'dragdrop' })),
    })),
    gates: [],
  };
}
