import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { gradeFillBlank, hintAt } from '../domain/fillblank';
import { computeStars } from '../domain/scoring';
import { shuffle } from '../domain/check';
import { showL1 } from '../content/l1';
import { LessonShell } from './lesson/LessonShell';
import type { FillBlankItem } from '../data/types';

/**
 * Fill-blank practice (Spec §5/§7). WORD BANK input — tap a tile to answer (NO typing:
 * pre-A1 "drag/tap only" rule, and a soft keyboard would cover the sentence on mobile).
 * Grading is unchanged: gradeFillBlank STRICT trimmed exact match against `answer ∪ alternates`.
 * Wrong → escalating hint (L1 → first-letter → length-dots → reveal) + the tapped tile flashes
 * red and disables; NO auto-fill, the learner taps another tile. Wrong taps count as mistakes
 * feeding computeStars. The L1 toggle (gated by unit.l1Enabled) controls the Thai hint rung.
 */

/** Common-word padding pool when siblings can't supply enough distractors (e.g. single-item lesson). */
const FALLBACK_POOL = ['is', 'are', 'am', 'a', 'the', 'in', 'on', 'not'];
const MAX_TILES = 4;

/**
 * Tile set for one item: the correct `answer` plus distractors from the OTHER items' answers
 * (siblings), deduped case-insensitively, excluding the answer and its alternates. Padded from
 * FALLBACK_POOL if fewer than 2 tiles. Capped at MAX_TILES (answer always kept). Shuffled.
 */
export function buildTiles(items: FillBlankItem[], index: number): string[] {
  const item = items[index];
  const answer = item.answer.trim();
  const taken = new Set<string>([answer.toLowerCase()]);
  for (const alt of item.alternates ?? []) taken.add(alt.trim().toLowerCase());

  const distractors: string[] = [];
  const consider = (raw: string) => {
    const word = raw.trim();
    if (!word) return;
    const key = word.toLowerCase();
    if (taken.has(key)) return;
    taken.add(key);
    distractors.push(word);
  };

  items.forEach((other, i) => {
    if (i !== index) consider(other.answer);
  });
  for (const word of FALLBACK_POOL) {
    if (distractors.length >= MAX_TILES - 1) break;
    consider(word);
  }

  const tiles = [answer, ...distractors.slice(0, MAX_TILES - 1)];
  return shuffle(tiles);
}

export function FillBlankScreen({ items, unit }: { items: FillBlankItem[]; unit: { l1Enabled?: boolean } }) {
  const finishRound = useGameStore((s) => s.finishRound);
  const l1Mode = useGameStore((s) => s.l1Mode);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [wrongTiles, setWrongTiles] = useState<Set<string>>(() => new Set());

  // Defensive: an empty pool (e.g. wrong-kind lesson) has nothing to practice.
  const tiles = useMemo(() => (items.length === 0 ? [] : buildTiles(items, index)), [items, index]);
  if (items.length === 0) return null;

  const item = items[index];
  const l1 = showL1(unit, l1Mode, item.l1);
  const [a, b] = item.template.split('___');

  function tap(word: string) {
    if (wrongTiles.has(word)) return; // already-wrong tile is disabled
    setSelected(word);
    if (gradeFillBlank(item, word)) {
      if (index + 1 >= items.length) {
        finishRound({
          drill: 'mixed',
          kind: 'fillblank',
          level: item.level,
          stars: computeStars({ hints: 0, mistakes: wrongCount }),
          correctCount: items.length,
        });
        return;
      }
      setIndex(index + 1);
      setSelected(null);
      setWrongCount(0);
      setHint(null);
      setWrongTiles(new Set());
    } else {
      setHint(hintAt(item, wrongCount, l1));
      setWrongCount((w) => w + 1);
      setWrongTiles((prev) => new Set(prev).add(word));
      setSelected(null);
    }
  }

  return (
    <LessonShell title="Fill the blank" instruction="Tap the missing word." index={index} total={items.length} l1={unit.l1Enabled}>
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      <p className="text-2xl font-bold">
        {a}
        <span className="mx-1 inline-block min-w-[4rem] border-b-4 border-slate-400 px-2 text-center text-emerald-600">
          {selected ?? ' '}
        </span>
        {b}
      </p>
      {hint && <p className="text-lg font-bold text-amber-600">{hint}</p>}
      <div className="mt-auto flex flex-wrap justify-center gap-3">
        {tiles.map((word) => {
          const isWrong = wrongTiles.has(word);
          return (
            <button
              key={word}
              type="button"
              data-testid={`tile-${word}`}
              onClick={() => tap(word)}
              disabled={isWrong}
              className={`min-h-12 min-w-12 rounded-xl px-5 py-3 text-lg font-semibold text-white shadow active:scale-95 ${
                isWrong ? 'cursor-not-allowed bg-rose-400 opacity-60' : 'bg-indigo-500'
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>
    </div>
    </LessonShell>
  );
}
