import { describe, it, expect } from 'vitest';
import { rollStats, makePet } from './pets';
import { GAME_CONFIG } from '../config/gameConfig';

/** Deterministic rng that yields a fixed sequence (cycles). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

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
  it('creates a fresh unhatched pet with the given id/species/stats', () => {
    const stats = rollStats(() => 0.5);
    const p = makePet({ id: 'x', species: 'fire', stats });
    expect(p).toMatchObject({ id: 'x', species: 'fire', hatched: false, xp: 0, stats });
    expect(p.happiness).toBe(GAME_CONFIG.happiness.start);
    expect(p.bars.protein).toBe(GAME_CONFIG.bars.start);
    expect(p.bars.veggie).toBe(GAME_CONFIG.bars.start);
  });

  it('honors hatched:true', () => {
    const p = makePet({ id: 'y', species: 'leaf', stats: rollStats(() => 0.5), hatched: true });
    expect(p.hatched).toBe(true);
  });
});
