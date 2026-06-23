import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from './gameConfig';

describe('GAME_CONFIG', () => {
  it('exposes locked tuning constants', () => {
    expect(GAME_CONFIG.bars.start).toBe(60);
    expect(GAME_CONFIG.bars.decayPerRound).toBe(5);
    expect(GAME_CONFIG.bars.max).toBe(100);
    expect(GAME_CONFIG.food.restorePerItem).toBe(15);
    expect(GAME_CONFIG.happiness.decayPerRound).toBe(5);
    expect(GAME_CONFIG.happiness.onClear).toBe(10);
    expect(GAME_CONFIG.happiness.onThreeStars).toBe(5);
    expect(GAME_CONFIG.round.size).toBe(5);
    expect(GAME_CONFIG.coins.base).toBe(10);
    expect(GAME_CONFIG.coins.perStar).toBe(5);
    expect(GAME_CONFIG.xp.perLevelMultiplier).toBe(10);
    expect(GAME_CONFIG.xp.evolution).toEqual({ baby: 0, young: 1000, adult: 3000 });
  });
});
