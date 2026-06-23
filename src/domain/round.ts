// src/domain/round.ts
import { isPlacementCorrect } from './check';
import { computeStars } from './scoring';

export type RoundAction =
  | { type: 'finish'; stars: number }
  | { type: 'advance'; nextIndex: number }
  | { type: 'retry' };

/** Pure decision for what happens after a sentence is fully placed. */
export function resolveRound(params: {
  filled: (string | null)[];
  answer: string[];
  index: number;
  total: number;
  mistakes: number;
}): RoundAction {
  const { filled, answer, index, total, mistakes } = params;
  if (!isPlacementCorrect(filled, answer)) return { type: 'retry' };
  if (index === total - 1) {
    return { type: 'finish', stars: computeStars({ hints: 0, mistakes }) };
  }
  return { type: 'advance', nextIndex: index + 1 };
}
