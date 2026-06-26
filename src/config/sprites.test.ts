import { describe, expect, it } from 'vitest';
import { SPRITES, EGG_SPRITE, ELEMENTAL_EGGS, spriteSrc } from './sprites';
import { SPECIES } from '../domain/species';

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
