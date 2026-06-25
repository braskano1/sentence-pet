import { describe, it, expect } from 'vitest';
import { rollStats, makePet, rollRarity, rollStatsForRarity } from './pets';
import { GAME_CONFIG } from '../config/gameConfig';
import type { Rarity } from '../data/types';

/** Deterministic rng that yields a fixed sequence (cycles). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const RARITIES = [
  { rarity: 'common' as Rarity,    weight: 65, band: [40, 60] as [number, number] },
  { rarity: 'rare' as Rarity,      weight: 25, band: [55, 75] as [number, number] },
  { rarity: 'epic' as Rarity,      weight: 8,  band: [72, 88] as [number, number] },
  { rarity: 'legendary' as Rarity, weight: 2,  band: [85, 90] as [number, number] },
];

describe('rollStats', () => {
  it('rolls all five stats within [40,90]', () => {
    const stats = rollStats(() => 0.5);
    for (const v of Object.values(stats)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(90);
    }
    expect(Object.keys(stats).sort()).toEqual(['atk', 'def', 'hp', 'luk', 'spd']);
  });

  it('rng=0 floors to 40, rng~1 ceils to 90', () => {
    expect(rollStats(() => 0).hp).toBe(40);
    expect(rollStats(() => 0.999).hp).toBe(90);
  });

  it('is deterministic for a given rng sequence', () => {
    const a = rollStats(seq([0.1, 0.2, 0.3, 0.4, 0.5]));
    const b = rollStats(seq([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(a).toEqual(b);
  });
});

describe('makePet', () => {
  it('creates a fresh unhatched pet with the given id/species/stats/rarity', () => {
    const stats = rollStats(() => 0.5);
    const p = makePet({ id: 'x', species: 'fire', stats, rarity: 'rare' });
    expect(p).toMatchObject({ id: 'x', species: 'fire', hatched: false, xp: 0, stats, rarity: 'rare' });
    expect(p.happiness).toBe(GAME_CONFIG.happiness.start);
    expect(p.bars.protein).toBe(GAME_CONFIG.bars.start);
    expect(p.bars.veggie).toBe(GAME_CONFIG.bars.start);
  });

  it('honors hatched:true', () => {
    const p = makePet({ id: 'y', species: 'leaf', stats: rollStats(() => 0.5), rarity: 'common', hatched: true });
    expect(p.hatched).toBe(true);
  });
});

describe('rollRarity', () => {
  // weights sum to 100; rng()*100 selects by cumulative band: [0,65) common, [65,90) rare, [90,98) epic, [98,100) legendary
  it('rng=0 -> first tier (common)', () => expect(rollRarity(() => 0, RARITIES)).toBe('common'));
  it('just below the common cutoff -> common', () => expect(rollRarity(() => 0.649, RARITIES)).toBe('common'));
  it('at the common cutoff -> rare', () => expect(rollRarity(() => 0.65, RARITIES)).toBe('rare'));
  it('mid-rare -> rare', () => expect(rollRarity(() => 0.89, RARITIES)).toBe('rare'));
  it('at the rare cutoff -> epic', () => expect(rollRarity(() => 0.90, RARITIES)).toBe('epic'));
  it('at the epic cutoff -> legendary', () => expect(rollRarity(() => 0.98, RARITIES)).toBe('legendary'));
  it('rng~1 -> last tier (legendary)', () => expect(rollRarity(() => 0.999, RARITIES)).toBe('legendary'));
});

describe('rollStatsForRarity', () => {
  it('rolls all five stats within the tier band', () => {
    for (const t of RARITIES) {
      const stats = rollStatsForRarity(t.rarity, () => 0.5, RARITIES);
      for (const v of Object.values(stats)) {
        expect(v).toBeGreaterThanOrEqual(t.band[0]);
        expect(v).toBeLessThanOrEqual(t.band[1]);
      }
    }
  });
  it('rng=0 floors to band min, rng~1 ceils to band max', () => {
    expect(rollStatsForRarity('epic', () => 0, RARITIES).hp).toBe(72);
    expect(rollStatsForRarity('epic', () => 0.999, RARITIES).hp).toBe(88);
  });
  it('is deterministic for a given rng sequence', () => {
    const a = rollStatsForRarity('rare', seq([0.1, 0.2, 0.3, 0.4, 0.5]), RARITIES);
    const b = rollStatsForRarity('rare', seq([0.1, 0.2, 0.3, 0.4, 0.5]), RARITIES);
    expect(a).toEqual(b);
  });
});
