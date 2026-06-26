// src/components/useRoundFeedback.ts
import { useEffect, useRef, useState } from 'react';
import { buzz, fireConfetti } from '../effects/celebrate';

export type Feedback = 'correct' | 'wrong' | null;

const HOLD_MS = { correct: 1100, wrong: 700 } as const;

/**
 * Plays a timed correct/incorrect feedback phase. `play` sets the feedback,
 * fires the side effect, holds for the kind's duration, then clears and runs onDone.
 * `locked` is true for the duration so callers can ignore input.
 */
export function useRoundFeedback() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function play(kind: 'correct' | 'wrong', onDone: () => void) {
    clear();
    setFeedback(kind);
    if (kind === 'wrong') buzz();
    else fireConfetti();
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback(null);
      onDone();
    }, HOLD_MS[kind]);
  }

  useEffect(() => clear, []);

  return { feedback, play, locked: feedback !== null };
}
