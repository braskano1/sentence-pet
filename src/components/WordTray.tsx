// src/components/WordTray.tsx
import { useDraggable } from '@dnd-kit/core';

interface Props {
  tiles: string[];
  used: boolean[];
}

function Tile({ word, index }: { word: string; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile-${index}` });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`min-h-12 touch-none px-5 py-3 rounded-xl bg-indigo-500 text-white text-lg font-semibold shadow active:scale-95 ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {word}
    </button>
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
