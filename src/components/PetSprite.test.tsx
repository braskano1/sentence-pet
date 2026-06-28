import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PetSprite } from './PetSprite';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';
import { SPRITES } from '../config/sprites';
import type { PetDef } from '../data/types';

describe('PetSprite', () => {
  it('renders a happy sprite img with species/stage/mood alt', () => {
    render(<PetSprite stage="baby" species="leaf" happiness={80} />);
    const img = screen.getByRole('img', { name: 'pet-leaf-baby-happy' });
    expect(img).toHaveAttribute('src');
    expect(img.getAttribute('src')).toBeTruthy();
  });

  it('renders sad below the happiness threshold', () => {
    render(<PetSprite stage="adult" species="fire" happiness={10} />);
    expect(screen.getByRole('img', { name: 'pet-fire-adult-sad' })).toBeTruthy();
  });

  it('renders the generic egg at the egg stage', () => {
    render(<PetSprite stage="egg" species="leaf" happiness={60} />);
    expect(screen.getByRole('img', { name: 'pet-egg' })).toBeTruthy();
  });
});

describe('PetSprite — sprite override', () => {
  afterEach(() => setActivePetDefs([...BUILTIN_PET_DEFS]));

  it('renders the override sprite when defId resolves to a def with sprite.default', () => {
    const def: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/x.webp' } };
    setActivePetDefs([def, ...BUILTIN_PET_DEFS.slice(1)]);
    render(<PetSprite stage="adult" species="leaf" happiness={80} defId={def.id} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/x.webp');
  });

  it('falls back to element art when the override image errors', () => {
    const def: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/broken.webp' } };
    setActivePetDefs([def, ...BUILTIN_PET_DEFS.slice(1)]);
    render(<PetSprite stage="adult" species="leaf" happiness={80} defId={def.id} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', SPRITES.leaf.adult.happy);
  });

  it('renders element art when no defId is given (unchanged behavior)', () => {
    render(<PetSprite stage="adult" species="leaf" happiness={80} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', SPRITES.leaf.adult.happy);
  });

  it('clears the error state when defId changes to a working image', () => {
    const brokenDef: PetDef = { ...BUILTIN_PET_DEFS[0], sprite: { default: 'https://cdn.test/broken.webp' } };
    const goodDef: PetDef = { ...BUILTIN_PET_DEFS[1], id: 'def-fire-override', sprite: { default: 'https://cdn.test/good.webp' } };
    setActivePetDefs([brokenDef, goodDef, ...BUILTIN_PET_DEFS.slice(2)]);

    const { rerender } = render(<PetSprite stage="adult" species="leaf" happiness={80} defId={brokenDef.id} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).not.toHaveAttribute('src', 'https://cdn.test/broken.webp');

    rerender(<PetSprite stage="adult" species="fire" happiness={80} defId={goodDef.id} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/good.webp');
  });
});
