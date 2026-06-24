// src/domain/bars.ts

/** Bar fill color: identity color when healthy, amber when low, red when critical. */
export function barColor(value: number, healthyColor: string): string {
  if (value < 15) return 'bg-red-500';
  if (value < 30) return 'bg-amber-500';
  return healthyColor;
}
