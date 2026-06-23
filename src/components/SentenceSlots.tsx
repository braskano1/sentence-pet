import type { PosLabel } from '../data/types';
import { capitalizeFirst } from '../domain/sentence';

interface Props {
  slots: PosLabel[];
  placed: (string | null)[];
  onClearSlot: (index: number) => void;
}

/** First slot is capitalized (sentence start); others shown as-is. */
function displayToken(word: string, index: number): string {
  return index === 0 ? capitalizeFirst(word) : word;
}

export function SentenceSlots({ slots, placed, onClearSlot }: Props) {
  const allFilled = placed.every((p) => p !== null);
  return (
    <div className="flex flex-wrap gap-2 items-end justify-center">
      {slots.map((label, i) => (
        <button
          key={i}
          onClick={() => placed[i] !== null && onClearSlot(i)}
          className="min-h-12 min-w-20 px-4 py-3 rounded-xl border-2 border-dashed border-slate-400 bg-white text-lg font-semibold"
        >
          <span className="block text-xs text-slate-400">{label}</span>
          <span className="block text-slate-900">
            {placed[i] !== null ? displayToken(placed[i] as string, i) : ' '}
          </span>
        </button>
      ))}
      {allFilled && (
        <span className="self-end pb-3 text-2xl font-semibold text-slate-900">.</span>
      )}
    </div>
  );
}
