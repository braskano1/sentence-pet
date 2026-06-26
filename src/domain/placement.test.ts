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

import { currentSlotIndex, tapPlace } from './placement';

describe('currentSlotIndex', () => {
  it('returns the leftmost empty slot', () => {
    expect(currentSlotIndex([null, null])).toBe(0);
    expect(currentSlotIndex(['She', null, null])).toBe(1);
  });
  it('returns -1 when full', () => {
    expect(currentSlotIndex(['She', 'feeds'])).toBe(-1);
  });
});

describe('tapPlace', () => {
  const tiles = ['She', 'feeds', 'the cat'];
  it('places a tile into the current (leftmost empty) slot', () => {
    const state = { placed: ['She', null, null] as (string | null)[], used: [true, false, false] };
    const next = tapPlace(state, tiles, 1);
    expect(next.placed).toEqual(['She', 'feeds', null]);
    expect(next.used).toEqual([true, true, false]);
  });
  it('is a no-op (same ref) when the sentence is full', () => {
    const state = { placed: ['She', 'feeds', 'the cat'] as (string | null)[], used: [true, true, true] };
    expect(tapPlace(state, tiles, 0)).toBe(state);
  });
  it('is a no-op when the tile is already used', () => {
    const state = { placed: [null, null, null] as (string | null)[], used: [true, false, false] };
    expect(tapPlace(state, tiles, 0)).toBe(state);
  });
});
