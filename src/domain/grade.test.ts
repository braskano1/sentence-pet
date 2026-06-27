import { describe, it, expect } from 'vitest';
import { gradePlacement, slotResults } from './grade';
import type { DrillItem } from '../data/types';

// grammar item: 'he eats', with an agreement trap 'eat' on the verb slot
const grammarItem: Pick<DrillItem, 'answer' | 'traps'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};
const patternItem: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };

describe('gradePlacement', () => {
  it('exact answer -> ideal, passes', () => {
    expect(gradePlacement(['he', 'eats'], grammarItem)).toEqual({ status: 'ideal', passes: true });
  });

  it('a registered near-miss trap -> wrong, does NOT pass', () => {
    expect(gradePlacement(['he', 'eat'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('an unregistered wrong word -> wrong, does not pass', () => {
    expect(gradePlacement(['he', 'table'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('a null (unfilled) slot -> wrong, does not pass', () => {
    expect(gradePlacement(['he', null], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('trap-less item (Pattern/WC) -> only ideal or wrong', () => {
    expect(gradePlacement(['I', 'run'], patternItem).status).toBe('ideal');
    expect(gradePlacement(['run', 'I'], patternItem).status).toBe('wrong');
  });

  it('placed longer than answer -> wrong', () => {
    expect(gradePlacement(['he', 'eats', 'extra'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });

  it('placed shorter than answer -> wrong', () => {
    expect(gradePlacement(['he'], grammarItem)).toEqual({ status: 'wrong', passes: false });
  });
});

describe('slotResults', () => {
  const item = {
    answer: ['She', 'feeds', 'the cat'],
    traps: [{ slot: 1, word: 'feed', tip: 'feeds (he/she) takes -s' }],
  };
  it('marks exact matches ok and others wrong', () => {
    expect(slotResults(['She', 'eats', 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
  it('marks a near-miss trap slot wrong (no longer accepted)', () => {
    expect(slotResults(['She', 'feed', 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
  it('marks an unfilled slot wrong', () => {
    expect(slotResults(['She', null, 'the cat'], item)).toEqual(['ok', 'wrong', 'ok']);
  });
});
