import { describe, it, expect } from 'vitest';
import { addCaught, evolutionChain, stageForChainPosition, latestUnlockedInChain, dexLines, chainCaughtCount, linesByGen } from './dex';
import type { PetDef } from '../data/types';

/** Minimal PetDef factory for chain tests. */
function def(id: string, over: Partial<PetDef> = {}): PetDef {
  return {
    id,
    name: id,
    gen: 1,
    dexNo: 1,
    types: ['leaf'],
    element: 'leaf',
    statBands: {} as PetDef['statBands'],
    enabled: true,
    ...over,
  };
}

describe('addCaught', () => {
  it('adds a new defId', () => {
    expect(addCaught(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('is a no-op for a defId already present', () => {
    expect(addCaught(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
  it('adds to an empty set', () => {
    expect(addCaught([], 'a')).toEqual(['a']);
  });
});

describe('evolutionChain', () => {
  it('returns a lone def when it has no links', () => {
    const a = def('a');
    expect(evolutionChain(a, [a]).map((d) => d.id)).toEqual(['a']);
  });

  it('walks a linear 3-stage chain from the root', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(evolutionChain(a, [a, b, c]).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('assembles the full chain when starting from the middle', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(evolutionChain(b, [a, b, c]).map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not infinite-loop on a cyclic chain (defensive)', () => {
    const a = def('a', { evolvesToId: 'b', evolvesFromId: 'b' });
    const b = def('b', { evolvesToId: 'a', evolvesFromId: 'a' });
    const chain = evolutionChain(a, [a, b]);
    expect(chain.length).toBeLessThanOrEqual(2);
  });

  it('stops at a dangling forward ref', () => {
    const a = def('a', { evolvesToId: 'missing' });
    expect(evolutionChain(a, [a]).map((d) => d.id)).toEqual(['a']);
  });
});

describe('stageForChainPosition', () => {
  it('maps a lone creature to its mature adult form', () => {
    expect(stageForChainPosition(0, 1)).toBe('adult');
  });
  it('maps a 2-stage line to baby then adult', () => {
    expect(stageForChainPosition(0, 2)).toBe('baby');
    expect(stageForChainPosition(1, 2)).toBe('adult');
  });
  it('maps a 3-stage line to baby, young, adult', () => {
    expect(stageForChainPosition(0, 3)).toBe('baby');
    expect(stageForChainPosition(1, 3)).toBe('young');
    expect(stageForChainPosition(2, 3)).toBe('adult');
  });
  it('clamps interior stages of a long chain to young and the tip to adult', () => {
    expect(stageForChainPosition(1, 4)).toBe('young');
    expect(stageForChainPosition(2, 4)).toBe('young');
    expect(stageForChainPosition(3, 4)).toBe('adult');
  });
});

describe('latestUnlockedInChain', () => {
  const a = def('a', { evolvesToId: 'b' });
  const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
  const c = def('c', { evolvesFromId: 'b' });
  const chain = [a, b, c];

  it('returns null when nothing is unlocked', () => {
    expect(latestUnlockedInChain(chain, new Set())).toBeNull();
  });
  it('returns the highest-index unlocked node', () => {
    const r = latestUnlockedInChain(chain, new Set(['a', 'b']));
    expect(r).not.toBeNull();
    expect(r!.def.id).toBe('b');
    expect(r!.index).toBe(1);
  });
  it('returns the tip when the whole chain is unlocked', () => {
    const r = latestUnlockedInChain(chain, new Set(['a', 'b', 'c']));
    expect(r!.def.id).toBe('c');
    expect(r!.index).toBe(2);
  });
  it('handles an unlock that skips earlier stages', () => {
    const r = latestUnlockedInChain(chain, new Set(['c']));
    expect(r!.def.id).toBe('c');
    expect(r!.index).toBe(2);
  });
});

describe('dexLines', () => {
  it('collapses a 3-stage chain into a single line', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    const lines = dexLines([a, b, c]);
    expect(lines.length).toBe(1);
    expect(lines[0].map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns one line per lone def', () => {
    const a = def('a', { dexNo: 1 });
    const b = def('b', { dexNo: 2 });
    expect(dexLines([a, b]).length).toBe(2);
  });

  it('dedupes a line regardless of which stage appears first in the input', () => {
    const a = def('a', { dexNo: 1, evolvesToId: 'b' });
    const b = def('b', { dexNo: 2, evolvesFromId: 'a' });
    // mid-stage listed first
    const lines = dexLines([b, a]);
    expect(lines.length).toBe(1);
    expect(lines[0].map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('sorts lines by the root gen then dexNo', () => {
    const g2 = def('g2', { gen: 2, dexNo: 1 });
    const g1b = def('g1b', { gen: 1, dexNo: 2 });
    const g1a = def('g1a', { gen: 1, dexNo: 1 });
    const lines = dexLines([g2, g1b, g1a]);
    expect(lines.map((l) => l[0].id)).toEqual(['g1a', 'g1b', 'g2']);
  });
});

describe('chainCaughtCount', () => {
  it('reports total 1 for a single-stage line', () => {
    const a = def('a');
    expect(chainCaughtCount([a], new Set())).toEqual({ caught: 0, total: 1 });
  });

  it('reports 0 caught when none are in the set', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(chainCaughtCount([a, b, c], new Set())).toEqual({ caught: 0, total: 3 });
  });

  it('counts only caught stages', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(chainCaughtCount([a, b, c], new Set(['a', 'b']))).toEqual({ caught: 2, total: 3 });
  });

  it('reports a fully-caught 3-stage line', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b' });
    expect(chainCaughtCount([a, b, c], new Set(['a', 'b', 'c']))).toEqual({ caught: 3, total: 3 });
  });

  it('excludes a disabled stage from both numerator and denominator', () => {
    const a = def('a', { evolvesToId: 'b' });
    const b = def('b', { evolvesFromId: 'a', evolvesToId: 'c' });
    const c = def('c', { evolvesFromId: 'b', enabled: false });
    // c is caught but disabled -> ignored; a caught, b not.
    expect(chainCaughtCount([a, b, c], new Set(['a', 'c']))).toEqual({ caught: 1, total: 2 });
  });
});

describe('linesByGen', () => {
  it('returns [] for empty input', () => {
    expect(linesByGen([])).toEqual([]);
  });

  it('buckets a single gen into one bucket', () => {
    const a = def('a', { gen: 1, dexNo: 1 });
    const b = def('b', { gen: 1, dexNo: 2 });
    const result = linesByGen([[a], [b]]);
    expect(result.length).toBe(1);
    expect(result[0].gen).toBe(1);
    expect(result[0].lines.map((l) => l[0].id)).toEqual(['a', 'b']);
  });

  it('buckets multiple gens ordered by ascending gen', () => {
    const g1 = def('g1', { gen: 1, dexNo: 1 });
    const g2 = def('g2', { gen: 2, dexNo: 1 });
    const g3 = def('g3', { gen: 3, dexNo: 1 });
    // hand it out-of-gen-order buckets to prove it orders by gen
    const result = linesByGen([[g2], [g3], [g1]]);
    expect(result.map((b) => b.gen)).toEqual([1, 2, 3]);
  });

  it('preserves incoming line order within a bucket', () => {
    const first = def('first', { gen: 2, dexNo: 5 });
    const second = def('second', { gen: 2, dexNo: 9 });
    const result = linesByGen([[first], [second]]);
    expect(result.length).toBe(1);
    expect(result[0].lines.map((l) => l[0].id)).toEqual(['first', 'second']);
  });
});
