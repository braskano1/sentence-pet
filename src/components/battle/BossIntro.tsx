import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';

export function BossIntro({ boss, onDone }: { boss: CheckpointBoss; onDone: () => void }) {
  const reduced = !!useReducedMotion();
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    const ms = reduced ? 200 : 1500;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [reduced, onDone]);
  return (
    <div
      className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#3a1d3d,#0a0f1f)] p-6"
      onClick={() => { if (!skip) { setSkip(true); onDone(); } }}
    >
      <motion.img
        src={bossSpriteSrc(boss)}
        alt={boss.name}
        draggable={false}
        initial={{ x: 120, opacity: 0, scale: 0.8 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.6 }}
        className="h-36 w-auto object-contain"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduced ? 0 : 0.5 }}
        className="mt-4 text-2xl font-extrabold text-white"
      >
        {bossElementEmoji(boss)} {boss.name}
      </motion.p>
      <p className="mt-2 text-xs text-white/60">tap to skip</p>
    </div>
  );
}
