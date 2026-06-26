import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { spriteSrc } from '../config/sprites';
import { STAGE_NAME } from '../domain/xp';
import type { PetStage, Species } from '../data/types';
import { useEvolutionSequence } from '../hooks/useEvolutionSequence';
import { getEvolutionSound, soundAllowed } from '../effects/evolutionSound';
import { fireConfetti, buzz } from '../effects/celebrate';
import { PressButton } from './PressButton';

/** The full evolution sequence (silhouette → strobe → flash → reveal) with audio,
 * skip, sound toggle, and confetti. Presentational + store-sound-setting only;
 * the caller decides what `onDone` does. */
export function EvolutionCinematic({
  from, to, species, onDone,
}: { from: PetStage; to: PetStage; species: Species; onDone: () => void }) {
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const reduced = !!useReducedMotion();
  const { phase, swap, skip } = useEvolutionSequence({ reduced });
  const sound = useRef(getEvolutionSound());
  const celebrated = useRef(false);

  const allow = soundAllowed(soundEnabled, reduced);
  const cuedPhase = useRef<string | null>(null);

  // Phase-aligned audio cues. Fire once per phase; stop in-flight audio if muted.
  useEffect(() => {
    const s = sound.current;
    if (!allow) { s.stop(); cuedPhase.current = null; return; }
    if (cuedPhase.current === phase) return;
    cuedPhase.current = phase;
    if (phase === 'strobe') s.strobe();
    else if (phase === 'flash') s.flash();
    else if (phase === 'reveal') s.reveal();
  }, [phase, allow]);

  // Confetti + haptic once on reveal.
  useEffect(() => {
    if (phase === 'reveal' && !celebrated.current) {
      celebrated.current = true;
      fireConfetti();
      buzz();
    }
  }, [phase]);

  // Stop audio on unmount.
  useEffect(() => {
    const s = sound.current;
    return () => s.stop();
  }, []);

  const revealed = phase === 'reveal' || phase === 'done';
  const showNew = revealed || (phase === 'strobe' && swap);
  const isSil = phase === 'silhouette' || phase === 'strobe';
  const src = spriteSrc(species, showNew ? to : from, 'happy');

  const finish = () => { sound.current.stop(); onDone(); };

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#1d2746_0%,#0a0f1f_70%)] p-6"
      onClick={revealed ? undefined : () => { skip(); sound.current.stop(); }}
    >
      <button
        type="button"
        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        onClick={(e) => { e.stopPropagation(); toggleSound(); }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      {phase === 'announce' && (
        <p className="absolute top-20 text-lg font-semibold text-white/90">What? Your pet is evolving!</p>
      )}

      <motion.img
        data-testid="evolution-stage"
        src={src}
        alt={`pet-${species}-${showNew ? to : from}`}
        draggable={false}
        className={`h-[clamp(7rem,30vh,13rem)] w-auto object-contain ${isSil ? 'evo-silhouette' : ''}`}
        animate={revealed ? { scale: [0.2, 1.35, 0.9, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: revealed ? 0.76 : 0.2 }}
      />

      {phase === 'flash' && <div className="evo-flash pointer-events-none absolute inset-0 bg-white" />}

      {revealed && (
        <>
          <p className="absolute bottom-28 text-xl font-extrabold text-white">
            Evolved to <span className="text-emerald-300">{STAGE_NAME[to]}</span>! ✨
          </p>
          <PressButton
            onClick={finish}
            className="absolute bottom-10 min-h-12 rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-white shadow"
          >
            Continue
          </PressButton>
        </>
      )}
    </div>
  );
}
