import { describe, it, expect } from 'vitest';
import { evolvePetDef, HOP_RANGE } from './evolution';
import type { PetDef, PetInstance } from '../data/types';

function def(over: Partial<PetDef>): PetDef {
  return {
    id: 'd', name: 'D', gen: 1, dexNo: 1, types: ['leaf'], element: 'leaf',
    statBands: {} as PetDef['statBands'], enabled: true, ...over,
  };
}

function pet(over: Partial<PetInstance>): PetInstance {
  return {
    id: 'p', defId: 'base', species: 'leaf', hatched: true, xp: 0, happiness: 0,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
    growth: { hp: 10, atk: 10, def: 10, spd: 10, luk: 10 },
    rarity: 'common', name: '', ...over,
  };
}

const DEFS: PetDef[] = [
  def({ id: 'base', element: 'leaf', evolvesToId: 'mid' }),
  def({ id: 'mid', element: 'fire', evolvesToId: 'final', evolvesFromId: 'base' }),
  def({ id: 'final', element: 'water', evolvesFromId: 'mid' }),
];

describe('evolvePetDef', () => {
  it('no-op when the active def has no evolvesToId', () => {
    const p = pet({ defId: 'final' });
    expect(evolvePetDef(p, DEFS, 'adult', () => 0)).toBe(p);
  });

  it('no-op for a non-evolving stage (no HOP_RANGE entry)', () => {
    const p = pet({ defId: 'base' });
    expect(evolvePetDef(p, DEFS, 'baby', () => 0)).toBe(p);
  });

  it('swaps defId and species to the next def', () => {
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    expect(out.defId).toBe('mid');
    expect(out.species).toBe('fire');
  });

  it('re-bases stats: effective = round(total*factor), growth preserved', () => {
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    expect(out.stats).toEqual({ hp: 31, atk: 31, def: 31, spd: 31, luk: 31 });
    expect(out.growth).toEqual({ hp: 10, atk: 10, def: 10, spd: 10, luk: 10 });
  });

  it('adult hop uses the [0.05,0.10] range', () => {
    const out = evolvePetDef(pet({ defId: 'mid', species: 'fire' }), DEFS, 'adult', () => 0);
    expect(out.defId).toBe('final');
    expect(out.species).toBe('water');
    expect(out.stats.hp).toBe(32);
  });

  it('never downgrades a stat (factor >= 1)', () => {
    const out = evolvePetDef(pet({ defId: 'base' }), DEFS, 'young', () => 0);
    const before = pet({ defId: 'base' });
    for (const k of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
      expect(out.stats[k] + out.growth[k]).toBeGreaterThanOrEqual(before.stats[k] + before.growth[k]);
    }
  });

  it('exposes both evolving-stage ranges', () => {
    expect(HOP_RANGE.young).toEqual([0.03, 0.10]);
    expect(HOP_RANGE.adult).toEqual([0.05, 0.10]);
    expect(HOP_RANGE.baby).toBeUndefined();
    expect(HOP_RANGE.egg).toBeUndefined();
  });
});
