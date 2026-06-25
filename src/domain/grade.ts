import type { DrillItem } from '../data/types';

export type GradeStatus = 'ideal' | 'flagged' | 'wrong';

export interface Grade {
  status: GradeStatus;
  passes: boolean;   // may the round advance/finish on this placement?
  flags: string[];   // tip strings for flagged near-miss tiles, in slot order
}

type GradeItem = Pick<DrillItem, 'answer' | 'traps' | 'strictness'>;

/**
 * Grades a fully- or partially-placed sentence against an item.
 * - Exact match in every slot -> 'ideal'.
 * - Every off slot is a registered near-miss trap -> 'flagged'
 *   (passes only when strictness !== 'enforce').
 * - Any off slot that is not a trap (including an unfilled null) -> 'wrong'.
 */
export function gradePlacement(placed: (string | null)[], item: GradeItem): Grade {
  const { answer, traps, strictness } = item;
  if (placed.length !== answer.length) {
    return { status: 'wrong', passes: false, flags: [] };
  }
  const flags: string[] = [];
  let wrong = false;

  for (let i = 0; i < answer.length; i++) {
    const word = placed[i];
    if (word === answer[i]) continue;
    const trap = traps?.find((t) => t.slot === i && t.word === word);
    if (trap && word !== null) {
      flags.push(trap.tip);
    } else {
      wrong = true;
    }
  }

  if (wrong) return { status: 'wrong', passes: false, flags: [] };
  if (flags.length > 0) {
    return { status: 'flagged', passes: strictness !== 'enforce', flags };
  }
  return { status: 'ideal', passes: true, flags: [] };
}
