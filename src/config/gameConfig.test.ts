import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from './gameConfig';
import { DECOR_SPRITES } from './decorSprites';

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
    expect(GAME_CONFIG.xp.maxLevel).toBe(50);
    expect(GAME_CONFIG.xp.curve).toEqual({ base: 40, growth: 1.5 });
  });
});

describe('shop.decor catalog', () => {
  const decor = GAME_CONFIG.shop.decor;

  it('lists all 7 rooms', () => {
    expect(decor).toHaveLength(7);
  });

  it('every item is kind=decor, decor-namespaced id, positive price, real sprite', () => {
    for (const item of decor) {
      expect(item.kind).toBe('decor');
      expect(item.id.startsWith('decor:')).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      expect(item.sprite).toBe(DECOR_SPRITES[item.id]);
    }
  });

  it('prices follow the 50/100/150 tiers', () => {
    const prices = decor.map((d) => d.price).sort((a, b) => a - b);
    expect(prices).toEqual([50, 50, 50, 100, 100, 150, 150]);
  });

  it('ids are unique', () => {
    const ids = decor.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('battle.timer (P2)', () => {
  it('defines a positive charge duration and swipe window', () => {
    expect(GAME_CONFIG.battle.timer.chargeMs).toBeGreaterThan(0);
    expect(GAME_CONFIG.battle.timer.swipeWindowMs).toBeGreaterThan(0);
  });
  it('wrongLurchFrac is a fraction in (0, 1)', () => {
    expect(GAME_CONFIG.battle.timer.wrongLurchFrac).toBeGreaterThan(0);
    expect(GAME_CONFIG.battle.timer.wrongLurchFrac).toBeLessThan(1);
  });
});
