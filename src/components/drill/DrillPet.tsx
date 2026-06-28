import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PetStage, Species } from '../../data/types';
import { PetSprite } from '../PetSprite';
import { SpeechBubble } from '../SpeechBubble';

export type PetReaction = 'idle' | 'correct' | 'wrong';

/** Centre-stage active pet: idle bob, a bounce on correct, a shake on wrong, plus a nudge line. */
export function DrillPet({
  species, stage, happiness, reaction, line, defId,
}: {
  species: Species; stage: PetStage; happiness: number; reaction: PetReaction; line: string; defId?: string;
}) {
  const [bounce, setBounce] = useState(0);
  const [shake, setShake] = useState(0);
  const prev = useRef<PetReaction>('idle');
  useEffect(() => {
    if (reaction === prev.current) return;
    if (reaction === 'correct') setBounce((b) => b + 1);
    if (reaction === 'wrong') setShake((s) => s + 1);
    prev.current = reaction;
  }, [reaction]);

  return (
    <div className="flex flex-col items-center">
      <SpeechBubble name="" line={line} />
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
        transition={{ duration: 0.45 }}
        className="mt-1"
      >
        <PetSprite species={species} stage={stage} happiness={happiness} feedTrigger={bounce} defId={defId} />
      </motion.div>
    </div>
  );
}
