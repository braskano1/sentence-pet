import type { FillBlankItem } from '../data/types';

/** Strict trimmed exact match against `answer ∪ alternates`. Case-sensitive (no lowercasing). */
export function gradeFillBlank(item: Pick<FillBlankItem, 'answer' | 'alternates'>, input: string): boolean {
  const guess = input.trim();
  return guess === item.answer.trim() || (item.alternates ?? []).some((a) => a.trim() === guess);
}

/** Escalating hint. `step` counts wrong attempts so far. L1 step skipped when no/blank helper.
 *  Ladder: [L1 (if present)] → first-letter → length-dots → reveal. */
export function hintAt(item: Pick<FillBlankItem, 'answer' | 'l1'>, step: number): string {
  const ladder: string[] = [];
  if (item.l1 && item.l1.th.trim() !== '') ladder.push(item.l1.th);
  ladder.push(`${item.answer[0]}…`);
  ladder.push(item.answer.split('').map(() => '•').join(' '));
  ladder.push(item.answer);
  return ladder[Math.min(step, ladder.length - 1)];
}
