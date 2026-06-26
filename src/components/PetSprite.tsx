// src/components/PetSprite.tsx
import { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { PetStage, Species } from '../data/types';
import { spriteSrc } from '../config/sprites';
import { moodFor } from '../domain/species';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Pet artwork with: a gentle infinite idle bob, a one-shot bounce when `feedTrigger`
 * increments, and a scale pop when `stage` changes (evolution). Sprite is chosen by
 * (species, stage) and swaps happy/sad by happiness.
 */
export function PetSprite({
  stage,
  species,
  happiness,
  feedTrigger = 0,
}: {
  stage: PetStage;
  species: Species;
  happiness: number;
  feedTrigger?: number;
}) {
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

  const mood = moodFor(happiness, GAME_CONFIG.happiness.max);
  const isEgg = stage === 'egg';
  const src = spriteSrc(species, stage, mood);
  const alt = isEgg ? 'pet-egg' : `pet-${species}-${stage}-${mood}`;

  return (
    <motion.div className="select-none" animate={controls} initial={false}>
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        className="h-[clamp(6rem,26vh,12rem)] w-auto object-contain"
        animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
