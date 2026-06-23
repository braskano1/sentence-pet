export interface RoundTally {
  hints: number;
  mistakes: number;
}

/** 3 stars clean; -1 star per ~2 slips; floored at 1 (level is cleared). */
export function computeStars({ hints, mistakes }: RoundTally): 1 | 2 | 3 {
  const slips = hints + mistakes;
  if (slips === 0) return 3;
  if (slips <= 2) return 2;
  return 1;
}
