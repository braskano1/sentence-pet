// src/domain/round.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRound } from './round';

const answer = ['I', 'run'];

describe('resolveRound', () => {
  it('wrong placement -> retry', () => {
    const action = resolveRound({ filled: ['run', 'I'], answer, index: 0, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'retry' });
  });

  it('a distractor placed in a slot -> retry', () => {
    // answer is ['I','run']; 'runs' is a Word-Choice distractor
    const action = resolveRound({ filled: ['I', 'runs'], answer, index: 0, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'retry' });
  });

  it('correct but not last item -> advance to next index', () => {
    const action = resolveRound({ filled: ['I', 'run'], answer, index: 2, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'advance', nextIndex: 3 });
  });

  it('correct and last item with no mistakes -> finish with 3 stars', () => {
    const action = resolveRound({ filled: ['I', 'run'], answer, index: 4, total: 5, mistakes: 0 });
    expect(action).toEqual({ type: 'finish', stars: 3 });
  });

  it('correct and last item with mistakes -> finish with fewer stars', () => {
    const action = resolveRound({ filled: ['I', 'run'], answer, index: 4, total: 5, mistakes: 2 });
    expect(action.type).toBe('finish');
    if (action.type === 'finish') {
      expect(action.stars).toBeLessThan(3);
    }
  });
});
