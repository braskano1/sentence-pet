// src/components/WordTray.tsx
import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
}

function Tile({ word, index }: { word: string; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <motion.button
      ref={setNodeRef}
      data-testid={`tile-${word}`}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.2 }}
      className="min-h-12 touch-none px-5 py-3 rounded-xl bg-indigo-500 text-white text-lg font-semibold shadow active:scale-95"
    >
      {word}
    </motion.button>
  );
}

export function WordTray({ tiles, used }: Props) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {tiles.map((word, i) =>
        used[i] ? null : <Tile key={`tile-${i}`} word={word} index={i} />,
      )}
    </div>
  );
}
