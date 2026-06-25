import { motion } from 'framer-motion';
import type { BattleStats } from '../data/types';
import { BATTLE_STAT_LABELS } from '../config/petDisplay';
import { useCountUp } from '../effects/useCountUp';

/**
 * Pentagon radar of the five battle stats. Each axis radius = stat / `max` (default 100),
 * so a maxed pet nearly fills the chart. `color` tints the fill + outline (e.g. rarity hex).
 *
 * Stats are eased via useCountUp, so the polygon MORPHS when the pet changes and the axis
 * numbers roll; a spring scale-in draws the shape outward on first mount. Reduced-motion is
 * honored globally via App's MotionConfig.
 */
export function StatRadar({ stats, color, size = 180, max = 100 }: {
  stats: BattleStats;
  color: string;
  size?: number;
  max?: number;
}) {
  // Eased copies: drive both the morphing polygon and the rolling axis labels.
  const animated: BattleStats = {
    hp: useCountUp(stats.hp),
    atk: useCountUp(stats.atk),
    def: useCountUp(stats.def),
    spd: useCountUp(stats.spd),
    luk: useCountUp(stats.luk),
  };

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.32;
  const n = BATTLE_STAT_LABELS.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const xy = (i: number, r: number): [number, number] => [cx + Math.cos(angle(i)) * R * r, cy + Math.sin(angle(i)) * R * r];
  const toPoints = (rOf: (i: number) => number) =>
    BATTLE_STAT_LABELS.map((_, i) => xy(i, rOf(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const grid = (r: number) => toPoints(() => r);
  const data = toPoints((i) => Math.max(0.08, animated[BATTLE_STAT_LABELS[i][1]] / max));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Battle stat radar">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={grid(r)} fill="none" stroke="#92400e" strokeOpacity={0.15} />
      ))}
      {BATTLE_STAT_LABELS.map((_, i) => {
        const [x2, y2] = xy(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#92400e" strokeOpacity={0.15} />;
      })}
      <motion.polygon
        points={data}
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {BATTLE_STAT_LABELS.map(([label, key], i) => {
        const [lx, ly] = xy(i, 1.2);
        return (
          <text key={key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight={700} fill="#451a03">
            {label} {animated[key]}
          </text>
        );
      })}
    </svg>
  );
}
