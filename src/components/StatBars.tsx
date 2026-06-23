import type { NutritionBars } from '../data/types';
import { health } from '../domain/pet';

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="w-64">
      <div className="flex justify-between text-sm text-slate-600">
        <span>{label}</span><span>{value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
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
