// src/components/RewardScreen.tsx
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PressButton } from './PressButton';
import { useGameStore } from '../state/gameStore';
import { fireConfetti, buzz } from '../effects/celebrate';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_META } from '../data/food';
import { BATTLE_STAT_LABELS } from '../config/petDisplay';
import type { BattleStats } from '../data/types';
import { useAudio } from '../hooks/useAudio';

export function RewardScreen() {
  const reward = useGameStore((s) => s.lastReward);
  const lastLevelUp = useGameStore((s) => s.lastLevelUp);
  const clearLevelUp = useGameStore((s) => s.clearLevelUp);
  const setScreen = useGameStore((s) => s.setScreen);
  const lastStageChange = useGameStore((s) => s.lastStageChange);
  const pendingStinger = useGameStore((s) => s.pendingStinger);
  const clearPendingStinger = useGameStore((s) => s.clearPendingStinger);
  const { play, playStinger } = useAudio();

  // Boss (checkpoint) outcome: fire the queued win/lose stinger once, then clear.
  useEffect(() => {
    if (pendingStinger) {
      playStinger(pendingStinger);
      clearPendingStinger();
    }
  }, [pendingStinger, playStinger, clearPendingStinger]);

  // Capture the level-up info on mount so the callout persists after clearLevelUp() nulls the store.
  const levelUpRef = useRef(lastLevelUp);
  if (levelUpRef.current === null && lastLevelUp !== null) {
    levelUpRef.current = lastLevelUp;
  }

  useEffect(() => {
    if (reward) { fireConfetti(); play('coin'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lastLevelUp) {
      fireConfetti();
      buzz();
      clearLevelUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLevelUp]);

  const coins = useCountUp(reward?.coins ?? 0);
  const food = useCountUp(reward?.food ?? 0);

  if (!reward) return null;

  const meta = FOOD_META[reward.group] ?? FOOD_META.protein;
  const levelUp = levelUpRef.current;

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
        {levelUp && (
          <motion.div
            variants={item}
            className="rounded-xl bg-amber-100 px-5 py-3 text-center ring-2 ring-amber-400"
          >
            <p className="text-lg font-extrabold text-amber-800">
              Level up! Lv {levelUp.toLevel}
            </p>
            {levelUp.gained.length > 0 && (
              <p className="mt-1 text-sm font-semibold text-amber-700">
                {levelUp.gained
                  .map((k: keyof BattleStats) => {
                    const label = BATTLE_STAT_LABELS.find(([, key]) => key === k)?.[0] ?? k.toUpperCase();
                    return `+1 ${label}`;
                  })
                  .join('  ')}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
      <PressButton
        onClick={() => setScreen(lastStageChange ? 'evolution' : 'petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </PressButton>
    </div>
  );
}
