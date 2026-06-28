import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './db';
import type { ContentBundle, Unit } from '../content/model';
import type { Course, CourseIndexEntry } from '../content/course';
import { bundleToDefaultCourse, DEFAULT_COURSE_ID } from '../content/migrate';
import type { DrillItem, PetDef } from '../data/types';

const COURSES_INDEX = doc(db, 'content', 'coursesIndex');
const courseDoc = (id: string) => doc(db, 'content', 'courses', id, 'doc');
// Legacy docs (read-only fallback for one-time migration):
const LEGACY_POOL = doc(db, 'content', 'pool');
const LEGACY_JOURNEY = doc(db, 'content', 'journey');
const PET_DEFS = doc(db, 'content', 'petDefs');

/** Index for the course-select screen. Falls back to a synthetic default entry
 *  (so a not-yet-migrated install still lists the legacy content as a course). */
export async function fetchCoursesIndex(): Promise<CourseIndexEntry[]> {
  const snap = await getDoc(COURSES_INDEX);
  if (snap.exists()) return (snap.data()?.courses ?? []) as CourseIndexEntry[];
  return [{ id: DEFAULT_COURSE_ID, title: 'Beginner Course', emoji: '📘' }];
}

/** Read one course. If its doc is absent and id === default, migrate the legacy
 *  two-doc layout into a default course on the fly. Returns null if nothing exists. */
export async function fetchCourse(id: string): Promise<Course | null> {
  const snap = await getDoc(courseDoc(id));
  if (snap.exists()) return snap.data()?.course as Course;

  if (id === DEFAULT_COURSE_ID) {
    const [poolSnap, journeySnap] = await Promise.all([getDoc(LEGACY_POOL), getDoc(LEGACY_JOURNEY)]);
    const pool = (poolSnap.data()?.items ?? {}) as Record<string, DrillItem>;
    const units = (journeySnap.data()?.units ?? []) as Unit[];
    if (units.length === 0) return null;
    return bundleToDefaultCourse({ pool, units } as ContentBundle);
  }
  return null;
}

/** Write one course doc and upsert its index entry atomically. */
export async function saveCourse(course: Course): Promise<void> {
  const batch = writeBatch(db);
  batch.set(courseDoc(course.id), { course });
  // Read-modify-write of the index is not transactional; fine for single-admin P1. Use a Firestore transaction if concurrent admin writes matter (P3).
  const indexSnap = await getDoc(COURSES_INDEX);
  const existing = (indexSnap.data()?.courses ?? []) as CourseIndexEntry[];
  const entry: CourseIndexEntry = {
    id: course.id,
    title: course.title,
    ...(course.emoji !== undefined && { emoji: course.emoji }),
    ...(course.l1Ready !== undefined && { l1Ready: course.l1Ready }),
  };
  const merged = [...existing.filter((e) => e.id !== course.id), entry];
  batch.set(COURSES_INDEX, { courses: merged });
  await batch.commit();
}

// Legacy single-bundle save kept for admin code paths until P3.
export async function saveContent(bundle: ContentBundle): Promise<void> {
  await saveCourse(bundleToDefaultCourse(bundle));
}

// Legacy read kept because load.ts, App.test.tsx, AdminShell.test.tsx import it.
// NOTE: reads the legacy two-doc path; does NOT reflect saveCourse writes. load.ts migrates to fetchCourse in Task 6.
export async function fetchContent(): Promise<ContentBundle> {
  const [poolSnap, journeySnap] = await Promise.all([getDoc(LEGACY_POOL), getDoc(LEGACY_JOURNEY)]);
  const pool = (poolSnap.data()?.items ?? {}) as Record<string, DrillItem>;
  const units = (journeySnap.data()?.units ?? []) as Unit[];
  return { pool, units };
}

/** Read the pet-def catalog (single doc). Returns null if the doc is absent (caller falls back to built-ins). */
export async function fetchPetDefs(): Promise<PetDef[] | null> {
  const snap = await getDoc(PET_DEFS);
  if (!snap.exists()) return null;
  return (snap.data()?.defs ?? []) as PetDef[];
}

/** Overwrite the whole pet-def catalog doc. (P2 admin save uses this.) */
export async function savePetDefs(defs: PetDef[]): Promise<void> {
  const batch = writeBatch(db);
  batch.set(PET_DEFS, { defs });
  await batch.commit();
}
