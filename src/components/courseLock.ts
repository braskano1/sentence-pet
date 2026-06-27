import type { CourseIndexEntry } from '../content/course';

/** A course is locked if a server flag says so, or if it is not the first entry
 *  and its predecessor (by index order) is not yet complete. The first course is
 *  always playable. `complete` is the player's courseComplete map. */
export function isCourseLocked(
  index: CourseIndexEntry[],
  i: number,
  complete: Record<string, boolean>,
): boolean {
  if (index[i]?.locked) return true;
  if (i <= 0) return false;
  return !complete[index[i - 1].id];
}
