import { describe, it, expect } from 'vitest';
import { DRILL_FOOD, FOOD_META, FOOD_GROUPS, KIND_FOOD } from './food';

describe('food mapping', () => {
  it('maps each drill to its food group', () => {
    expect(DRILL_FOOD.pattern).toBe('protein');
    expect(DRILL_FOOD.wordChoice).toBe('veggie');
    expect(DRILL_FOOD.grammar).toBe('vitamin');
    expect(DRILL_FOOD.mixed).toBe('treat');
  });

  it('has meta for all four food groups', () => {
    expect(FOOD_GROUPS).toEqual(['protein', 'veggie', 'vitamin', 'treat']);
    for (const g of FOOD_GROUPS) {
      expect(FOOD_META[g].emoji).toBeTruthy();
      expect(FOOD_META[g].label).toBeTruthy();
      expect(FOOD_META[g].color).toMatch(/^bg-/);
    }
  });
});

describe('KIND_FOOD', () => {
  it('maps every player content kind to a known food group', () => {
    for (const kind of ['flashcard', 'matching', 'dragdrop', 'fillblank'] as const) {
      expect(FOOD_META[KIND_FOOD[kind]]).toBeDefined();
    }
  });
});
