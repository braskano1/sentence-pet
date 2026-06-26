import { describe, it, expect } from 'vitest';
import { xpPerCorrect, stageForXp, stageForLevel, STAGE_LEVEL, xpToNext, totalXpForLevel, levelForXp, xpProgress, STAGE_ORDER, STAGE_NAME, stageUp } from './xp';

describe('xpPerCorrect', () => {
  it('is 10 x level', () => {
    expect(xpPerCorrect(1)).toBe(10);
    expect(xpPerCorrect(5)).toBe(50);
  });
});

describe('stageForXp', () => {
  it('is baby from 0 until young threshold', () => {
    expect(stageForXp(0, true)).toBe('baby');
    expect(stageForXp(totalXpForLevel(16) - 1, true)).toBe('baby');
  });
  it('is young from young threshold until adult threshold', () => {
    expect(stageForXp(totalXpForLevel(16), true)).toBe('young');
    expect(stageForXp(totalXpForLevel(36) - 1, true)).toBe('young');
  });
  it('is adult from adult threshold onward', () => {
    expect(stageForXp(totalXpForLevel(36), true)).toBe('adult');
  });
  it('is egg while not hatched, regardless of xp', () => {
    expect(stageForXp(5000, false)).toBe('egg');
  });
});

describe('stage bands', () => {
  it('STAGE_LEVEL holds evolution thresholds', () => {
    expect(STAGE_LEVEL).toEqual({ baby: 1, young: 16, adult: 36 });
  });
  it('stageForLevel maps bands', () => {
    expect(stageForLevel(1)).toBe('baby');
    expect(stageForLevel(15)).toBe('baby');
    expect(stageForLevel(16)).toBe('young');
    expect(stageForLevel(35)).toBe('young');
    expect(stageForLevel(36)).toBe('adult');
    expect(stageForLevel(50)).toBe('adult');
  });
  it('stageForXp returns egg when not hatched, else composes', () => {
    expect(stageForXp(999999, false)).toBe('egg');
    expect(stageForXp(0, true)).toBe('baby');
    expect(stageForXp(totalXpForLevel(16), true)).toBe('young');
  });
});

describe('stage helpers', () => {
  it('orders stages egg < baby < young < adult', () => {
    expect(STAGE_ORDER).toEqual(['egg', 'baby', 'young', 'adult']);
  });
  it('stageUp is true only for forward transitions', () => {
    expect(stageUp('egg', 'baby')).toBe(true);
    expect(stageUp('baby', 'young')).toBe(true);
    expect(stageUp('young', 'adult')).toBe(true);
    expect(stageUp('baby', 'adult')).toBe(true);
    expect(stageUp('baby', 'baby')).toBe(false);
    expect(stageUp('young', 'baby')).toBe(false);
  });
  it('names every stage', () => {
    expect(STAGE_NAME).toEqual({ egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult' });
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
