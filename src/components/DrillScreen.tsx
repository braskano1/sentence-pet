import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { trayWords } from '../content/model';
import type { DrillItem, DrillType } from '../data/types';
import { shuffle } from '../domain/check';
import { parseDndId, placeTile, tapPlace, currentSlotIndex } from '../domain/placement';
import { resolveRound, type RoundAction } from '../domain/round';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { stageForXp } from '../domain/xp';
import { useSpeech } from '../hooks/useSpeech';
import { SentenceSlots } from './SentenceSlots';
import { WordTray } from './WordTray';
import { useRoundFeedback } from './useRoundFeedback';
import { useAudio } from '../hooks/useAudio';
import { LessonShell } from './lesson/LessonShell';
import { DrillPet, type PetReaction } from './drill/DrillPet';
import { WhyTip } from './drill/WhyTip';
import { HintButton } from './drill/HintButton';
import { SubmitBar } from './drill/SubmitBar';

export function DrillScreen({ items, drill, level }: { items: DrillItem[]; drill: DrillType; level: number }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const pet = useGameStore(selectActivePet);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => items[0].slots.map(() => null));
  const [tiles, setTiles] = useState<string[]>(() => shuffle(trayWords(items[0])));
  const [used, setUsed] = useState<boolean[]>(() => trayWords(items[0]).map(() => false));
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [why, setWhy] = useState<string | null>(null);
  const [reaction, setReaction] = useState<PetReaction>('idle');
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const { feedback, play, locked } = useRoundFeedback();
  const { play: playAudio } = useAudio(); // `play` is taken by useRoundFeedback
  const speak = useSpeech();

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
    setWhy(null);
    setReaction('idle');
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

  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return;
    setPlaced(next.placed);
    setUsed(next.used);
    setWhy(null);
    playAudio('drop');
  }

  function onTapPlace(tileIndex: number) {
    if (locked) return;
    speak.speakWord(tiles[tileIndex]);
    commit(tapPlace({ placed, used }, tiles, tileIndex));
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
    speak.speakWord(tiles[from.index]);
    commit(placeTile({ placed, used }, tiles, from.index, to.index));
  }

  function evaluate(filled: (string | null)[]) {
    const action = resolveRound({ item, filled, index, total: items.length, mistakes });
    if (action.type === 'retry') {
      setReaction('wrong');
      play('wrong', () => applyAction(action, filled));
      return;
    }
    speak.speakSentence(item.answer.join(' '));
    setReaction('correct');
    play('correct', () => applyAction(action, filled));
  }

  function applyAction(action: RoundAction, filled: (string | null)[]) {
    switch (action.type) {
      case 'finish':
        finishRound({ drill, level, stars: action.stars, correctCount: items.length });
        break;
      case 'advance':
        setStreak((s) => s + 1);
        setIndex(action.nextIndex);
        loadItem(action.nextIndex);
        break;
      case 'retry': {
        setMistakes((m) => m + 1);
        setStreak(0);
        const np = [...filled];
        const nu = [...used];
        for (const si of action.wrongSlots) {
          const w = filled[si];
          np[si] = null;
          const ui = tiles.findIndex((t, i) => nu[i] && t === w);
          if (ui !== -1) nu[ui] = false;
        }
        setPlaced(np);
        setUsed(nu);
        setWhy(action.tip ?? `The ${item.slots[action.wrongSlots[0]]} isn't right yet.`);
        break;
      }
    }
  }

  function hint() {
    if (locked) return;
    const slot = currentSlotIndex(placed);
    if (slot === -1) return;
    const word = item.answer[slot];
    const tileIndex = tiles.findIndex((t, i) => !used[i] && t === word);
    if (tileIndex === -1) return;
    setStreak(0);
    setMistakes((m) => m + 1);
    setWhy(null);
    speak.speakWord(word);
    commit(placeTile({ placed, used }, tiles, tileIndex, slot));
  }

  const ready = placed.every((p) => p !== null);

  const stage = stageForXp(pet.xp, pet.hatched);
  const line = why
    ? 'Hmm, not quite!'
    : currentSlotIndex(placed) === -1
      ? 'Looks done — check it! 👀'
      : `Which ${item.slots[currentSlotIndex(placed)]}? 👀`;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <LessonShell title="Build the sentence" streak={streak} index={index} total={items.length}>
      <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-50 p-4">
        <DrillPet species={pet.species} stage={stage} happiness={pet.happiness} reaction={reaction} line={line} defId={pet.defId} />

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-slate-800">{item.thaiHint}</span>
            <button
              type="button" aria-label="Hear the meaning"
              onClick={() => speak.speakThai(item.thaiHint)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700"
            >🔊</button>
            <HintButton onHint={hint} disabled={locked || currentSlotIndex(placed) === -1} />
          </div>
        </div>

        <div
          className={`relative flex flex-1 flex-col items-center justify-center gap-3 rounded-xl ${
            feedback === 'correct' ? 'flash-correct' : feedback === 'wrong' ? 'shake-wrong' : ''
          }`}
        >
          <SentenceSlots slots={item.slots} placed={placed} onClearSlot={handleClear} hidePos={item.hidePos} />
          {why && <WhyTip text={why} />}
          {feedback && (
            <div
              aria-hidden
              className={`pop-check pointer-events-none absolute text-6xl font-bold ${
                feedback === 'wrong' ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {feedback === 'wrong' ? '✗' : '✓'}
            </div>
          )}
        </div>

        {ready && !locked && <SubmitBar onSubmit={() => evaluate(placed)} />}

        <div className="pb-2">
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>
      </div>
      </LessonShell>
      <DragOverlay>
        {activeWord ? (
          <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white shadow">{activeWord}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
