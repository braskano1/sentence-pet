import { create } from 'zustand';
import type { ContentBundle } from './model';
import type { Course } from './course';
import { resolveCourseBundle } from './journey';
import { SEED_COURSE } from './seed';
import { bundleToDefaultCourse } from './migrate';
import { cachedCourse } from './cache';

export type ContentStatus = 'fallback' | 'live';

interface ContentState {
  course: Course | null;
  activeCourseId: string | null;
  status: ContentStatus;
  /** Active course resolved to the legacy ContentBundle consumed by model/UI,
   *  with gated/final bosses materialised as synthetic checkpoint units. */
  bundle: ContentBundle;
  setCourse: (course: Course, status: ContentStatus) => void;
  /** Compat shim: legacy callers (hydrateContent, AdminShell) that pass a raw
   *  ContentBundle are wrapped into a default Course and forwarded to setCourse. */
  setBundle: (bundle: ContentBundle, status: ContentStatus) => void;
}

const firstCourse: Course = cachedCourse() ?? SEED_COURSE;

/** Module-level store so React + gameStore read the active course synchronously.
 *  `bundle` is kept in sync with `course` on every setCourse. Resolution samples
 *  boss review content once per setCourse (stable for the session). */
export const useContentStore = create<ContentState>((set, get) => ({
  course: firstCourse,
  activeCourseId: firstCourse.id,
  status: 'fallback',
  bundle: resolveCourseBundle(firstCourse, Math.random),
  setCourse: (course, status) =>
    set({ course, activeCourseId: course.id, status, bundle: resolveCourseBundle(course, Math.random) }),
  setBundle: (bundle, status) =>
    get().setCourse(bundleToDefaultCourse(bundle), status),
}));
