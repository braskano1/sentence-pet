import { describe, it, expect } from 'vitest';
import { phaseThresholds, phaseScale, phaseFromHp } from './bossTiers';

describe('phaseThresholds', () => {
  it('1 phase has no thresholds', () => {
    expect(phaseThresholds(1)).toEqual([]);
  });
  it('2 phases cross at 50%', () => {
    expect(phaseThresholds(2)).toEqual([0.5]);
  });
  it('3 phases cross at 2/3 and 1/3, descending', () => {
    const t = phaseThresholds(3);
    expect(t).toHaveLength(2);
    expect(t[0]).toBeCloseTo(2 / 3, 5);
    expect(t[1]).toBeCloseTo(1 / 3, 5);
  });
});

describe('phaseFromHp', () => {
  const t2 = phaseThresholds(2); // [0.5]
  it('full hp is phase 0', () => expect(phaseFromHp(1, t2)).toBe(0));
  it('just above threshold is phase 0', () => expect(phaseFromHp(0.51, t2)).toBe(0));
  it('at threshold is phase 1', () => expect(phaseFromHp(0.5, t2)).toBe(1));
  it('below threshold is phase 1', () => expect(phaseFromHp(0.2, t2)).toBe(1));
  it('3-phase boss at 0.3 hp is phase 2', () =>
    expect(phaseFromHp(0.3, phaseThresholds(3))).toBe(2));
});

describe('phaseScale', () => {
  it('single phase is full scale', () => expect(phaseScale(0, 1)).toBe(1));
  it('final phase fills the box', () => {
    expect(phaseScale(1, 2)).toBe(1);
    expect(phaseScale(2, 3)).toBe(1);
  });
  it('earlier phases are smaller, bounded by spriteScaleMin (0.7)', () => {
    expect(phaseScale(0, 2)).toBeCloseTo(0.7, 5);
    expect(phaseScale(0, 3)).toBeCloseTo(0.7, 5);
    expect(phaseScale(1, 3)).toBeCloseTo(0.85, 5);
  });
});
