// src/components/StatBars.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { NutritionBars } from '../data/types';
import { health } from '../domain/pet';
import { barColor } from '../domain/bars';
import { useCountUp } from '../effects/useCountUp';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const shown = useCountUp(value);
  const prev = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 500);
      return () => clearTimeout(id);
    }
  }, [value]);

  return (
    <div className="w-64">
      <div className="flex justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span>{shown}</span>
      </div>
      <div className={`h-3 rounded-full bg-slate-200 overflow-hidden ${pulsing ? 'bar-pulse' : ''}`}>
        <motion.div
          className={`h-full ${barColor(value, color)}`}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function StatBars({ bars, happiness }: { bars: NutritionBars; happiness: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Bar label="❤️ Health" value={health(bars)} color="bg-rose-500" />
      <Bar label="😊 Happiness" value={happiness} color="bg-yellow-400" />
      <Bar label="🥩 Protein" value={bars.protein} color="bg-orange-500" />
    </div>
  );
}
