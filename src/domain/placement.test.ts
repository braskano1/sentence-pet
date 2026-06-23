import { describe, expect, it } from 'vitest';
import { parseDndId, placeTile, type PlacementState } from './placement';

describe('parseDndId', () => {
  it('parses a tile id', () => {
    expect(parseDndId('tile-3')).toEqual({ kind: 'tile', index: 3 });
  });
  it('parses a slot id', () => {
    expect(parseDndId('slot-0')).toEqual({ kind: 'slot', index: 0 });
  });
  it('returns null for an unknown id', () => {
    expect(parseDndId('nope')).toBeNull();
  });
});

describe('placeTile', () => {
  const tiles = ['I', 'run'];
  const fresh = (): PlacementState => ({ placed: [null, null], used: [false, false] });

  it('places the dragged tile into the chosen slot and marks it used', () => {
    const next = placeTile(fresh(), tiles, 1, 0); // tile "run" -> slot 0
    expect(next.placed).toEqual(['run', null]);
    expect(next.used).toEqual([false, true]);
  });

  it('ignores a drop onto an already-filled slot (returns same state)', () => {
    const state: PlacementState = { placed: ['I', null], used: [true, false] };
    const next = placeTile(state, tiles, 1, 0); // slot 0 occupied
    expect(next).toBe(state);
  });

  it('ignores a tile that is already used (returns same state)', () => {
    const state: PlacementState = { placed: ['I', null], used: [true, false] };
    const next = placeTile(state, tiles, 0, 1); // tile 0 already used
    expect(next).toBe(state);
  });

  it('handles duplicate words by tile index', () => {
    const dupTiles = ['the', 'the', 'cat'];
    const state: PlacementState = { placed: [null, null, null], used: [false, false, false] };
    const next = placeTile(state, dupTiles, 1, 2); // second "the" -> slot 2
    expect(next.placed).toEqual([null, null, 'the']);
    expect(next.used).toEqual([false, true, false]);
  });
});
