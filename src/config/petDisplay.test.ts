import { describe, expect, it } from 'vitest';
import { displayStats, petLevel, petPower, petSpecialty, petDisplayName, STAGE_NAME } from './petDisplay';
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

describe('display derivations', () => {
  const base = makePet({ id: 't', species: 'water', stats: { hp: 50, atk: 60, def: 40, spd: 55, luk: 45 }, rarity: 'rare' });
  it('displayStats = stats + growth', () => {
    const p = { ...base, growth: { hp: 5, atk: 0, def: 0, spd: 0, luk: 0 } };
    expect(displayStats(p)).toEqual({ hp: 55, atk: 60, def: 40, spd: 55, luk: 45 });
  });
  it('petPower sums displayed stats', () => {
    expect(petPower(base)).toBe(50 + 60 + 40 + 55 + 45);
  });
  it('petSpecialty is the highest displayed stat, tie-broken by stat order', () => {
    expect(petSpecialty(base)).toBe('atk');
  });
  it('petLevel reflects xp', () => {
    expect(petLevel({ ...base, xp: 0 })).toBe(1);
    expect(petLevel({ ...base, xp: 40 })).toBe(2);
  });
  it('STAGE_NAME labels each stage', () => {
    expect(STAGE_NAME.young).toBe('Young');
  });
});
