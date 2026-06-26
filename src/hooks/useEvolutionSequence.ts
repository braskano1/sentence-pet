import { useEffect, useRef, useState } from 'react';

export type EvoPhase = 'announce' | 'silhouette' | 'strobe' | 'flash' | 'reveal' | 'done';

export const TIMINGS = {
  announce: 900,
  silhouette: 350,
  strobe: 1900,
  strobeStart: 260,
  strobeMin: 70,
  strobeStep: 22,
  flash: 650,
  reveal: 760,
} as const;

/** Drives the evolution phase timeline. Pure of store/DOM beyond timers. */
export function useEvolutionSequence({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState<EvoPhase>('announce');
  const [swap, setSwap] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipped = useRef(false);

  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const toReveal = () => {
    setPhase('reveal');
    at(TIMINGS.reveal, () => setPhase('done'));
  };

  const skip = () => {
    if (skipped.current) return;
    skipped.current = true;
    clearTimers();
    toReveal();
  };

  useEffect(() => {
    if (reduced) {
      at(TIMINGS.announce, toReveal);
      return clearTimers;
    }
    at(TIMINGS.announce, () => {
      setPhase('silhouette');
      at(TIMINGS.silhouette, () => {
        setPhase('strobe');
        let delay: number = TIMINGS.strobeStart;
        let elapsed = 0;
        const tick = () => {
          if (skipped.current) return;
          setSwap((v) => !v);
          elapsed += delay;
          delay = Math.max(TIMINGS.strobeMin, delay - TIMINGS.strobeStep);
          if (elapsed < TIMINGS.strobe) {
            timers.current.push(setTimeout(tick, delay));
          } else {
            setPhase('flash');
            at(TIMINGS.flash, toReveal);
          }
        };
        tick();
      });
    });
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return { phase, swap, skip };
}
