import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useSpeech } from '../hooks/useSpeech';
import { showL1 } from '../content/l1';
import { L1Toggle } from './L1Toggle';
import type { FlashcardItem } from '../data/types';

/**
 * Flashcard practice (Spec §5/§7). Flip front→back, 🔊 speaks the front via TTS, self-grade
 * Again/Got-it. BOTH buttons advance; practice is completion-based — full stars,
 * no slip penalty. L1 helper line + toggle are gated by unit.l1Enabled.
 */
export function FlashcardScreen({ items, unit }: { items: FlashcardItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const speak = useSpeech();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to practice.
  if (items.length === 0) return null;

  const item = items[index];
  const th = showL1(unit, l1Mode, item.l1);

  function grade() {
    if (index + 1 >= items.length) {
      // Practice: completion-based — award full stars, no slip penalty (spec §7).
      finishRound({ drill: 'mixed', level: item.level, stars: 3, correctCount: items.length });
      return;
    }
    setIndex(index + 1);
    setFlipped(false);
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      {unit.l1Enabled && (
        <div className="self-end">
          <L1Toggle />
        </div>
      )}
      <button
        type="button"
        aria-label="flip card"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-48 w-full max-w-sm items-center justify-center rounded-3xl border-2 border-slate-200 bg-white text-3xl font-extrabold shadow"
      >
        {flipped ? item.back : item.front}
      </button>
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
        <button type="button" onClick={grade} className="flex-1 rounded-2xl bg-slate-200 py-3 font-black">
          Again
        </button>
        <button type="button" onClick={grade} className="flex-1 rounded-2xl bg-emerald-500 py-3 font-black text-white">
          Got it
        </button>
      </div>
    </div>
  );
}
