import { TrailNode } from './TrailNode';
import { FoldedUnitBar } from './FoldedUnitBar';
import { PressButton } from '../PressButton';
import type { Unit } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { isUnitUnlocked, unitProgress } from '../../domain/journeyProgress';
import { unitDone } from './journeyView';

interface UnitSectionProps {
  units: Unit[];
  unit: Unit;
  stars: LessonStars;
  currentId: string | null;
  folded: boolean;
  onToggle: (unitId: string) => void;
  onStart: (lessonId: string) => void;
}

export function UnitSection({ units, unit, stars, currentId, folded, onToggle, onStart }: UnitSectionProps) {
  const unlocked = isUnitUnlocked(units, unit, stars);
  const done = unitDone(unit, stars);
  const { cleared, total } = unitProgress(unit, stars);

  if (folded) {
    return (
      <section>
        <FoldedUnitBar unit={unit} stars={stars} onExpand={onToggle} />
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="-mx-1 mb-2 flex items-center gap-2 px-3 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl shadow ring-1 ring-indigo-100" aria-hidden="true">
          {unit.emoji}
        </span>
        <h2 className="font-extrabold text-indigo-900">{unit.title}</h2>
        {done ? (
          <PressButton
            aria-expanded={true}
            aria-label={`collapse ${unit.title}`}
            onClick={() => onToggle(unit.id)}
            className="ml-auto text-xs font-bold text-indigo-400"
          >
            collapse ▴
          </PressButton>
        ) : (
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-sm">
            {cleared}/{total}
          </span>
        )}
      </div>

      <div className={`relative ${unlocked ? '' : 'opacity-60'}`}>
        <div
          className="pointer-events-none absolute inset-y-2 left-1/2 -z-0 w-1 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#c7d2fe_0_8px,transparent_8px_16px)]"
          aria-hidden="true"
        />
        {unit.lessons.map((lesson, i) => (
          <div
            key={lesson.id}
            data-current={lesson.id === currentId ? 'true' : undefined}
            className={`relative z-10 my-3 flex justify-center ${i === 0 && lesson.id === currentId ? 'mt-12' : ''}`}
          >
            <TrailNode
              units={units}
              unit={unit}
              lesson={lesson}
              stars={stars}
              index={i}
              isCurrent={lesson.id === currentId}
              onStart={onStart}
            />
          </div>
        ))}

        {!unlocked && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-slate-900/5 backdrop-blur-[1px]">
            <div className="rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg ring-1 ring-slate-200">
              <div className="text-2xl" aria-hidden="true">🔒</div>
              <div className="text-sm font-bold text-slate-700">Clear the previous checkpoint</div>
              <div className="text-xs text-slate-500">to open {unit.title}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
