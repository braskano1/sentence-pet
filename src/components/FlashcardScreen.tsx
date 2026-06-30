import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useSpeech } from '../hooks/useSpeech';
import { showL1 } from '../content/l1';
import { LessonShell } from './lesson/LessonShell';
import type { FlashcardItem } from '../data/types';

/**
 * Flashcard practice (Spec §5/§7). Flip front→back, 🔊 speaks the front via TTS, self-grade
 * Again/Got-it. Practice is completion-based — full stars, no slip penalty.
 *
 * A QUEUE of remaining card indices drives the screen: the front of the queue is the card
 * shown. "Got it" removes the front card (completed); "Again" moves the front card to the
 * BACK so the learner sees it again later (NOT counted as completed). The round finishes
 * once the queue empties. Progress reflects cards completed (got-it'd), not raw position.
 * L1 helper line + toggle are gated by unit.l1Enabled.
 */
export function FlashcardScreen({ items, unit }: { items: FlashcardItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const speak = useSpeech();
  // Queue of remaining card indices; front = the card currently shown.
  const [queue, setQueue] = useState<number[]>(() => items.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to practice.
  if (items.length === 0) return null;

  const item = items[queue[0]];
  const th = showL1(unit, l1Mode, item.l1);

  /** "Got it" — remove the front card (completed); finish when the queue empties. */
  function gotIt() {
    const rest = queue.slice(1);
    if (rest.length === 0) {
      // Practice: completion-based — award full stars, no slip penalty (spec §7).
      finishRound({ drill: 'mixed', kind: 'flashcard', level: item.level, stars: 3, correctCount: items.length });
      return;
    }
    setQueue(rest);
    setFlipped(false);
  }

  /** "Again" — re-queue the front card to the back; does NOT count as completed. */
  function again() {
    setQueue([...queue.slice(1), queue[0]]);
    setFlipped(false);
  }

  return (
    <LessonShell
      title="Flip the cards"
      instruction="Tap the card to flip it, then choose."
      index={items.length - queue.length}
      total={items.length}
      l1={unit.l1Enabled}
    >
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      <button
        type="button"
        aria-label="flip card"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-48 w-full max-w-sm items-center justify-center rounded-3xl border-2 border-slate-200 bg-white text-3xl font-extrabold shadow"
      >
        {flipped ? item.back : item.front}
      </button>
      {!flipped && <p className="text-xs text-slate-400">tap to flip</p>}
      <button
        type="button"
        aria-label="Hear the word"
        onClick={() => speak.speakWord(item.front)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700"
      >
        🔊
      </button>
      {th && <p className="text-lg font-bold text-slate-600">{th}</p>}
      <div className="mt-auto flex w-full max-w-sm gap-3">
        <button type="button" onClick={again} className="flex-1 rounded-2xl bg-slate-200 py-3 font-black">
          Again
        </button>
        <button type="button" onClick={gotIt} className="flex-1 rounded-2xl bg-emerald-500 py-3 font-black text-white">
          Got it
        </button>
      </div>
    </div>
    </LessonShell>
  );
}
