import { describe, it, expect } from 'vitest';
import { PET_TYPES, isPetType } from './petType';
import { SPECIES } from './species';

describe('PetType registry', () => {
  it('is seeded from the 4 element names', () => {
    expect([...PET_TYPES].sort()).toEqual([...SPECIES].sort());
  });

  it('isPetType accepts a registered type and rejects an unknown one', () => {
    expect(isPetType('leaf')).toBe(true);
    expect(isPetType('dragon')).toBe(false);
    expect(isPetType('')).toBe(false);
  });
});
