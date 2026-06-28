import type { CourseIndexEntry } from './course';
import { validateContent, validateCourse, validatePetDefs } from './validate';
import { fetchContent, fetchCourse, fetchCoursesIndex, fetchPetDefs } from '../firebase/content';
import { useContentStore } from './store';
import { setActivePetDefs } from '../domain/petDef';
import * as cache from './cache';

// Re-export cache primitives so existing importers (e.g. load.test.ts) still resolve.
export {
  CACHE_KEY,
  cachedBundle,
  writeCache,
  COURSE_CACHE_PREFIX,
  cachedCourse,
  writeCourseCache,
  PET_DEFS_CACHE_KEY,
  cachedPetDefs,
  writePetDefsCache,
} from './cache';

/** Fetch live content; swap + cache only if valid. Errors/invalid → keep current bundle. */
export async function hydrateContent(): Promise<void> {
  try {
    const live = await fetchContent();
    if (validateContent(live).ok) {
      useContentStore.getState().setBundle(live, 'live');
      cache.writeCache(live);
    }
  } catch {
    // offline / permission — keep fallback, never blank the game
  }
}

/** Fetch one live course; swap + cache only if valid. Errors → keep current. */
export async function hydrateCourse(id: string): Promise<void> {
  try {
    const live = await fetchCourse(id);
    if (live && validateCourse(live).ok) {
      useContentStore.getState().setCourse(live, 'live');
      cache.writeCourseCache(live);
    }
  } catch { /* offline / permission / not found — keep current fallback */ }
}

/** Fetch the course index for the select screen; [] on error. */
export async function loadCoursesIndex(): Promise<CourseIndexEntry[]> {
  try { return await fetchCoursesIndex(); } catch { return []; }
}

/** Fetch the live pet-def catalog; swap into the active registry + cache only if valid.
 *  Errors / invalid / absent → keep the current registry (built-ins or last-good cache). */
export async function hydratePetDefs(): Promise<void> {
  try {
    const live = await fetchPetDefs();
    if (live && validatePetDefs(live).ok) {
      setActivePetDefs(live);
      cache.writePetDefsCache(live);
    }
  } catch { /* offline / permission / absent — keep current fallback */ }
}
