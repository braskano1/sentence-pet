// src/components/DrillScreen.tsx
import { useMemo, useState } from 'react';
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
import { itemsForLevel } from '../data/wordBank';
import { shuffle } from '../domain/check';
import { parseDndId, placeTile } from '../domain/placement';
import { resolveRound } from '../domain/round';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';

export function DrillScreen({ level }: { level: number }) {
  const items = useMemo(() => itemsForLevel(level), [level]);
  const finishRound = useGameStore((s) => s.finishRound);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [used, setUsed] = useState<boolean[]>(() => items[0].answer.map(() => false));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(items[0].answer));
  const [mistakes, setMistakes] = useState(0);
  const [activeWord, setActiveWord] = useState<string | null>(null);

  const item = items[index];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function loadItem(i: number) {
    setPlaced(items[i].slots.map(() => null));
    setUsed(items[i].answer.map(() => false));
    setTiles(shuffle(items[i].answer));
  }

  function handleClear(slotIndex: number) {
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
    const id = parseDndId(String(e.active.id));
    if (id?.kind === 'tile') setActiveWord(tiles[id.index]);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
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
      filled,
      answer: item.answer,
      index,
      total: items.length,
      mistakes,
    });
    switch (action.type) {
      case 'finish':
        finishRound({ level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
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
        <div className="flex flex-1 items-center justify-center">
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
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
