import { describe, expect, it } from 'vitest';
import { SPRITES, EGG_SPRITE, ELEMENTAL_EGGS, spriteSrc } from './sprites';
import { SPECIES } from '../domain/species';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import type { PetDef } from '../data/types';

const STAGES = ['baby', 'young', 'adult'] as const;
const MOODS = ['happy', 'sad'] as const;

describe('sprite registry', () => {
  it('has a generic egg sprite', () => {
    expect(EGG_SPRITE).toBeTruthy();
  });

  it('resolves a url for every species x stage x mood', () => {
    for (const sp of SPECIES) {
      for (const stage of STAGES) {
        for (const mood of MOODS) {
          expect(SPRITES[sp][stage][mood], `${sp}/${stage}/${mood}`).toBeTruthy();
        }
      }
    }
  });

  it('has an elemental egg per species (reserved for Phase B)', () => {
    for (const sp of SPECIES) expect(ELEMENTAL_EGGS[sp], sp).toBeTruthy();
  });
});

describe('spriteSrc', () => {
  it('returns the generic egg sprite for the egg stage', () => {
    expect(spriteSrc('leaf', 'egg', 'happy')).toBe(EGG_SPRITE);
  });
  it('returns the per-species/stage/mood sprite otherwise', () => {
    expect(spriteSrc('fire', 'young', 'sad')).toBe(SPRITES.fire.young.sad);
  });
});

const leafDef = BUILTIN_PET_DEFS.find((d) => d.element === 'leaf')!;

describe('spriteSrc — override resolution', () => {
  it('returns element art when no def is passed', () => {
    expect(spriteSrc('leaf', 'adult', 'happy')).toBe(SPRITES.leaf.adult.happy);
  });

  it('returns element art when def has no sprite override', () => {
    const noOverrideDef: PetDef = { ...leafDef, sprite: undefined };
    expect(spriteSrc('leaf', 'adult', 'happy', noOverrideDef)).toBe(SPRITES.leaf.adult.happy);
  });

  it('uses sprite.default for every non-egg stage/mood', () => {
    const def: PetDef = { ...leafDef, sprite: { default: 'https://cdn.test/d.webp' } };
    expect(spriteSrc('leaf', 'baby', 'happy', def)).toBe('https://cdn.test/d.webp');
    expect(spriteSrc('leaf', 'adult', 'sad', def)).toBe('https://cdn.test/d.webp');
  });

  it('prefers a matching variant over default', () => {
    const def: PetDef = {
      ...leafDef,
      sprite: { default: 'https://cdn.test/d.webp', variants: { adult: { happy: 'https://cdn.test/ah.webp' } } },
    };
    expect(spriteSrc('leaf', 'adult', 'happy', def)).toBe('https://cdn.test/ah.webp');
    expect(spriteSrc('leaf', 'baby', 'happy', def)).toBe('https://cdn.test/d.webp');
  });

  it('always returns the generic egg, ignoring any override', () => {
    const def: PetDef = { ...leafDef, sprite: { default: 'https://cdn.test/d.webp' } };
    expect(spriteSrc('leaf', 'egg', 'happy', def)).toBe(EGG_SPRITE);
  });
});

describe('spriteSrc — element guard (orphaned-defId leak)', () => {
  it('ignores the override when the def element does not match the pet species', () => {
    const leafWithSprite = { ...leafDef, sprite: { default: 'https://cdn.test/leaf-override.webp' } };
    // a fire pet wrongly resolved to a leaf def must still render fire element art
    expect(spriteSrc('fire', 'adult', 'happy', leafWithSprite)).toBe(SPRITES.fire.adult.happy);
  });

  it('still applies the override when the def element matches the species', () => {
    const leafWithSprite = { ...leafDef, sprite: { default: 'https://cdn.test/leaf-override.webp' } };
    expect(spriteSrc('leaf', 'adult', 'happy', leafWithSprite)).toBe('https://cdn.test/leaf-override.webp');
  });
});
