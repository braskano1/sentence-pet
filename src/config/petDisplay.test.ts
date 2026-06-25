import { describe, expect, it } from 'vitest';
import { petDisplayName } from './petDisplay';
import { makePet, rollStats } from '../domain/pets';

const base = () => makePet({ id: 'x', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common' });

describe('petDisplayName', () => {
  it('returns the species name when name is blank', () => {
    expect(petDisplayName(base())).toBe('Ember'); // fire -> Ember
  });
  it('returns the custom name when set', () => {
    expect(petDisplayName({ ...base(), name: 'Blaze' })).toBe('Blaze');
  });
  it('falls back to species name for whitespace-only names', () => {
    expect(petDisplayName({ ...base(), name: '   ' })).toBe('Ember');
  });
});
