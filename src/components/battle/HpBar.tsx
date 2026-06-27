import { useCountUp } from '../../effects/useCountUp';

export function HpBar({ value, max, tone }: { value: number; max: number; tone: 'boss' | 'pet' }) {
  // useCountUp(target, durationMs?) returns a plain number — no destructuring needed.
  const shown = useCountUp(value);
  const pct = max > 0 ? Math.max(0, Math.min(100, (shown / max) * 100)) : 0;
  const fill = tone === 'boss' ? 'from-rose-500 to-orange-400' : 'from-emerald-400 to-teal-300';
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800/60">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${fill} transition-[width] duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
