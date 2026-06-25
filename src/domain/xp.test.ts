import { describe, it, expect } from 'vitest';
import { xpPerCorrect, stageForXp, xpToNext, totalXpForLevel, levelForXp, xpProgress } from './xp';

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

describe('level curve', () => {
  it('xpToNext ramps and is Infinity at max', () => {
    expect(xpToNext(1)).toBe(40);          // round(40 * 1^1.5)
    expect(xpToNext(4)).toBe(320);         // round(40 * 4^1.5) = 320
    expect(xpToNext(50)).toBe(Infinity);   // no level beyond 50
  });
  it('totalXpForLevel(1) is 0 and accumulates', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(40);
    expect(totalXpForLevel(3)).toBe(40 + xpToNext(2));
  });
  it('levelForXp inverts the curve and caps at 50', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(39)).toBe(1);
    expect(levelForXp(40)).toBe(2);
    expect(levelForXp(10_000_000)).toBe(50);
  });
  it('xpProgress reports within-level position', () => {
    const p = xpProgress(40); // exactly level 2 start
    expect(p.level).toBe(2);
    expect(p.into).toBe(0);
    expect(p.span).toBe(xpToNext(2));
    expect(p.atMax).toBe(false);
    const max = xpProgress(10_000_000);
    expect(max.level).toBe(50);
    expect(max.atMax).toBe(true);
  });
});
