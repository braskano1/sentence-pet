// src/components/PetSprite.tsx
import { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { PetStage } from '../data/types';

const ART: Record<PetStage, string> = {
  egg: '🥚',
  baby: '🐣',
  young: '🐕',
  adult: '🐕‍🦺',
};

/**
 * Pet emoji with: a gentle infinite idle bob, a one-shot bounce when `feedTrigger`
 * increments, and a scale pop when `stage` changes (evolution).
 */
export function PetSprite({ stage, feedTrigger = 0 }: { stage: PetStage; feedTrigger?: number }) {
  const controls = useAnimationControls();
  const prevStage = useRef(stage);
  const prevFeed = useRef(feedTrigger);

  // feed bounce
  useEffect(() => {
    if (prevFeed.current !== feedTrigger) {
      prevFeed.current = feedTrigger;
      controls.start({ scale: [1, 1.3, 0.95, 1], transition: { duration: 0.5 } });
    }
  }, [feedTrigger, controls]);

  // evolution pop
  useEffect(() => {
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      controls.start({ scale: [1, 1.6, 1], rotate: [0, -8, 8, 0], transition: { duration: 0.7 } });
    }
  }, [stage, controls]);

  return (
    <motion.div
      className="select-none leading-none text-[clamp(4rem,18vh,8rem)]"
      aria-label={`pet-${stage}`}
      animate={controls}
      initial={false}
    >
      <motion.div
        animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      >
        {ART[stage]}
      </motion.div>
    </motion.div>
  );
}
