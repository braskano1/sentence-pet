import { describe, it, expect } from 'vitest';
import { gradePlacement } from './grade';
import type { DrillItem } from '../data/types';

// minimal grammar item: 'he eats', with an agreement trap 'eat' on the verb slot
const flagItem: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
  answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
  strictness: 'flag',
};
const enforceItem = { ...flagItem, strictness: 'enforce' as const };
const patternItem: Pick<DrillItem, 'answer'> = { answer: ['I', 'run'] };

describe('gradePlacement', () => {
  it('exact answer -> ideal, passes, no flags', () => {
    expect(gradePlacement(['he', 'eats'], flagItem)).toEqual({
      status: 'ideal', passes: true, flags: [],
    });
  });

  it('near-miss in flag mode -> flagged, passes, carries the tip', () => {
    expect(gradePlacement(['he', 'eat'], flagItem)).toEqual({
      status: 'flagged', passes: true, flags: ['เขา → he eats 👍'],
    });
  });

  it('near-miss in enforce mode -> flagged, does NOT pass', () => {
    expect(gradePlacement(['he', 'eat'], enforceItem)).toEqual({
      status: 'flagged', passes: false, flags: ['เขา → he eats 👍'],
    });
  });

  it('an unregistered wrong word -> wrong, does not pass', () => {
    expect(gradePlacement(['he', 'table'], flagItem)).toEqual({
      status: 'wrong', passes: false, flags: [],
    });
  });

  it('a null (unfilled) slot -> wrong, does not pass', () => {
    expect(gradePlacement(['he', null], flagItem)).toEqual({
      status: 'wrong', passes: false, flags: [],
    });
  });

  it('wrong takes precedence over a flagged slot', () => {
    const item = {
      answer: ['he', 'eats'],
      traps: [{ slot: 1, word: 'eat', tip: 't' }],
      strictness: 'flag' as const,
    };
    // slot 0 wrong ('she'), slot 1 flagged ('eat') -> overall wrong
    expect(gradePlacement(['she', 'eat'], item).status).toBe('wrong');
    expect(gradePlacement(['she', 'eat'], item).passes).toBe(false);
  });

  it('trap-less item (Pattern/WC) -> only ideal or wrong', () => {
    expect(gradePlacement(['I', 'run'], patternItem).status).toBe('ideal');
    expect(gradePlacement(['run', 'I'], patternItem).status).toBe('wrong');
  });

  it('placed longer than answer -> wrong (no silent ideal)', () => {
    const g = gradePlacement(['he', 'eats', 'extra'], flagItem);
    expect(g).toEqual({ status: 'wrong', passes: false, flags: [] });
  });

  it('placed shorter than answer -> wrong', () => {
    const g = gradePlacement(['he'], flagItem);
    expect(g).toEqual({ status: 'wrong', passes: false, flags: [] });
  });

  it('Mixed item (enforce, S+V+O): exact passes, trap flagged-no-pass, distractor wrong', () => {
    const mixedItem: Pick<DrillItem, 'answer' | 'traps' | 'strictness'> = {
      answer: ['I', 'eat', 'rice'],
      traps: [{ slot: 1, word: 'eats', tip: 'ฉัน → I eat 👍' }],
      strictness: 'enforce',
    };
    // exact -> ideal, passes
    expect(gradePlacement(['I', 'eat', 'rice'], mixedItem)).toEqual({
      status: 'ideal', passes: true, flags: [],
    });
    // agreement trap in its slot -> flagged but enforce blocks the pass
    expect(gradePlacement(['I', 'eats', 'rice'], mixedItem)).toEqual({
      status: 'flagged', passes: false, flags: ['ฉัน → I eat 👍'],
    });
    // distractor placed in the object slot -> wrong
    expect(gradePlacement(['I', 'eat', 'bread'], mixedItem).status).toBe('wrong');
  });
});
