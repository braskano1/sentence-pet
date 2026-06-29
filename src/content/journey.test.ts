// src/content/journey.test.ts
import { describe, it, expect } from 'vitest';
import type { Course } from './course';
import type { DragDropItem } from '../data/types';
import { resolveCourseBundle } from './journey';
import { orderedUnits, findLesson } from './model';

const dd = (id: string): DragDropItem =>
  ({ id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun'], answer: ['I'] });

function course(): Course {
  return {
    id: 'c', title: 'C',
    pool: { a: dd('a'), b: dd('b'), c: dd('c') },
    units: [
      { id: 'u1', title: 'U1', emoji: '🐣', order: 1, lessons: [
        { id: 'u1-l', drill: 'pattern', level: 1, itemIds: ['a'] },
        { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
      ] },
      { id: 'u2', title: 'U2', emoji: '🌱', order: 2, lessons: [
        { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['c'], isCheckpoint: true },
      ] },
    ],
    gates: [
      { id: 'gate-1', title: 'Review 1', scope: 'gated', afterUnitId: 'u1',
        reviewsUnitIds: ['u1'], reviewCount: 1,
        boss: { tierId: 't1', element: 'water', name: 'Gate', rivalSprite: { species: 'water', stage: 'young' } } },
    ],
    finalBoss: { id: 'final-1', title: 'Final', scope: 'final', onClear: 'completeCourse',
      reviewsUnitIds: ['u1', 'u2'], reviewCount: 2,
      boss: { tierId: 't3', element: 'leaf', name: 'Final', rivalSprite: { species: 'leaf', stage: 'adult' } } },
  };
}

const zero = () => 0;

describe('resolveCourseBundle', () => {
  it('keeps the original pool and real units', () => {
    const b = resolveCourseBundle(course(), zero);
    expect(b.pool).toEqual(course().pool);
    expect(b.units.some((u) => u.id === 'u1')).toBe(true);
    expect(b.units.some((u) => u.id === 'u2')).toBe(true);
  });

  it('splices a gated boss unit after its afterUnitId by order', () => {
    const ordered = orderedUnits(resolveCourseBundle(course(), zero));
    const ids = ordered.map((u) => u.id);
    expect(ids.indexOf('u1')).toBeLessThan(ids.indexOf('boss-unit:gate-1'));
    expect(ids.indexOf('boss-unit:gate-1')).toBeLessThan(ids.indexOf('u2'));
  });

  it('appends the final boss unit last', () => {
    const ordered = orderedUnits(resolveCourseBundle(course(), zero));
    expect(ordered[ordered.length - 1].id).toBe('boss-unit:final-1');
  });

  it('makes the gated boss a findable checkpoint lesson carrying its boss + sampled items', () => {
    const b = resolveCourseBundle(course(), zero);
    const found = findLesson(b, 'gate-1');
    expect(found?.lesson.isCheckpoint).toBe(true);
    expect(found?.lesson.boss?.name).toBe('Gate');
    expect(found?.lesson.itemIds).toHaveLength(1); // sampled 1 item from u1 dragdrop
    expect(['a', 'b']).toContain(found?.lesson.itemIds[0]);
    expect(found?.lesson.onClear).toBeUndefined();
  });

  it('tags the final boss lesson with onClear=completeCourse', () => {
    const b = resolveCourseBundle(course(), zero);
    const found = findLesson(b, 'final-1');
    expect(found?.lesson.onClear).toBe('completeCourse');
    expect(found?.lesson.itemIds).toHaveLength(2);
  });

  it('is a no-op (only real units) when there are no gates or final boss', () => {
    const c = course();
    c.gates = [];
    delete c.finalBoss;
    const b = resolveCourseBundle(c, zero);
    expect(b.units.map((u) => u.id).sort()).toEqual(['u1', 'u2']);
  });

  it('propagates rewardPetDefId from a boss node onto its synth lesson', () => {
    const c = course();
    c.finalBoss = { ...c.finalBoss!, rewardPetDefId: 'leaf-1' };
    const b = resolveCourseBundle(c, zero);
    const finalLesson = findLesson(b, 'final-1')?.lesson;
    const gateLesson = findLesson(b, 'gate-1')?.lesson;
    expect(finalLesson?.rewardPetDefId).toBe('leaf-1');
    expect(gateLesson?.rewardPetDefId).toBeUndefined();
  });
});
