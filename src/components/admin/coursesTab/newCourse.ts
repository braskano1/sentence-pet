import type { Course } from '../../../content/course';

/** kebab-case slug of `title`, deduped against `existingIds` (-2, -3, …). */
export function makeCourseId(title: string, existingIds: readonly string[]): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'course';
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A new, empty course scaffold. Not yet playable (no units/boss); the admin
 *  fills it in via the other surfaces. SaveBar gates persistence on validity. */
export function emptyCourse(meta: { id: string; title: string; emoji?: string }): Course {
  return {
    id: meta.id,
    title: meta.title,
    ...(meta.emoji !== undefined && { emoji: meta.emoji }),
    pool: {},
    units: [],
    gates: [],
  };
}
