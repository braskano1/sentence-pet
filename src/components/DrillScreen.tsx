import { useMemo, useState } from 'react';
import { itemsForLevel } from '../data/wordBank';
import { isPlacementCorrect, shuffle } from '../domain/check';
import { computeStars } from '../domain/scoring';
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

  const item = items[index];

  function loadItem(i: number) {
    setPlaced(items[i].slots.map(() => null));
    setUsed(items[i].answer.map(() => false));
    setTiles(shuffle(items[i].answer));
  }

  function nextEmpty(arr: (string | null)[]): number {
    return arr.findIndex((p) => p === null);
  }

  function handlePick(word: string) {
    const slot = nextEmpty(placed);
    if (slot === -1) return;
    // mark first matching unused tile as used so duplicates work
    const tileIdx = tiles.findIndex((t, i) => t === word && !used[i]);
    const nextUsed = [...used];
    if (tileIdx !== -1) nextUsed[tileIdx] = true;
    const next = [...placed];
    next[slot] = word;
    setPlaced(next);
    setUsed(nextUsed);

    if (nextEmpty(next) === -1) evaluate(next);
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

  function evaluate(filled: (string | null)[]) {
    if (isPlacementCorrect(filled, item.answer)) {
      const last = index === items.length - 1;
      if (last) {
        finishRound({
          level,
          stars: computeStars({ hints: 0, mistakes }),
          correctCount: items.length,
        });
      } else {
        const ni = index + 1;
        setIndex(ni);
        loadItem(ni);
      }
    } else {
      setMistakes((m) => m + 1);
      loadItem(index); // reshuffle + clear to retry
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-100 p-4">
      {/* top zone: progress + hint */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <p className="text-sm text-slate-500">Sentence {index + 1} of {items.length}</p>
        <p className="text-2xl text-slate-700">{item.thaiHint}</p>
      </div>
      {/* middle zone: slots, centered, grabs slack */}
      <div className="flex flex-1 items-center justify-center">
        <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
      </div>
      {/* bottom zone: tray pinned in the thumb arc */}
      <div className="pb-2">
        <WordTray tiles={tiles.filter((_, i) => !used[i])} onPickWord={handlePick} />
      </div>
    </div>
  );
}
