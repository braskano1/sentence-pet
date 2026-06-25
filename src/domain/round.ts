// src/domain/round.ts
import type { DrillItem } from '../data/types';
import { gradePlacement } from './grade';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number; flags: string[] }
  | { type: 'advance'; nextIndex: number; flags: string[] }
  | { type: 'retry' };

/** Pure decision for what happens after a sentence is fully placed. */
export function resolveRound(params: {
  item: Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;
  filled: (string | null)[];
  index: number;
  total: number;
  mistakes: number;
}): RoundAction {
  const { item, filled, index, total, mistakes } = params;
  const grade = gradePlacement(filled, item);
  if (!grade.passes) return { type: 'retry' };

  // A flag-mode near-miss accept counts as one slip toward stars.
  const slips = mistakes + (grade.status === 'flagged' ? 1 : 0);
  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes: slips }), flags: grade.flags };
  }
  return { type: 'advance', nextIndex: index + 1, flags: grade.flags };
}
