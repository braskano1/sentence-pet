import { useMemo, useState } from 'react';
import { itemsForLevel } from '../data/wordBank';
import { isPlacementCorrect, shuffle } from '../domain/check';
import { useGameStore } from '../state/gameStore';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';

export function EggHatch() {
  const hatch = useGameStore((s) => s.hatch);
  const item = useMemo(() => itemsForLevel(1)[0], []);
  const [placed, setPlaced] = useState<(string | null)[]>(item.slots.map(() => null));
  const [tiles] = useState<string[]>(() => shuffle(item.answer));
  const [usedWords, setUsedWords] = useState<string[]>([]);

  function handlePick(word: string) {
    const slot = placed.findIndex((p) => p === null);
    if (slot === -1) return;
    const next = [...placed];
    next[slot] = word;
    setPlaced(next);
    setUsedWords([...usedWords, word]);
    if (next.findIndex((p) => p === null) === -1) {
      if (isPlacementCorrect(next, item.answer)) hatch();
      else {
        setPlaced(item.slots.map(() => null));
        setUsedWords([]);
      }
    }
  }

  function handleClear(i: number) {
    const word = placed[i];
    if (word === null) return;
    const next = [...placed];
    next[i] = null;
    setPlaced(next);
    const idx = usedWords.indexOf(word);
    if (idx !== -1) setUsedWords(usedWords.filter((_, k) => k !== idx));
  }

  function remainingTiles(): string[] {
    const counts: Record<string, number> = {};
    for (const w of usedWords) counts[w] = (counts[w] ?? 0) + 1;
    const out: string[] = [];
    for (const t of tiles) {
      if (counts[t]) counts[t]--;
      else out.push(t);
    }
    return out;
  }

  return (
    <div className="flex h-full flex-col bg-indigo-50 p-4">
      {/* top zone: egg + prompt + hint */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="text-[clamp(3rem,14vh,5rem)] leading-none">🥚</div>
        <p className="text-slate-600">Build the sentence to hatch your pet!</p>
        <p className="text-2xl text-slate-700">{item.thaiHint}</p>
      </div>
      {/* middle zone: slots, centered */}
      <div className="flex flex-1 items-center justify-center">
        <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} />
      </div>
      {/* bottom zone: tray pinned */}
      <div className="pb-2">
        <WordTray tiles={remainingTiles()} onPickWord={handlePick} />
      </div>
    </div>
  );
}
