// src/components/RewardScreen.tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { PressButton } from './PressButton';
import { useGameStore } from '../state/gameStore';
import { fireConfetti } from '../effects/celebrate';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_META } from '../data/food';

export function RewardScreen() {
  const reward = useGameStore((s) => s.lastReward);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    if (reward) fireConfetti();
  }, [reward]);

  const coins = useCountUp(reward?.coins ?? 0);
  const food = useCountUp(reward?.food ?? 0);

  if (!reward) return null;

  const meta = FOOD_META[reward.group] ?? FOOD_META.protein;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.18 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <motion.div
        className="flex flex-1 flex-col items-center justify-center gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h1 variants={item} className="text-3xl font-bold text-amber-700">
          Level cleared!
        </motion.h1>
        <motion.p variants={item} className="text-4xl">
          {Array.from({ length: reward.stars }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.25, type: 'spring', stiffness: 400 }}
              className="inline-block"
            >
              ⭐
            </motion.span>
          ))}
        </motion.p>
        <motion.p variants={item} className="text-lg text-slate-700">
          You earned {food} {meta.emoji} {meta.label.toLowerCase()}
        </motion.p>
        <motion.p variants={item} className="text-lg text-slate-700">
          +{coins} coins
        </motion.p>
      </motion.div>
      <PressButton
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </PressButton>
    </div>
  );
}
