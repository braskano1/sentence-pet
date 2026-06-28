import { describe, it, expect } from 'vitest';
import { spriteSrc, SPRITES, EGG_SPRITE } from './sprites';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import type { PetDef } from '../data/types';

const leafDef = BUILTIN_PET_DEFS.find((d) => d.element === 'leaf')!;

describe('spriteSrc — override resolution', () => {
  it('returns element art when no def is passed', () => {
    expect(spriteSrc('leaf', 'adult', 'happy')).toBe(SPRITES.leaf.adult.happy);
  });

  it('returns element art when def has no sprite override', () => {
    expect(spriteSrc('leaf', 'adult', 'happy', leafDef)).toBe(SPRITES.leaf.adult.happy);
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
