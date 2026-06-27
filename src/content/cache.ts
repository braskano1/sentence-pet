import type { ContentBundle } from './model';
import type { Course } from './course';
import { validateContent, validateCourse } from './validate';
import { DEFAULT_COURSE_ID } from './migrate';

export const CACHE_KEY = 'sentence-pet-content';

/** Last-good bundle from localStorage, or null if absent/corrupt/invalid. */
export function cachedBundle(): ContentBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentBundle;
    return validateContent(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a known-good bundle as the last-good cache. */
export function writeCache(bundle: ContentBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // quota / disabled storage — non-fatal
  }
}

export const COURSE_CACHE_PREFIX = 'sentence-pet-course:';

/** Last-good cached Course for the active id (default if none requested). */
export function cachedCourse(id: string = DEFAULT_COURSE_ID): Course | null {
  try {
    const raw = localStorage.getItem(COURSE_CACHE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Course;
    return validateCourse(parsed).ok ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCourseCache(course: Course): void {
  try {
    localStorage.setItem(COURSE_CACHE_PREFIX + course.id, JSON.stringify(course));
  } catch { /* quota / disabled — non-fatal */ }
}
