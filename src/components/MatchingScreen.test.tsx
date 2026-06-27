import { describe, it, expect } from 'vitest';
import { gradeMatching } from './MatchingScreen';

describe('gradeMatching', () => {
  const pairs = [{ left: 'cat', right: 'แมว' }, { left: 'dog', right: 'หมา' }];
  it('all correct → done', () => {
    expect(gradeMatching(pairs, { cat: 'แมว', dog: 'หมา' })).toEqual({ done: true, wrong: [] });
  });
  it('reports wrong prompts, keeps correct', () => {
    expect(gradeMatching(pairs, { cat: 'หมา', dog: 'หมา' })).toEqual({ done: false, wrong: ['cat'] });
  });
  it('not done when unassigned', () => {
    expect(gradeMatching(pairs, { cat: 'แมว' })).toEqual({ done: false, wrong: [] });
  });
});
