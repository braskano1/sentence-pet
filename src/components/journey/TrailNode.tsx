import { motion, useReducedMotion } from 'framer-motion';
import { PressButton } from '../PressButton';
import { StarPips } from './StarPips';
import type { Unit, Lesson } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { isLessonUnlocked, lessonCleared } from '../../domain/journeyProgress';
import {
  DRILL_LABEL, DRILL_TINT, foodEmoji, serpentineOffset, lessonLabel,
} from './journeyView';

interface TrailNodeProps {
  units: Unit[];
  unit: Unit;
  lesson: Lesson;
  stars: LessonStars;
  index: number;
  isCurrent: boolean;
  onStart: (lessonId: string) => void;
}

export function TrailNode({ units, unit, lesson, stars, index, isCurrent, onStart }: TrailNodeProps) {
  const reduce = useReducedMotion();
  const open = isLessonUnlocked(units, unit, lesson, stars);
  const cleared = lessonCleared(stars, lesson.id);
  const tint = DRILL_TINT[lesson.drill];
  const food = foodEmoji(lesson.drill);
  const label = lessonLabel(unit, lesson, stars, open);

  const shape = lesson.isCheckpoint ? 'rounded-3xl' : 'rounded-full';
  const size = lesson.isCheckpoint ? 'h-[5.5rem] w-[5.5rem] text-4xl' : 'h-16 w-16 text-2xl';

  let face = food;
  let tileCls = `${tint.bg} ring-4 ring-white`;
  let badge: React.ReactNode = null;
  let caption: React.ReactNode = null;

  if (cleared) {
    tileCls = `${tint.bg} ring-4 ring-emerald-300`;
    badge = (
      <span
        className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow ring-2 ring-white"
        aria-hidden="true"
      >✓</span>
    );
    caption = <StarPips n={stars[lesson.id] ?? 0} className="mt-1 text-amber-500" />;
  } else if (isCurrent) {
    tileCls = `${tint.bg} ring-4 ring-white shadow-xl`;
    caption = <span className={`mt-1 text-xs font-bold ${tint.ink}`}>{DRILL_LABEL[lesson.drill]}</span>;
  } else if (!open) {
    if (lesson.isCheckpoint) {
      face = '🏆';
      tileCls = 'bg-slate-200 text-slate-400 ring-4 ring-slate-100';
      caption = <span className="mt-1 text-[11px] font-bold text-slate-400">CHECKPOINT 🔒</span>;
    } else {
      face = '🔒';
      tileCls = 'bg-slate-200 text-slate-400';
    }
  }

  const pulse = isCurrent && !reduce
    ? { scale: [1, 1.05, 1], y: [0, -4, 0] }
    : undefined;

  return (
    <div className={`relative flex flex-col items-center ${serpentineOffset(index)}`}>
      {isCurrent && (
        <span className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
          YOU ARE HERE
        </span>
      )}
      <motion.div
        className="relative"
        animate={pulse}
        transition={pulse ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <PressButton
          disabled={!open}
          aria-label={label}
          onClick={() => onStart(lesson.id)}
          className={`grid ${size} place-items-center ${shape} font-bold shadow-lg ${tileCls}`}
        >
          {face}
        </PressButton>
        {badge}
      </motion.div>
      {caption}
    </div>
  );
}
