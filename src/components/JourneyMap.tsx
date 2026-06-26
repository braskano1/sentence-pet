import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../content/model';
import type { Unit, Lesson } from '../content/model';
import { useContentStore } from '../content/store';
import type { DrillType } from '../data/types';
import { isUnitUnlocked, isLessonUnlocked, unitProgress, lessonCleared } from '../domain/journeyProgress';
import type { LessonStars } from '../domain/journeyProgress';
import { DRILL_FOOD, FOOD_META } from '../data/food';
import { PressButton } from './PressButton';

const DOT_COLOR: Record<DrillType, string> = {
  pattern: 'bg-emerald-200 text-emerald-800',
  wordChoice: 'bg-blue-200 text-blue-800',
  grammar: 'bg-amber-200 text-amber-900',
  mixed: 'bg-pink-200 text-pink-800',
};

function lessonLabel(unit: Unit, lesson: Lesson, stars: LessonStars, open: boolean): string {
  const what = lesson.isCheckpoint ? 'checkpoint' : `${lesson.drill} lesson`;
  const status = lessonCleared(stars, lesson.id)
    ? `cleared, ${stars[lesson.id]} stars`
    : open
      ? 'not started'
      : 'locked';
  return `${unit.title}: ${what}, ${status}`;
}

function dotContent(lesson: Lesson, stars: LessonStars): string {
  if (lessonCleared(stars, lesson.id)) return '✓';
  if (lesson.isCheckpoint) return '★';
  return FOOD_META[DRILL_FOOD[lesson.drill]].emoji;
}

export function JourneyMap() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLesson = useGameStore((s) => s.startLesson);
  const stars = useGameStore((s) => s.journey.lessonStars);
  const bundle = useContentStore((s) => s.bundle);
  const units = orderedUnits(bundle);

  return (
    <div className="flex h-full flex-col bg-indigo-50 p-6">
      <div className="flex items-center justify-between pb-4">
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </PressButton>
        <h1 className="text-xl font-bold text-indigo-800">Journey</h1>
        <span className="w-16" />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {units.map((unit, index) => {
          const unlocked = isUnitUnlocked(units, unit, stars);
          const prog = unitProgress(unit, stars);
          return (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`rounded-2xl bg-white p-5 shadow ${unlocked ? '' : 'opacity-50'}`}
            >
              <div className="flex items-center gap-2 pb-3">
                <span className="text-2xl">{unit.emoji}</span>
                <span className="flex-1 text-lg font-semibold text-slate-800">{unit.title}</span>
                <span className="text-sm font-semibold text-slate-500">
                  {unlocked ? `${prog.cleared}/${prog.total}` : '🔒 locked'}
                </span>
              </div>
              <div className="flex gap-3">
                {unit.lessons.map((lesson) => {
                  const open = isLessonUnlocked(units, unit, lesson, stars);
                  const cleared = lessonCleared(stars, lesson.id);
                  const base = lesson.isCheckpoint
                    ? 'bg-amber-300 text-amber-900 rounded-xl'
                    : `${DOT_COLOR[lesson.drill]} rounded-full`;
                  const tone = cleared ? 'bg-emerald-300 text-emerald-900' : !open ? 'bg-slate-200 text-slate-400' : '';
                  return (
                    <PressButton
                      key={lesson.id}
                      disabled={!open}
                      aria-label={lessonLabel(unit, lesson, stars, open)}
                      onClick={() => startLesson(lesson.id)}
                      className={`flex h-12 w-12 items-center justify-center text-lg font-bold shadow ${base} ${tone}`}
                    >
                      {dotContent(lesson, stars)}
                    </PressButton>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
