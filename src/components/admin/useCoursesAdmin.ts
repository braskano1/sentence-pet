import { useCallback, useEffect, useState } from 'react';
import { useContentStore } from '../../content/store';
import { fetchCoursesIndex, fetchCourse, saveCourse, deleteCourse } from '../../firebase/content';
import type { CourseIndexEntry } from '../../content/course';
import { emptyCourse, makeCourseId } from './coursesTab/newCourse';

/** Owns the course index + switch/create/delete actions. Instantiate ONCE in
 *  the shell and pass `index`/`activeCourseId`/actions down (single source). */
export function useCoursesAdmin() {
  const [index, setIndex] = useState<CourseIndexEntry[]>([]);
  const activeCourseId = useContentStore((s) => s.activeCourseId);
  const setCourse = useContentStore((s) => s.setCourse);

  const refresh = useCallback(async () => {
    setIndex(await fetchCoursesIndex());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const switchTo = useCallback(async (id: string) => {
    const course = await fetchCourse(id);
    if (course) setCourse(course, 'live');
  }, [setCourse]);

  const create = useCallback(async (meta: { title: string; emoji?: string }) => {
    const existing = await fetchCoursesIndex();
    const course = emptyCourse({ id: makeCourseId(meta.title, existing.map((e) => e.id)), ...meta });
    await saveCourse(course);
    await refresh();
    setCourse(course, 'live');
  }, [refresh, setCourse]);

  const remove = useCallback(async (id: string) => {
    await deleteCourse(id);
    await refresh();
    // If the active course was deleted, switch to the first surviving one.
    if (id === useContentStore.getState().activeCourseId) {
      const survivors = await fetchCoursesIndex();
      if (survivors[0]) await switchTo(survivors[0].id);
    }
  }, [refresh, switchTo]);

  return { index, activeCourseId, refresh, switchTo, create, remove };
}
