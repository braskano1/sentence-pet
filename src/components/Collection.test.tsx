import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Collection } from './Collection';
import { useGameStore } from '../state/gameStore';
import { makePet, rollStats } from '../domain/pets';

beforeEach(() => useGameStore.getState().resetForTest());

function addPet(id: string, species: 'leaf' | 'fire' | 'air' | 'water') {
  useGameStore.setState((s) => ({
    pets: [...s.pets, makePet({ id, species, stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
  }));
}

describe('Collection', () => {
  it('shows the active pet detail with its rarity and a stat radar', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    expect(screen.getByRole('img', { name: /battle stat radar/i })).toBeInTheDocument();
    // the active starter is a leaf -> Sprout (appears in detail + roster)
    expect(screen.getAllByText('Sprout').length).toBeGreaterThan(0);
  });

  it('lists every owned pet in the roster and switches active on tap', () => {
    useGameStore.getState().hatch();
    addPet('p2', 'fire');
    render(<Collection />);
    expect(screen.getByText(/my pets \(2\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /raise ember/i }));
    expect(useGameStore.getState().activePetId).toBe('p2');
  });

  it('Back returns to the pet room', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /back to room/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('shows the element strong/weak line for the active pet', () => {
    useGameStore.getState().hatch(); // starter is leaf -> strong vs water (Bubble), weak vs air (Breeze)
    render(<Collection />);
    const strong = screen.getByText(/strong vs/i);
    expect(strong.textContent).toMatch(/bubble/i);
    const weak = screen.getByText(/weak vs/i);
    expect(weak.textContent).toMatch(/breeze/i);
  });
});
