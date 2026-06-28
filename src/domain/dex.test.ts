import { describe, it, expect } from 'vitest';
import { addCaught, evolutionChain } from './dex';
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
