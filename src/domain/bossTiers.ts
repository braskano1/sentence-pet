import { GAME_CONFIG } from '../config/gameConfig';

/** A reusable boss template the admin picks from. `phases` is reserved for P3
 *  (P1 treats every boss as single-phase). `hpStatEquivalent` is the hp-stat the
 *  recommended-power comparison uses (so it is comparable to a pet's petPower). */
export interface BossTier {
  id: string;
  label: string;
  hpPool: number;
  hpStatEquivalent: number;
  atk: number;
  def: number;
  spd: number;
  phases: number;
  rewardTier: number;
  projectileVfxLevel: number;
}

export const BOSS_TIERS: readonly BossTier[] = [
  { id: 'tier-1', label: 'Sprout',  hpPool: 400,  hpStatEquivalent: 50,  atk: 45, def: 40, spd: 45, phases: 1, rewardTier: 1, projectileVfxLevel: 1 },
  { id: 'tier-2', label: 'Scout',   hpPool: 650,  hpStatEquivalent: 60,  atk: 55, def: 50, spd: 55, phases: 1, rewardTier: 2, projectileVfxLevel: 2 },
  { id: 'tier-3', label: 'Veteran', hpPool: 950,  hpStatEquivalent: 70,  atk: 65, def: 60, spd: 62, phases: 2, rewardTier: 3, projectileVfxLevel: 3 },
  { id: 'tier-4', label: 'Elite',   hpPool: 1300, hpStatEquivalent: 80,  atk: 75, def: 70, spd: 70, phases: 2, rewardTier: 4, projectileVfxLevel: 4 },
  { id: 'tier-5', label: 'Legend',  hpPool: 1700, hpStatEquivalent: 88,  atk: 85, def: 80, spd: 78, phases: 3, rewardTier: 5, projectileVfxLevel: 5 },
] as const;

export function findTier(id: string): BossTier | undefined {
  return BOSS_TIERS.find((t) => t.id === id);
}

/** Recommended pet power to face this tier — comparable to petPower(pet). */
export function recommendedPower(tier: BossTier): number {
  return tier.hpStatEquivalent + tier.atk + tier.def + tier.spd;
}

/** Evenly-spaced HP-fraction thresholds for an N-phase boss, descending.
 *  1 → [] · 2 → [0.5] · 3 → [2/3, 1/3]. */
export function phaseThresholds(phases: number): number[] {
  const out: number[] = [];
  for (let i = phases - 1; i >= 1; i--) out.push(i / phases);
  return out;
}

/** Current phase index from the boss HP ratio: how many thresholds it has passed
 *  (ratio at or below the threshold counts as crossed). */
export function phaseFromHp(hpRatio: number, thresholds: number[]): number {
  return thresholds.filter((t) => hpRatio <= t).length;
}

/** Sprite scale within the reserved (largest-phase) box. Final phase = 1.0;
 *  earlier phases interpolate up from spriteScaleMin. Single-phase → 1.0. */
export function phaseScale(phaseIndex: number, phases: number): number {
  if (phases <= 1) return 1;
  const min = GAME_CONFIG.battle.phaseRamp.spriteScaleMin;
  return min + (1 - min) * (phaseIndex / (phases - 1));
}
