import { useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { canAfford, type TreatItem } from '../domain/shop';
import { fireConfetti, buzz, buzzError } from '../effects/celebrate';
import { useAudio } from '../hooks/useAudio';

interface TreatCardProps {
  item: TreatItem;
  coins: number;   // live store coins (for affordability)
  full: boolean;   // happiness at max
  index: number;   // for stagger-in delay
}

export function TreatCard({ item, coins, full, index }: TreatCardProps) {
  const buyTreat = useGameStore((s) => s.buyTreat);
  const controls = useAnimationControls();
  const [floating, setFloating] = useState(false);
  const afford = canAfford(coins, item);
  const { play } = useAudio();

  const reason = full ? 'Already happy!' : !afford ? 'Not enough coins' : '';
  const style = full
    ? 'bg-slate-200 text-slate-400'
    : afford
      ? 'bg-amber-500 text-white'
      : 'bg-amber-200 text-amber-800';

  function handleClick() {
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
    <motion.button
      type="button"
      disabled={full}
      onClick={handleClick}
      whileTap={full ? undefined : { scale: 0.95 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`relative min-h-16 w-full overflow-visible rounded-xl px-5 py-3 text-left shadow ${style}`}
    >
      <motion.div animate={controls}>
        <span className="font-semibold">{item.name}</span>{' '}
        <span>🪙 {item.price} · +{item.happiness} 😊</span>
        {reason && <span className="block text-xs">{reason}</span>}
      </motion.div>

      <AnimatePresence>
        {floating && (
          <motion.span
            key="float"
            className="pointer-events-none absolute right-5 top-2 text-lg font-bold text-emerald-600"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.8 }}
            onAnimationComplete={() => setFloating(false)}
          >
            +{item.happiness} 😊
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
