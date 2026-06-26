// src/components/DrillScreen.tsx
import { useState } from 'react';
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
import { trayWords } from '../content/model';
import type { DrillItem, DrillType } from '../data/types';
import { shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { resolveRound, type RoundAction } from '../domain/round';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';

export function DrillScreen({ items, drill, level }: { items: DrillItem[]; drill: DrillType; level: number }) {
  const finishRound = useGameStore((s) => s.finishRound);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(trayWords(items[0])));
  const [used, setUsed] = useState<boolean[]>(() => trayWords(items[0]).map(() => false));
  const [mistakes, setMistakes] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();

  const item = items[index];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function loadItem(i: number) {
    const words = trayWords(items[i]);
    setPlaced(items[i].slots.map(() => null));
    setTiles(shuffle(words));
    setUsed(words.map(() => false));
  }

  function handleClear(slotIndex: number) {
    if (locked) return;
    const word = placed[slotIndex];
    if (word === null) return;
    const next = [...placed];
    next[slotIndex] = null;
    setPlaced(next);
    const ui = used.findIndex((u, i) => u && tiles[i] === word);
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
    if (next.placed === placed) return; // no-op (slot filled / tile used)
    setPlaced(next.placed);
    setUsed(next.used);
    if (next.placed.every((p) => p !== null)) evaluate(next.placed);
  }

  function evaluate(filled: (string | null)[]) {
    const action = resolveRound({
      item,
      filled,
      index,
      total: items.length,
      mistakes,
    });
    if (action.type === 'retry') {
      setTip(null);
      play('wrong', () => applyAction(action));
      return;
    }
    // action is advance|finish here, so action.flags is string[] (no narrowing tricks needed)
    const kind = action.flags.length ? 'flag' : 'correct';
    setTip(kind === 'flag' ? action.flags.join(' · ') : null);
    play(kind, () => applyAction(action));
  }

  function applyAction(action: RoundAction) {
    switch (action.type) {
      case 'finish':
        finishRound({ drill, level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
        if (action.flags.length) setMistakes((m) => m + 1); // flag = one slip
        setTip(null);
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
      case 'retry':
        setMistakes((m) => m + 1);
        loadItem(index);
        break;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col bg-slate-100 p-4">
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-slate-500">Sentence {index + 1} of {items.length}</p>
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
                feedback === 'correct'
                  ? 'text-emerald-500'
                  : feedback === 'flag'
                    ? 'text-sky-500'
                    : 'text-red-500'
              }`}
            >
              {feedback === 'wrong' ? '✗' : '✓'}
            </div>
          )}
          {feedback === 'flag' && tip && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute bottom-2 rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-semibold text-sky-800 shadow"
            >
              {tip}
            </motion.div>
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
