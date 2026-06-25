// src/components/EggHatch.tsx
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { itemsFor } from '../data/wordBank';
import { isPlacementCorrect, shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { EGG_SPRITE } from '../config/sprites';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';

export function EggHatch() {
  const hatch = useGameStore((s) => s.hatch);
  const item = useMemo(() => itemsFor('pattern', 1)[0], []);
  const [placed, setPlaced] = useState<(string | null)[]>(() => item.slots.map(() => null));
  const [used, setUsed] = useState<boolean[]>(() => item.answer.map(() => false));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(item.answer));
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function reset() {
    setPlaced(item.slots.map(() => null));
    setUsed(item.answer.map(() => false));
    setTiles(shuffle(item.answer));
  }

  function handleClear(i: number) {
    if (locked) return;
    const word = placed[i];
    if (word === null) return;
    const next = [...placed];
    next[i] = null;
    setPlaced(next);
    const ui = used.findIndex((u, k) => u && tiles[k] === word);
    if (ui !== -1) {
      const nextUsed = [...used];
      nextUsed[ui] = false;
      setUsed(nextUsed);
    }
  }

  function onDragStart(e: DragStartEvent) {
    if (locked) return;
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (locked) return;
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    const next = placeTile({ placed, used }, tiles, from.index, to.index);
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) {
      const correct = isPlacementCorrect(next.placed, item.answer);
      play(correct ? 'correct' : 'wrong', () => (correct ? hatch() : reset()));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col bg-indigo-50 p-4">
        <div className="flex flex-col items-center gap-3 pt-2">
          <motion.img
            src={EGG_SPRITE}
            alt="egg"
            draggable={false}
            className="h-[clamp(3rem,14vh,5rem)] w-auto object-contain"
            animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
          <p className="text-slate-600">Build the sentence to hatch your pet!</p>
          <p className="text-2xl text-slate-700">{item.thaiHint}</p>
        </div>
        <div
          className={`relative flex flex-1 items-center justify-center rounded-xl ${
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
          {feedback && (
            <div
              aria-hidden="true"
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'correct' ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {feedback === 'correct' ? '✓' : '✗'}
            </div>
          )}
        </div>
        <div className="pb-2">
          <WordTray tiles={tiles} used={used} />
        </div>
      </div>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 px-5 py-3 rounded-xl bg-indigo-600 text-white text-lg font-semibold shadow">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
