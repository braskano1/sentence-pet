import { describe, it, expect } from 'vitest';
import type { ContentBundle } from './model';
import { validateContent, validateCourse } from './validate';
import type { DrillItem, ContentItem } from '../data/types';
import { isDragDrop } from '../data/types';
import type { Course, BossNode } from './course';
import type { CheckpointBoss } from './model';

const item = (id: string): DrillItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'] });

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
    const b = good();
    const a = b.pool.a;
    if (isDragDrop(a)) b.pool.a = { ...a, answer: ['I'] };
    expect(validateContent(b).ok).toBe(false);
  });

  it('rejects a trap slot index out of range', () => {
    const b = good();
    const a = b.pool.a;
    if (isDragDrop(a)) b.pool.a = { ...a, traps: [{ slot: 5, word: 'runs', tip: 't' }] };
    expect(validateContent(b).ok).toBe(false);
  });
});

describe('kind-aware validateItem', () => {
  function bundleWith(item: ContentItem): ContentBundle {
    return {
      pool: { [item.id]: item },
      units: [{ id: 'u1', title: 'U', emoji: '📘', order: 0, lessons: [
        { id: 'l1', kind: item.kind, drill: 'pattern', level: 1, itemIds: [item.id], isCheckpoint: true },
      ] }],
    };
  }
  it('rejects flashcard missing back', () => {
    const r = validateContent(bundleWith({ id: 'f1', kind: 'flashcard', level: 1, front: 'cat', back: '' }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('f1'))).toBe(true);
  });
  it('rejects matching with <2 pairs', () => {
    const r = validateContent(bundleWith({ id: 'm1', kind: 'matching', level: 1, pairs: [{ left: 'a', right: 'b' }] }));
    expect(r.ok).toBe(false);
  });
  it('rejects fillblank without exactly one ___', () => {
    const r = validateContent(bundleWith({ id: 'b1', kind: 'fillblank', level: 1, template: 'no blank', answer: 'x' }));
    expect(r.ok).toBe(false);
  });
  it('accepts a valid fillblank', () => {
    const r = validateContent(bundleWith({ id: 'b2', kind: 'fillblank', level: 1, template: 'I ___ rice', answer: 'eat' }));
    expect(r.ok).toBe(true);
  });
  it('rejects empty l1.th when present', () => {
    const r = validateContent(bundleWith({ id: 'f2', kind: 'flashcard', level: 1, front: 'a', back: 'b', l1: { th: '' } }));
    expect(r.ok).toBe(false);
  });
});

const sampleBoss: CheckpointBoss = {
  tierId: 't', element: 'leaf', name: 'B', rivalSprite: { species: 'leaf', stage: 'baby' },
};

const base: Course = {
  id: 'c', title: 'C',
  pool: { a: { id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] } },
  units: [{
    id: 'u', title: 'U', emoji: '🦊', order: 0, l1Enabled: false,
    lessons: [{ id: 'l', kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: ['a'], isCheckpoint: true }],
  }],
  gates: [],
  finalBoss: { id: 'fb', title: 'F', scope: 'final', reviewsUnitIds: ['u'], reviewCount: 3, boss: sampleBoss, onClear: 'completeCourse' },
};

describe('validateCourse', () => {
  it('accepts a valid dragdrop course', () => {
    expect(validateCourse(base).ok).toBe(true);
  });
  it('rejects a dragdrop item whose answer/slots length mismatch', () => {
    const a = base.pool.a;
    if (!isDragDrop(a)) throw new Error('fixture must be dragdrop');
    const bad: Course = { ...base, pool: { a: { ...a, answer: ['I', 'run'] } } };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/answer\/slots/);
  });
  it('rejects a gate whose reviewsUnitIds reference an unknown unit', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', reviewsUnitIds: ['nope'], boss: sampleBoss }],
    };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/unknown unit/);
  });
  it('rejects a final boss that pins an unknown item', () => {
    const bad: Course = {
      ...base,
      finalBoss: { id: 'fb', title: 'Final', scope: 'final', pinnedItemIds: ['ghost'], boss: sampleBoss, onClear: 'completeCourse' },
    };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/pins unknown item/);
  });

  // P3b: enforce finalBoss presence + reject duplicate gate afterUnitId
  it('rejects a course with no final boss', () => {
    const bad: Course = { ...base, finalBoss: undefined };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/final boss/i);
  });

  it('rejects two gates sharing the same afterUnitId', () => {
    const g = (id: string): BossNode =>
      ({ id, title: id, scope: 'gated', afterUnitId: 'u', reviewsUnitIds: ['u'], boss: sampleBoss });
    const bad: Course = { ...base, gates: [g('g1'), g('g2')] };
    expect(validateCourse(bad).errors.join()).toMatch(/duplicate afterUnitId/i);
  });
  it('rejects a gated boss with no afterUnitId', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', reviewsUnitIds: ['u'], boss: sampleBoss }],
    };
    const res = validateCourse(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/afterUnitId/);
  });
  it('rejects a gated boss whose afterUnitId is unknown', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'nope', reviewsUnitIds: ['u'], boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/afterUnitId/);
  });
  it('rejects a gated/final boss with empty reviewsUnitIds', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u', reviewsUnitIds: [], boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/reviews no units/);
  });
  it('rejects a reviewCount below 1', () => {
    const bad: Course = {
      ...base,
      gates: [{ id: 'g', title: 'G', scope: 'gated', afterUnitId: 'u', reviewsUnitIds: ['u'], reviewCount: 0, boss: sampleBoss }],
    };
    expect(validateCourse(bad).errors.join()).toMatch(/reviewCount/);
  });
  it('rejects a final boss missing onClear=completeCourse', () => {
    const bad: Course = {
      ...base,
      finalBoss: { id: 'fb', title: 'F', scope: 'final', reviewsUnitIds: ['u'], boss: sampleBoss },
    };
    expect(validateCourse(bad).errors.join()).toMatch(/onClear/);
  });
});
