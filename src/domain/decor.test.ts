import { describe, expect, it } from 'vitest';
import { buyDecor, buyOwnable, isOwned } from './decor';
import type { DecorItem } from './shop';

const fireRoom: DecorItem = { id: 'decor:fire-room', name: 'Fire Room', kind: 'decor', price: 150, sprite: 'fire.webp' };
const beach: DecorItem = { id: 'decor:beach', name: 'Beach', kind: 'decor', price: 50, sprite: 'beach.webp' };

describe('isOwned', () => {
  it('true when id present', () => expect(isOwned(['decor:beach'], 'decor:beach')).toBe(true));
  it('false when id absent', () => expect(isOwned(['decor:beach'], 'decor:fire-room')).toBe(false));
  it('false for empty set', () => expect(isOwned([], 'decor:beach')).toBe(false));
});

describe('buyDecor', () => {
  it('succeeds: decrements coins, appends id to owned', () => {
    expect(buyDecor({ coins: 200, owned: [] }, fireRoom)).toEqual({
      ok: true, coins: 50, owned: ['decor:fire-room'],
    });
  });

  it('preserves existing owned ids on success', () => {
    expect(buyDecor({ coins: 60, owned: ['decor:fire-room'] }, beach)).toEqual({
      ok: true, coins: 10, owned: ['decor:fire-room', 'decor:beach'],
    });
  });

  it('rejects already-owned, even if affordable', () => {
    expect(buyDecor({ coins: 999, owned: ['decor:beach'] }, beach)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('rejects when unaffordable', () => {
    expect(buyDecor({ coins: 10, owned: [] }, beach)).toEqual({
      ok: false, reason: 'insufficient-coins',
    });
  });

  it('checks already-owned BEFORE insufficient-coins', () => {
    expect(buyDecor({ coins: 0, owned: ['decor:beach'] }, beach)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('does not mutate input state', () => {
    const state = { coins: 200, owned: ['decor:fire-room'] };
    buyDecor(state, beach);
    expect(state).toEqual({ coins: 200, owned: ['decor:fire-room'] });
  });
});

describe('buyOwnable', () => {
  const item = { id: 'x:thing', price: 150 };

  it('succeeds: decrements coins, appends id to owned', () => {
    expect(buyOwnable({ coins: 200, owned: [] }, item)).toEqual({
      ok: true, coins: 50, owned: ['x:thing'],
    });
  });

  it('preserves existing owned ids on success', () => {
    expect(buyOwnable({ coins: 200, owned: ['x:a'] }, item)).toEqual({
      ok: true, coins: 50, owned: ['x:a', 'x:thing'],
    });
  });

  it('rejects already-owned, even if affordable', () => {
    expect(buyOwnable({ coins: 999, owned: ['x:thing'] }, item)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('rejects when unaffordable', () => {
    expect(buyOwnable({ coins: 10, owned: [] }, item)).toEqual({
      ok: false, reason: 'insufficient-coins',
    });
  });

  it('checks already-owned BEFORE insufficient-coins', () => {
    expect(buyOwnable({ coins: 0, owned: ['x:thing'] }, item)).toEqual({
      ok: false, reason: 'already-owned',
    });
  });

  it('does not mutate input state', () => {
    const state = { coins: 200, owned: ['x:a'] };
    buyOwnable(state, item);
    expect(state).toEqual({ coins: 200, owned: ['x:a'] });
  });
});
