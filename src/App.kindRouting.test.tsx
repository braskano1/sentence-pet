import { describe, it, expect } from 'vitest';
import { screenKeyAndNode } from './App';
import type { DrillItem } from './data/types';

const items: DrillItem[] = [{ id: 'a', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x', slots: ['Pronoun'], answer: ['I'] }];

describe('kind-routed lesson rendering', () => {
  it('routes pickCourse to the CourseSelect screen', () => {
    const { key } = screenKeyAndNode('pickCourse', true, 'pattern', 1, items, 'dragdrop');
    expect(key).toBe('pickCourse');
  });
  it('renders DrillScreen for a dragdrop lesson', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'dragdrop');
    expect(key).toBe('drill');
  });
  it('renders the FlashcardScreen for a flashcard lesson', () => {
    const flashItems = [
      { id: 'fc', kind: 'flashcard' as const, level: 1, front: 'cat', back: 'แมว' },
    ];
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, flashItems, 'flashcard');
    expect(key).toBe('flashcard');
  });
  it('renders the MatchingScreen for a matching lesson', () => {
    const matchItems = [
      { id: 'm', kind: 'matching' as const, level: 1, pairs: [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }] },
    ];
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, matchItems, 'matching');
    expect(key).toBe('matching');
  });
  it('renders the FillBlankScreen for a fillblank lesson', () => {
    const blankItems = [
      { id: 'fb', kind: 'fillblank' as const, level: 1, template: 'I ___ rice.', answer: 'eat' },
    ];
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, blankItems, 'fillblank');
    expect(key).toBe('fillblank');
  });
  it('routes a boss-kind lesson back to the map, not ComingSoon', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'boss');
    expect(key).toBe('pickDrill');
  });
});
