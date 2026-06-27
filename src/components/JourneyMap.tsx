import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../content/model';
import { useContentStore } from '../content/store';
import { UnitSection } from './journey/UnitSection';
import { PanViewport } from './journey/PanViewport';
import { PressButton } from './PressButton';
import { currentLessonId, unitDone } from './journey/journeyView';

export function JourneyMap() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLesson = useGameStore((s) => s.startLesson);
  const stars = useGameStore((s) => s.journey.lessonStars);
  const bundle = useContentStore((s) => s.bundle);
  const units = useMemo(() => orderedUnits(bundle), [bundle]);

  const currentId = currentLessonId(units, stars);
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);

  // Units the player has explicitly expanded despite being fully cleared.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (unitId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });

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
        <h1 className="text-lg font-extrabold text-indigo-900">Journey</h1>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-amber-500 shadow">
          <span aria-hidden="true">★</span>
          <span className="text-slate-700">{totalStars}</span>
          <span className="sr-only">stars earned</span>
        </div>
      </header>

      <PanViewport currentId={currentId}>
        <div className="space-y-4">
          {units.map((unit, index) => {
            const folded = unitDone(unit, stars) && !expanded.has(unit.id);
            return (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <UnitSection
                  units={units}
                  unit={unit}
                  stars={stars}
                  currentId={currentId}
                  folded={folded}
                  onToggle={toggle}
                  onStart={startLesson}
                />
              </motion.div>
            );
          })}
        </div>
      </PanViewport>
    </div>
  );
}
