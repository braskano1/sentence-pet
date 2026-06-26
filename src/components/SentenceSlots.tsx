// src/components/SentenceSlots.tsx
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
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
    <motion.button
      ref={setNodeRef}
      data-testid={`slot-${index}`}
      onClick={() => !empty && onClear(index)}
      animate={{ scale: isOver && empty ? 1.06 : 1 }}
      transition={{ duration: 0.15 }}
      className={`min-h-12 min-w-20 px-4 py-3 rounded-xl border-2 border-dashed text-lg font-semibold ${
        isOver && empty ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'
      }`}
    >
      <span className="block text-xs text-slate-400">{label}</span>
      {word === null ? (
        <span className="block text-slate-900"> </span>
      ) : (
        <motion.span
          key={word}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="block text-slate-900"
        >
          {displayToken(word, index)}
        </motion.span>
      )}
    </motion.button>
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
