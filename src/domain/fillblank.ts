import type { FillBlankItem } from '../data/types';

/** Strict trimmed exact match against `answer ∪ alternates`. Case-sensitive (no lowercasing). */
export function gradeFillBlank(item: Pick<FillBlankItem, 'answer' | 'alternates'>, input: string): boolean {
  const guess = input.trim();
  return guess === item.answer.trim() || (item.alternates ?? []).some((a) => a.trim() === guess);
}

/** Escalating hint. `step` counts wrong attempts. `l1` is the already-gated Thai helper
 *  (pass showL1(...) result, or null to omit the L1 rung). Ladder: [l1?] → first-letter → length-dots → reveal. */
export function hintAt(item: Pick<FillBlankItem, 'answer'>, step: number, l1: string | null): string {
  const ladder: string[] = [];
  if (l1 && l1.trim() !== '') ladder.push(l1);
  ladder.push(`${item.answer[0]}…`);
  ladder.push(item.answer.split('').map(() => '•').join(' '));
  ladder.push(item.answer);
  return ladder[Math.min(step, ladder.length - 1)];
}
