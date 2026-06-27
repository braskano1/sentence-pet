import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { gradeFillBlank, hintAt } from '../domain/fillblank';
import { computeStars } from '../domain/scoring';
import { L1Toggle } from './L1Toggle';
import type { FillBlankItem } from '../data/types';

/**
 * Fill-blank practice (Spec §5/§7). Typed input, STRICT trimmed exact match against
 * `answer ∪ alternates`. Wrong → escalating hint (L1 → first-letter → length-dots → reveal),
 * NO auto-advance: the learner must type a correct answer to move on. Wrong attempts count as
 * mistakes feeding computeStars. The L1 toggle (gated by unit.l1Enabled) is the per-unit helper
 * control; the hint ladder is its own scaffold and surfaces item.l1 directly as its first step.
 */
export function FillBlankScreen({ items, unit }: { items: FillBlankItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [wrongCount, setWrongCount] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to practice.
  if (items.length === 0) return null;

  const item = items[index];
  const [a, b] = item.template.split('___');

  function submit() {
    if (gradeFillBlank(item, value)) {
      if (index + 1 >= items.length) {
        finishRound({
          drill: 'mixed',
          level: item.level,
          stars: computeStars({ hints: 0, mistakes: wrongCount }),
          correctCount: items.length,
        });
        return;
      }
      setIndex(index + 1);
      setValue('');
      setWrongCount(0);
      setHint(null);
    } else {
      setHint(hintAt(item, wrongCount));
      setWrongCount((w) => w + 1);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      {unit.l1Enabled && (
        <div className="self-end">
          <L1Toggle />
        </div>
      )}
      <p className="text-2xl font-bold">
        {a}
        <span className="mx-1 border-b-4 border-slate-400 px-6">&nbsp;</span>
        {b}
      </p>
      <input
        aria-label="answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="rounded-xl border-2 border-slate-300 px-4 py-2 text-center text-lg"
      />
      {hint && <p className="text-lg font-bold text-amber-600">{hint}</p>}
      <button
        type="button"
        onClick={submit}
        className="rounded-2xl bg-emerald-500 px-6 py-3 font-black text-white"
      >
        Check
      </button>
    </div>
  );
}
