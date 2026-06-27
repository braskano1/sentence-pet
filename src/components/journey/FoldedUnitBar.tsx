import { PressButton } from '../PressButton';
import type { Unit } from '../../content/model';
import type { LessonStars } from '../../domain/journeyProgress';
import { unitProgress } from '../../domain/journeyProgress';
import { unitStars } from './journeyView';

interface FoldedUnitBarProps {
  unit: Unit;
  stars: LessonStars;
  onExpand: (unitId: string) => void;
}

/** Collapsed summary for a fully-cleared unit. Tap to expand. */
export function FoldedUnitBar({ unit, stars, onExpand }: FoldedUnitBarProps) {
  const { cleared, total } = unitProgress(unit, stars);
  return (
    <PressButton
      aria-expanded={false}
      aria-label={`expand ${unit.title}`}
      onClick={() => onExpand(unit.id)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-left shadow-sm ring-1 ring-emerald-100"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-sm text-white shadow" aria-hidden="true">✓</span>
      <span className="text-xl" aria-hidden="true">{unit.emoji}</span>
      <span className="font-bold text-slate-700">{unit.title}</span>
      <span className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-400">
        <span className="text-amber-500">★ {unitStars(unit, stars)}</span>
        <span>{cleared}/{total}</span>
        <span className="text-slate-300" aria-hidden="true">▾</span>
      </span>
    </PressButton>
  );
}
