import { useGameStore } from '../state/gameStore';
import { DRILL_FOOD, FOOD_META } from '../data/food';
import { levelsFor } from '../data/wordBank';
import type { DrillType } from '../data/types';
import { motion } from 'framer-motion';
import { PressButton } from './PressButton';

const DRILLS: { drill: DrillType; title: string }[] = [
  { drill: 'pattern', title: 'Pattern' },
  { drill: 'wordChoice', title: 'Word Choice' },
  { drill: 'grammar', title: 'Grammar' },
  { drill: 'mixed', title: 'Mixed' },
];

export function DrillPicker() {
  const startDrill = useGameStore((s) => s.startDrill);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="flex h-full flex-col bg-indigo-50 p-6">
      <div className="flex items-center justify-between pb-4">
        <PressButton
          onClick={() => setScreen('petRoom')}
          className="min-h-12 rounded-xl px-4 py-2 font-semibold text-indigo-700"
        >
          ← Back
        </PressButton>
        <h1 className="text-xl font-bold text-indigo-800">Pick a drill</h1>
        <span className="w-16" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-4">
        {DRILLS.map(({ drill, title }, index) => {
          const meta = FOOD_META[DRILL_FOOD[drill]];
          const levels = levelsFor(drill);
          return (
            <motion.div
              key={drill}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex items-center gap-4 rounded-2xl bg-white p-6 text-left shadow"
            >
              <span className="text-4xl">{meta.emoji}</span>
              <span className="flex-1">
                <span className="block text-lg font-semibold text-slate-800">{title}</span>
                <span className="text-sm text-slate-500">Earns {meta.label}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {levels.map((level) => (
                  <PressButton
                    key={level}
                    onClick={() => startDrill(drill, level)}
                    className="min-h-11 min-w-11 rounded-xl bg-indigo-100 px-3 font-semibold text-indigo-700"
                  >
                    L{level}
                  </PressButton>
                ))}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
