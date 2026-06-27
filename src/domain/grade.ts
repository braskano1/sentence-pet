import type { DrillItem } from '../data/types';

export type GradeStatus = 'ideal' | 'wrong';

export interface Grade {
  status: GradeStatus;
  passes: boolean; // may the round advance/finish on this placement?
}

type GradeItem = Pick<DrillItem, 'answer' | 'traps'>;

/**
 * Grades a fully- or partially-placed sentence against an item.
 * - Exact match in every slot -> 'ideal' (passes).
 * - Anything else (a registered near-miss trap, an unknown word, or an
 *   unfilled null) -> 'wrong' (does not pass). Near-miss traps no longer
 *   pass; their teaching tip is surfaced on retry by round.ts.
 */
export function gradePlacement(placed: (string | null)[], item: GradeItem): Grade {
  const { answer } = item;
  if (placed.length !== answer.length) {
    return { status: 'wrong', passes: false };
  }
  for (let i = 0; i < answer.length; i++) {
    if (placed[i] !== answer[i]) return { status: 'wrong', passes: false };
  }
  return { status: 'ideal', passes: true };
}

export type SlotResult = 'ok' | 'wrong';

/** Per-slot correctness for partial retry. Only an exact match is ok. */
export function slotResults(placed: (string | null)[], item: GradeItem): SlotResult[] {
  return item.answer.map((ans, i) => (placed[i] === ans ? 'ok' : 'wrong'));
}
