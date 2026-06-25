import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PetSprite } from './PetSprite';

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
