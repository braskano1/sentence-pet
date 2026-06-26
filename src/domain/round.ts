import type { DrillItem } from '../data/types';
import { gradePlacement, slotResults } from './grade';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number; flags: string[] }
  | { type: 'advance'; nextIndex: number; flags: string[] }
  | { type: 'retry'; wrongSlots: number[]; tip: string | null };

type RoundItem = Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;

function firstTrapTip(item: RoundItem, filled: (string | null)[], wrongSlots: number[]): string | null {
  for (const i of wrongSlots) {
    const trap = item.traps?.find((t) => t.slot === i && t.word === filled[i]);
    if (trap) return trap.tip;
  }
  return null;
}

/** Pure decision for what happens after a sentence is fully placed. */
export function resolveRound(params: {
  item: RoundItem;
  filled: (string | null)[];
  index: number;
  total: number;
  mistakes: number;
}): RoundAction {
  const { item, filled, index, total, mistakes } = params;
  const grade = gradePlacement(filled, item);
  if (!grade.passes) {
    const wrongSlots = slotResults(filled, item)
      .map((r, i) => (r === 'wrong' ? i : -1))
      .filter((i) => i >= 0);
    return { type: 'retry', wrongSlots, tip: firstTrapTip(item, filled, wrongSlots) };
  }

  const slips = mistakes + (grade.status === 'flagged' ? 1 : 0);
  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes: slips }), flags: grade.flags };
  }
  return { type: 'advance', nextIndex: index + 1, flags: grade.flags };
}
