import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { loadCoursesIndex } from '../content/load';
import type { CourseIndexEntry } from '../content/course';
import { isCourseLocked } from './courseLock';

/** First screen of the journey flow: pick a course, then enter its unit map. */
export function CourseSelect() {
  const selectCourse = useGameStore((s) => s.selectCourse);
  const courseComplete = useGameStore((s) => s.courseComplete);
  const [courses, setCourses] = useState<CourseIndexEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCoursesIndex().then((idx) => { if (alive) setCourses(idx); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Choose a course</h1>
      {courses === null && <p className="opacity-60">Loading…</p>}
      {courses?.length === 0 && <p className="opacity-60">No courses yet.</p>}
      <div className="flex flex-col gap-3">
        {courses?.map((c, i) => {
          const locked = isCourseLocked(courses, i, courseComplete);
          return (
            <button
              key={c.id}
              type="button"
              disabled={locked}
              onClick={() => selectCourse(c.id)}
              aria-label={locked ? `${c.title} - locked` : c.title}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left disabled:opacity-40"
            >
              <span aria-hidden="true" className="text-2xl">{c.emoji ?? '📘'}</span>
              <span className="flex flex-col">
                <span className="font-semibold">{c.title}</span>
                {c.l1Ready && <span className="text-xs opacity-60"><span aria-hidden="true">🇹🇭</span> L1-ready</span>}
              </span>
              {locked && <span aria-hidden="true" className="ml-auto text-sm opacity-60">🔒</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
