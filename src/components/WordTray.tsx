import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
  onTapPlace?: (index: number) => void;
}

function Tile({ word, index, onTap }: { word: string; index: number; onTap?: (i: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <motion.button
      ref={setNodeRef}
      data-testid={`tile-${word}`}
      {...listeners}
      {...attributes}
      onClick={() => onTap?.(index)}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      className="min-h-12 touch-none rounded-xl bg-indigo-500 px-5 py-3 text-lg font-semibold text-white shadow active:scale-95"
    >
      {word}
    </motion.button>
  );
}

export function WordTray({ tiles, used, onTapPlace }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tiles.map((word, i) =>
        used[i] ? null : <Tile key={`tile-${i}`} word={word} index={i} onTap={onTapPlace} />,
      )}
    </div>
  );
}
