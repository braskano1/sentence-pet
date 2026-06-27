import { useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { canAfford, type TreatItem } from '../domain/shop';
import { GAME_CONFIG } from '../config/gameConfig';
import { fireConfetti, buzz, buzzError } from '../effects/celebrate';
import { useAudio } from '../hooks/useAudio';

interface TreatCardProps {
  item: TreatItem;
  coins: number;   // live store coins (for affordability)
  full: boolean;   // happiness at max
  happiness: number; // current happiness, for the meter fill
  index: number;   // for stagger-in delay
}

// Per-treat presentational metadata, keyed by item.id. The portion descriptor,
// food emoji, and tier colours/sizes live here so the TreatItem domain type
// stays presentation-free.
const META: Record<string, {
  emoji: string;
  portion: string;
  ring: string;
  tile: string;
  bar: string;
  size: string;
  circle: string;
}> = {
  snack: {
    emoji: '🍪', portion: 'a little nibble',
    ring: 'ring-lime-300', tile: 'bg-lime-100', bar: 'bg-lime-400',
    size: 'text-3xl', circle: 'h-12 w-12',
  },
  treat: {
    emoji: '🍰', portion: 'a tasty slice',
    ring: 'ring-amber-300', tile: 'bg-amber-100', bar: 'bg-amber-400',
    size: 'text-4xl', circle: 'h-14 w-14',
  },
  feast: {
    emoji: '🍱', portion: 'the whole spread',
    ring: 'ring-orange-300', tile: 'bg-orange-100', bar: 'bg-orange-400',
    size: 'text-5xl', circle: 'h-16 w-16',
  },
};

export function TreatCard({ item, coins, full, happiness, index }: TreatCardProps) {
  const buyTreat = useGameStore((s) => s.buyTreat);
  const controls = useAnimationControls();
  const [floating, setFloating] = useState(false);
  const afford = canAfford(coins, item);
  const { play } = useAudio();

  const meta = META[item.id] ?? META.snack;
  const max = GAME_CONFIG.happiness.max;
  const fillPct = Math.min(100, Math.max(0, (happiness / max) * 100));

  const reason = full ? 'Already happy!' : !afford ? 'Not enough coins' : '';
  const buttonStyle = full
    ? 'bg-slate-200 text-slate-400'
    : afford
      ? 'bg-amber-500 text-white'
      : 'bg-amber-200 text-amber-800';

  function handleClick() {
    if (full) return;
    if (afford) {
      buyTreat(item);
      play('purchase');
      controls.start({ scale: [1, 1.08, 1], transition: { duration: 0.3 } });
      setFloating(true);
      fireConfetti();
      buzz();
    } else {
      controls.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.4 } });
      buzzError();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative flex items-center gap-3.5 overflow-visible rounded-2xl bg-white p-3 shadow-sm ring-1 ring-amber-100"
    >
      <motion.div
        animate={controls}
        className={`grid ${meta.circle} shrink-0 place-items-center rounded-2xl ${meta.tile} ring-2 ${meta.ring}`}
        aria-hidden="true"
      >
        <span className={`${meta.size} leading-none`}>{meta.emoji}</span>
      </motion.div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-extrabold text-slate-800">{item.name}</span>
          <span className="shrink-0 text-xs text-slate-500">{meta.portion}</span>
        </div>

        {/* happiness meter: current fill */}
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${meta.bar}`} style={{ width: `${fillPct}%` }} />
        </div>

        <div className="mt-1 text-xs font-semibold text-emerald-600">
          {reason
            ? <span className="text-slate-500">{reason}</span>
            : <>+{item.happiness} 😊</>}
        </div>
      </div>

      <motion.button
        type="button"
        disabled={full}
        onClick={handleClick}
        whileTap={full ? undefined : { scale: 0.95 }}
        aria-label={full ? `${item.name} — already happy` : `Buy ${item.name}`}
        className={`min-h-11 shrink-0 rounded-xl px-4 py-2 font-bold shadow transition ${buttonStyle}`}
      >
        🪙 {item.price}
      </motion.button>

      <AnimatePresence>
        {floating && (
          <motion.span
            key="float"
            className="pointer-events-none absolute right-4 top-2 text-lg font-bold text-emerald-600"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.8 }}
            onAnimationComplete={() => setFloating(false)}
          >
            +{item.happiness} 😊
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
