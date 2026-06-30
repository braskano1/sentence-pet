import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { loadCoursesIndex } from '../content/load';
import type { CourseIndexEntry } from '../content/course';
import { isCourseLocked } from '../domain/courseLock';
import { PressButton } from './PressButton';
import { SettingsButton } from './SettingsButton';

/** First screen of the journey flow: pick a course, then enter its unit map.
 *  Shares the overworld theme (indigo gradient + white chrome) with JourneyMap so
 *  the hand-off into the unit map is seamless. */
export function CourseSelect() {
  const selectCourse = useGameStore((s) => s.selectCourse);
  const setScreen = useGameStore((s) => s.setScreen);
  const courseComplete = useGameStore((s) => s.courseComplete);
  const [courses, setCourses] = useState<CourseIndexEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCoursesIndex().then((idx) => { if (alive) setCourses(idx); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="grid h-full grid-rows-[auto_1fr] bg-gradient-to-b from-indigo-100 to-indigo-50">
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-700 shadow"
          aria-label="Back to pet room"
        >
          ←
        </PressButton>
        <h1 className="text-lg font-extrabold text-indigo-900">Choose a course</h1>
        <SettingsButton className="ml-auto h-10 w-10 text-indigo-700" />
      </header>

      <div className="min-h-0 overflow-y-auto px-4 pb-6 pt-1">
        {courses === null && (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-white/70 shadow-sm" />
            ))}
          </div>
        )}
        {courses === null && <span className="sr-only" role="status">Loading courses…</span>}

        {courses?.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-2 text-center text-indigo-900/70">
            <span aria-hidden="true" className="text-4xl">📭</span>
            <p className="font-semibold">No courses yet</p>
            <p className="text-sm">Check back soon — new adventures are on the way.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {courses?.map((c, i) => {
            const locked = isCourseLocked(courses, i, courseComplete);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <PressButton
                  disabled={locked}
                  onClick={() => selectCourse(c.id)}
                  aria-label={locked ? `${c.title} - locked` : c.title}
                  className="flex w-full items-center gap-3 rounded-2xl border-b-4 border-indigo-100 bg-white px-4 py-3.5 text-left shadow ring-1 ring-black/5 active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:border-b-2 disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${locked ? 'bg-slate-100 grayscale' : 'bg-indigo-100'}`}
                  >
                    {c.emoji ?? '📘'}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-bold text-indigo-900">{c.title}</span>
                    {c.l1Ready && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">
                        <span aria-hidden="true">🇹🇭</span> Thai ready
                      </span>
                    )}
                  </span>
                  {locked ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                      <span aria-hidden="true">🔒</span> Locked
                    </span>
                  ) : (
                    <span aria-hidden="true" className="ml-auto shrink-0 text-xl font-bold text-indigo-300">→</span>
                  )}
                </PressButton>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
