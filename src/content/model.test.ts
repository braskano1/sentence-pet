import { describe, it, expect } from 'vitest';
import type { ContentBundle } from './model';
import { orderedUnits, findLesson, itemsForLesson, itemsForDrill, tutorialItem, trayWords } from './model';
import type { DrillItem } from '../data/types';

const item = (id: string, drill: DrillItem['drill'], level: number): DrillItem => ({
  id, drill, level, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'],
});

const bundle: ContentBundle = {
  pool: {
    'a': item('a', 'pattern', 1),
    'b': item('b', 'pattern', 1),
    'c': item('c', 'grammar', 1),
  },
  units: [
    { id: 'u2', title: 'Two', emoji: '🌱', order: 2, lessons: [
      { id: 'u2-l1', drill: 'pattern', level: 1, itemIds: ['a'] },
      { id: 'u2-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]},
    { id: 'u1', title: 'One', emoji: '🐣', order: 1, lessons: [
      { id: 'u1-l1', drill: 'pattern', level: 1, itemIds: ['a', 'b'] },
      { id: 'u1-cp', drill: 'mixed', level: 1, itemIds: ['b'], isCheckpoint: true },
    ]},
  ],
};

describe('content/model accessors', () => {
  it('orderedUnits sorts by order ascending', () => {
    expect(orderedUnits(bundle).map((u) => u.id)).toEqual(['u1', 'u2']);
  });

  it('findLesson resolves a lesson id to its unit + lesson', () => {
    const found = findLesson(bundle, 'u2-l1');
    expect(found?.unit.id).toBe('u2');
    expect(found?.lesson.id).toBe('u2-l1');
    expect(findLesson(bundle, 'nope')).toBeUndefined();
  });

  it('itemsForLesson resolves itemIds in order, skipping unknown ids', () => {
    const lesson = findLesson(bundle, 'u1-l1')!.lesson;
    expect(itemsForLesson(bundle, lesson).map((i) => i.id)).toEqual(['a', 'b']);
    expect(itemsForLesson(bundle, { id: 'x', drill: 'pattern', level: 1, itemIds: ['a', 'ghost'] }))
      .toHaveLength(1);
  });

  it('itemsForDrill filters the pool by drill + level', () => {
    expect(itemsForDrill(bundle, 'pattern', 1).map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(itemsForDrill(bundle, 'grammar', 1).map((i) => i.id)).toEqual(['c']);
    expect(itemsForDrill(bundle, 'pattern', 9)).toEqual([]);
  });

  it('tutorialItem returns the first pattern level-1 item', () => {
    expect(tutorialItem(bundle)?.drill).toBe('pattern');
    expect(tutorialItem(bundle)?.level).toBe(1);
  });
});

describe('trayWords', () => {
  const answerOnly: DrillItem = {
    id: 'x', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun', 'Verb'], answer: ['I', 'run'],
  };
  const withDistractors: DrillItem = {
    id: 'y', drill: 'wordChoice', level: 1, thaiHint: 'y', slots: ['Pronoun', 'Verb'],
    answer: ['he', 'eats'], distractors: ['eat', 'eating'],
  };
  const withTraps: DrillItem = {
    id: 'z', drill: 'grammar', level: 1, strictness: 'flag', thaiHint: 'z',
    slots: ['Pronoun', 'Verb'], answer: ['she', 'walks'],
    distractors: ['running'],
    traps: [{ slot: 1, word: 'walk', tip: 'tip' }],
  };

  it('answer-only item returns just the answer', () => {
    expect(trayWords(answerOnly)).toEqual(['I', 'run']);
  });

  it('item with distractors returns answer then distractors', () => {
    expect(trayWords(withDistractors)).toEqual(['he', 'eats', 'eat', 'eating']);
  });

  it('item with traps returns answer then distractors then trap words', () => {
    expect(trayWords(withTraps)).toEqual(['she', 'walks', 'running', 'walk']);
  });
});
