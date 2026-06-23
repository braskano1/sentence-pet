/** True only when every slot is filled and matches the answer in order. */
export function isPlacementCorrect(
  placed: (string | null)[],
  answer: string[],
): boolean {
  if (placed.length !== answer.length) return false;
  return placed.every((word, i) => word !== null && word === answer[i]);
}

/** Fisher–Yates shuffle returning a new array (input untouched). */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
