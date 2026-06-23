// src/components/SentenceSlots.tsx
import { useDroppable } from '@dnd-kit/core';
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

function Slot({
  index,
  label,
  word,
  onClear,
}: {
  index: number;
  label: PosLabel;
  word: string | null;
  onClear: (i: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const empty = word === null;
  return (
    <button
      ref={setNodeRef}
      onClick={() => !empty && onClear(index)}
      className={`min-h-12 min-w-20 px-4 py-3 rounded-xl border-2 border-dashed text-lg font-semibold ${
        isOver && empty ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'
      }`}
    >
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="block text-slate-900">{empty ? ' ' : displayToken(word, index)}</span>
    </button>
  );
}

export function SentenceSlots({ slots, placed, onClearSlot }: Props) {
  const allFilled = placed.every((p) => p !== null);
  return (
    <div className="flex flex-wrap gap-2 items-end justify-center">
      {slots.map((label, i) => (
        <Slot key={i} index={i} label={label} word={placed[i]} onClear={onClearSlot} />
      ))}
      {allFilled && (
        <span className="self-end pb-3 text-2xl font-semibold text-slate-900">.</span>
      )}
    </div>
  );
}
