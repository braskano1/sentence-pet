import type { PosLabel } from '../data/types';

/** Tailwind chip classes (bg + text + border) for a POS-colored slot or placed word. */
const MAP: Record<PosLabel, string> = {
  Subject: 'bg-sky-100 text-sky-900 border-sky-300',
  Verb: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Object: 'bg-amber-100 text-amber-900 border-amber-300',
  Be: 'bg-rose-100 text-rose-900 border-rose-300',
  Adjective: 'bg-violet-100 text-violet-900 border-violet-300',
  Not: 'bg-slate-100 text-slate-900 border-slate-300',
  Helper: 'bg-teal-100 text-teal-900 border-teal-300',
  Question: 'bg-orange-100 text-orange-900 border-orange-300',
  Place: 'bg-lime-100 text-lime-900 border-lime-300',
};

const FALLBACK = 'bg-slate-100 text-slate-900 border-slate-300';

export function posClasses(label: PosLabel | string): string {
  return (MAP as Record<string, string>)[label] ?? FALLBACK;
}
