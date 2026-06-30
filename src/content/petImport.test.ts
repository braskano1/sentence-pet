import { describe, it, expect } from 'vitest';
import { deriveStatBands } from './petImport';
import { GAME_CONFIG } from '../config/gameConfig';

const common = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'common')!.band;

describe('deriveStatBands', () => {
  it('base = gacha common reproduces the gacha table for every rarity & stat', () => {
    const bands = deriveStatBands([common[0], common[1]]);
    for (const tier of GAME_CONFIG.gacha.rarities) {
      for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
        expect(bands[tier.rarity][stat]).toEqual([tier.band[0], tier.band[1]]);
      }
    }
  });

  it('shifts every rarity by the same delta when the base shifts', () => {
    const bands = deriveStatBands([common[0] + 10, common[1] + 10]);
    const rare = GAME_CONFIG.gacha.rarities.find((r) => r.rarity === 'rare')!.band;
    expect(bands.rare.hp).toEqual([rare[0] + 10, rare[1] + 10]);
  });

  it('clamps a derived min below zero up to zero', () => {
    const bands = deriveStatBands([-50, 5]);
    expect(bands.common.hp[0]).toBe(0);            // -50 clamped up to 0
    expect(bands.common.hp[0]).toBeGreaterThanOrEqual(0);
    expect(bands.common.hp[1]).toBeGreaterThanOrEqual(bands.common.hp[0]); // max >= min
  });
});
