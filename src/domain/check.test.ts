import { describe, it, expect } from 'vitest';
import { isPlacementCorrect, shuffle } from './check';
import { gradePlacement } from './grade';

describe('isPlacementCorrect', () => {
  it('true when placed words equal answer in order', () => {
    expect(isPlacementCorrect(['I', 'run'], ['I', 'run'])).toBe(true);
  });
  it('false when order is wrong', () => {
    expect(isPlacementCorrect(['run', 'I'], ['I', 'run'])).toBe(false);
  });
  it('false when a slot is empty (null)', () => {
    expect(isPlacementCorrect(['I', null], ['I', 'run'])).toBe(false);
  });
  it('false when lengths differ', () => {
    expect(isPlacementCorrect(['I'], ['I', 'run'])).toBe(false);
  });
});

describe('shuffle', () => {
  it('returns same multiset of items', () => {
    const input = ['a', 'b', 'c', 'd'];
    const out = shuffle(input);
    expect([...out].sort()).toEqual([...input].sort());
  });
  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    shuffle(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});

describe('isPlacementCorrect equals grader ideal for trap-less items', () => {
  const cases: (string | null)[][] = [
    ['I', 'run'],
    ['run', 'I'],
    ['I', null],
    ['I'],
  ];
  for (const placed of cases) {
    it(`agrees on ${JSON.stringify(placed)}`, () => {
      const legacy = isPlacementCorrect(placed, ['I', 'run']);
      const graded = gradePlacement(placed, { answer: ['I', 'run'] }).status === 'ideal';
      expect(graded).toBe(legacy);
    });
  }
});
