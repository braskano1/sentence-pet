import { describe, expect, it } from 'vitest';
import { SPECIES, pickSpecies, moodFor } from './species';

describe('pickSpecies', () => {
  it('returns each species across the rng range', () => {
    expect(pickSpecies(() => 0)).toBe('leaf');
    expect(pickSpecies(() => 0.26)).toBe('fire');
    expect(pickSpecies(() => 0.5)).toBe('air');
    expect(pickSpecies(() => 0.99)).toBe('water');
  });

  it('only ever returns a known species', () => {
    for (let i = 0; i < 100; i++) {
      expect(SPECIES).toContain(pickSpecies(() => i / 100));
    }
  });

  it('clamps at the rng=1 upper edge instead of returning undefined', () => {
    expect(pickSpecies(() => 1)).toBe('water');
  });
});

describe('moodFor', () => {
  it('is happy at or above half of max', () => {
    expect(moodFor(50, 100)).toBe('happy');
    expect(moodFor(100, 100)).toBe('happy');
  });
  it('is sad below half of max', () => {
    expect(moodFor(49, 100)).toBe('sad');
    expect(moodFor(0, 100)).toBe('sad');
  });
});
