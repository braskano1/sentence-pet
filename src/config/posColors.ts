import type { PosLabel } from '../data/types';

/** Tailwind chip classes (bg + text + border) for a POS-colored slot or placed word. */
const MAP: Record<PosLabel, string> = {
  Subject: 'bg-sky-100 text-sky-900 border-sky-300',
  Verb: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Object: 'bg-amber-100 text-amber-900 border-amber-300',
};

const FALLBACK = 'bg-slate-100 text-slate-900 border-slate-300';

export function posClasses(label: PosLabel | string): string {
  return (MAP as Record<string, string>)[label] ?? FALLBACK;
}
