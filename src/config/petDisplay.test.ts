import { describe, expect, it, afterEach } from 'vitest';
import { displayStats, petLevel, petPower, petSpecialty, petDisplayName, petStageSprite, STAGE_NAME } from './petDisplay';
import { makePet, rollStats } from '../domain/pets';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';
import { SPRITES } from './sprites';
import type { PetDef } from '../data/types';

const base = () => makePet({ id: 'x', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common' });

describe('petDisplayName', () => {
  afterEach(() => setActivePetDefs([...BUILTIN_PET_DEFS]));

  it("returns the def's authored Dex name when name is blank", () => {
    // Seed a def with a known authored name; an unnamed pet with that defId shows it.
    const fire: PetDef = { ...BUILTIN_PET_DEFS[1], name: 'Sapphire Phoenix' };
    setActivePetDefs([BUILTIN_PET_DEFS[0], fire, ...BUILTIN_PET_DEFS.slice(2)]);
    const pet = makePet({ id: 'x', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common', defId: fire.id });
    // CHANGED: was 'Ember' (PET_NAME element name); now the def's authored name.
    expect(petDisplayName(pet)).toBe('Sapphire Phoenix');
  });
  it('returns the custom name when set', () => {
    expect(petDisplayName({ ...base(), name: 'Blaze' })).toBe('Blaze');
  });
  it("falls back to the def's authored name for whitespace-only names", () => {
    // CHANGED: was 'Ember'; the builtin fire def's authored name is 'Embers'.
    expect(petDisplayName({ ...base(), name: '   ' })).toBe('Embers');
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

describe('petStageSprite — def-aware artwork', () => {
  afterEach(() => setActivePetDefs([...BUILTIN_PET_DEFS]));

  const roll = () => rollStats(() => 0.5);

  it("returns the def's override art when defId resolves to a def whose element matches the species", () => {
    // leaf built-in (starter) given a sprite override; a hatched leaf pet at baby stage (xp 0)
    const leaf: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/leaf-real.webp' } };
    setActivePetDefs([leaf, ...BUILTIN_PET_DEFS.slice(1)]);
    const pet = makePet({ id: 'p', species: 'leaf', stats: roll(), rarity: 'common', hatched: true, defId: leaf.id });
    expect(petStageSprite(pet)).toBe('https://cdn.test/leaf-real.webp');
  });

  it('falls back to plain element art when defId is unknown (starter fallback element ≠ species → guard rejects override)', () => {
    // Starter (leaf) has an override; an unknown defId resolves to that starter, but the
    // pet is fire — the element guard rejects the leaf override and returns fire art.
    const leafStarter: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/leaf-real.webp' } };
    setActivePetDefs([leafStarter, ...BUILTIN_PET_DEFS.slice(1)]);
    const pet = makePet({ id: 'p', species: 'fire', stats: roll(), rarity: 'common', hatched: true, defId: 'does-not-exist' });
    expect(petStageSprite(pet)).toBe(SPRITES.fire.baby.happy);
  });

  it('maps the egg stage to baby art (behavior preserved)', () => {
    const pet = makePet({ id: 'p', species: 'water', stats: roll(), rarity: 'common', hatched: false });
    expect(petStageSprite(pet)).toBe(SPRITES.water.baby.happy);
  });
});
