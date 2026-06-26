import { describe, it, expect } from 'vitest';
import type { ContentBundle } from './model';
import { validateContent } from './validate';
import type { DrillItem } from '../data/types';

const item = (id: string): DrillItem =>
  ({ id, drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

function good(): ContentBundle {
  return {
    pool: { a: item('a'), b: item('b') },
    units: [
      { id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      ]},
    ],
  };
}

describe('validateContent', () => {
  it('accepts a well-formed bundle', () => {
    expect(validateContent(good())).toEqual({ ok: true, errors: [] });
  });

  it('rejects a unit with no lessons', () => {
    const b = good(); b.units[0].lessons = [];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a unit whose checkpoint is not last', () => {
    const b = good();
    b.units[0].lessons = [
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
    ];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a unit with zero or multiple checkpoints', () => {
    const b = good(); b.units[0].lessons[1].isCheckpoint = false;
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects duplicate lesson ids across the journey', () => {
    const b = good();
    b.units.push({ id: 'u2', title: 'Two', emoji: '🌱', order: 2, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]});
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an empty itemIds list', () => {
    const b = good(); b.units[0].lessons[0].itemIds = [];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an itemId that does not resolve in the pool', () => {
    const b = good(); b.units[0].lessons[0].itemIds = ['ghost'];
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects an item whose answer length != slots length', () => {
    const b = good(); b.pool.a = { ...b.pool.a, answer: ['I'] };
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a trap slot index out of range', () => {
    const b = good();
    b.pool.a = { ...b.pool.a, traps: [{ slot: 5, word: 'runs', tip: 't' }] };
    expect(validateContent(b).ok).toBe(false);
  });
});
