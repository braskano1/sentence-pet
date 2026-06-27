import { describe, it, expect } from 'vitest';
import { BOSS_TIERS, findTier, recommendedPower } from './bossTiers';

describe('boss tiers', () => {
  it('ships a 5-rung ladder, ordered weakest → strongest by hpPool', () => {
    expect(BOSS_TIERS).toHaveLength(5);
    const hps = BOSS_TIERS.map((t) => t.hpPool);
    expect([...hps].sort((a, b) => a - b)).toEqual(hps);
  });
  it('every tier has a unique id', () => {
    expect(new Set(BOSS_TIERS.map((t) => t.id)).size).toBe(5);
  });
  it('findTier resolves by id, undefined when unknown', () => {
    expect(findTier(BOSS_TIERS[0].id)?.id).toBe(BOSS_TIERS[0].id);
    expect(findTier('nope')).toBeUndefined();
  });
  it('recommendedPower sums the tier combat stats', () => {
    const t = BOSS_TIERS[0];
    expect(recommendedPower(t)).toBe(t.hpStatEquivalent + t.atk + t.def + t.spd);
  });
});
