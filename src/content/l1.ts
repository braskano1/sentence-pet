import type { L1Helper } from '../data/types';

export type L1Mode = 'TH' | 'ENG';

/** Spec §4 display rule: show Thai iff unit.l1Enabled && mode==='TH' && helper present (non-blank). */
export function showL1(
  unit: { l1Enabled?: boolean },
  mode: L1Mode,
  helper: L1Helper | undefined,
): string | null {
  if (!unit.l1Enabled) return null;
  if (mode !== 'TH') return null;
  if (!helper || helper.th.trim() === '') return null;
  return helper.th;
}
