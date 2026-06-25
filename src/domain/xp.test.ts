import { describe, it, expect } from 'vitest';
import { xpPerCorrect, stageForXp } from './xp';

describe('xpPerCorrect', () => {
  it('is 10 x level', () => {
    expect(xpPerCorrect(1)).toBe(10);
    expect(xpPerCorrect(5)).toBe(50);
  });
});

describe('stageForXp', () => {
  it('is baby from 0 up to <1000', () => {
    expect(stageForXp(0, true)).toBe('baby');
    expect(stageForXp(999, true)).toBe('baby');
  });
  it('is young from 1000 up to <3000', () => {
    expect(stageForXp(1000, true)).toBe('young');
    expect(stageForXp(2999, true)).toBe('young');
  });
  it('is adult at 3000+', () => {
    expect(stageForXp(3000, true)).toBe('adult');
  });
  it('is egg while not hatched, regardless of xp', () => {
    expect(stageForXp(5000, false)).toBe('egg');
  });
});
