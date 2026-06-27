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
  it('renders ComingSoon for a not-yet-built kind', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'flashcard');
    expect(key).toBe('comingSoon');
  });
  it('routes a boss-kind lesson back to the map, not ComingSoon', () => {
    const { key } = screenKeyAndNode('drill', true, 'pattern', 1, items, 'boss');
    expect(key).toBe('pickDrill');
  });
});
