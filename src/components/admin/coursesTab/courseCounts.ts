import type { Course } from '../../../content/course';

export interface CourseCounts {
  units: number;
  lessons: number;
  items: number;
  bosses: number;
}

/** Aggregate counts shown in the rail, the Courses list rows, and the Contents
 *  summary cards. `bosses` = gates + (final boss, if present). */
export function courseCounts(course: Course): CourseCounts {
  const lessons = course.units.reduce((n, u) => n + u.lessons.length, 0);
  return {
    units: course.units.length,
    lessons,
    items: Object.keys(course.pool).length,
    bosses: course.gates.length + (course.finalBoss ? 1 : 0),
  };
}
