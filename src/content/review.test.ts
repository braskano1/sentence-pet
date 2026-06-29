// src/content/review.test.ts
import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import type { BossNode } from './course';
import type { DragDropItem, FlashcardItem } from '../data/types';
import { sampleReviewItems } from './review';

const dd = (id: string): DragDropItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun'], answer: ['I'] });
const fc = (id: string): FlashcardItem =>
  ({ id, kind: 'flashcard', level: 1, front: 'a', back: 'b' });

function course(): Course {
  return {
    id: 'c', title: 'C',
    pool: { a: dd('a'), b: dd('b'), c: dd('c'), d: dd('d'), f: fc('f') },
    units: [
      { id: 'u1', title: 'U1', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l', drill: 'pattern', level: 1, itemIds: ['a', 'b', 'f'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['c'], isCheckpoint: true },
      ] },
      { id: 'u2', title: 'U2', emoji: '🌱', order: 2, lessons: [
        { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['d'], isCheckpoint: true },
      ] },
    ],
    gates: [],
  };
}

// Deterministic RNG: always 0 → shuffle keeps stable order.
const zero = () => 0;

describe('sampleReviewItems', () => {
  it('samples dragdrop ids from reviewsUnitIds, excluding non-dragdrop', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1'], reviewCount: 2,
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got).toHaveLength(2);
    expect(got).not.toContain('f'); // flashcard excluded
    got.forEach((id) => expect(['a', 'b', 'c']).toContain(id));
  });

  it('always includes pinned ids first, then fills the remainder', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1', 'u2'], reviewCount: 3, pinnedItemIds: ['d'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got[0]).toBe('d');             // pinned first
    expect(got).toHaveLength(3);
    expect(new Set(got).size).toBe(3);    // no duplicates (d not re-sampled)
  });

  it('returns all available when reviewCount is unset', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1', 'u2'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(new Set(got)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('drops pinned ids that are missing or non-dragdrop', () => {
    const node: BossNode = {
      id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u1',
      reviewsUnitIds: ['u1'], reviewCount: 1, pinnedItemIds: ['ghost', 'f'],
      boss: { tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' } },
    };
    const got = sampleReviewItems(course(), node, zero);
    expect(got).not.toContain('ghost');
    expect(got).not.toContain('f');
    expect(got).toHaveLength(1);
  });
});
