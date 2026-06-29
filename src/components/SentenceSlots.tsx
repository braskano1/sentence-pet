import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import type { PosLabel } from '../data/types';
import { capitalizeFirst } from '../domain/sentence';
import { currentSlotIndex } from '../domain/placement';
import { posClasses } from '../config/posColors';

interface Props {
  slots: PosLabel[];
  placed: (string | null)[];
  onClearSlot: (index: number) => void;
  /** Difficulty: hide the POS label text and skip the POS color tint. */
  hidePos?: boolean;
}

/** First slot is capitalized (sentence start); others shown as-is. */
function displayToken(word: string, index: number): string {
  return index === 0 ? capitalizeFirst(word) : word;
}

function Slot({
  index, label, word, isCurrent, onClear, hidePos,
}: {
  index: number; label: PosLabel; word: string | null; isCurrent: boolean; onClear: (i: number) => void; hidePos?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const empty = word === null;
  const base = 'min-h-12 min-w-20 rounded-xl px-4 py-3 text-lg font-semibold border-2';
  const filledLook = hidePos ? 'bg-white text-slate-900 border-slate-300' : posClasses(label);
  const look = empty
    ? `border-dashed ${isOver || isCurrent ? 'border-emerald-500 bg-emerald-50' : 'border-slate-400 bg-white'}`
    : filledLook;
  return (
    <motion.button
      ref={setNodeRef}
      data-testid={`slot-${index}`}
      onClick={() => !empty && onClear(index)}
      animate={{ scale: isOver && empty ? 1.06 : 1 }}
      transition={{ duration: 0.15 }}
      className={`${base} ${look}`}
    >
      {!hidePos && <span className="block text-xs opacity-70">{label}</span>}
      {empty ? (
        <span className="block text-slate-300"> </span>
      ) : (
        <motion.span
          key={word}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="block"
        >
          {displayToken(word, index)}
        </motion.span>
      )}
    </motion.button>
  );
}

export function SentenceSlots({ slots, placed, onClearSlot, hidePos }: Props) {
  const allFilled = placed.every((p) => p !== null);
  const current = currentSlotIndex(placed);
  return (
    <div className="flex flex-wrap items-end justify-center gap-2">
      {slots.map((label, i) => (
        <Slot key={i} index={i} label={label} word={placed[i]} isCurrent={i === current} onClear={onClearSlot} hidePos={hidePos} />
      ))}
      {allFilled && <span className="self-end pb-3 text-2xl font-semibold text-slate-900">.</span>}
    </div>
  );
}
