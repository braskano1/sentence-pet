import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { makePet, rollStats } from '../domain/pets';

beforeEach(() => useGameStore.getState().resetForTest());

describe('PetRoom', () => {
  it('a feed button consumes that food group into its bar', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().setScreen('petRoom');
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /feed/i }));
    expect(useGameStore.getState().inventory.veggie).toBe(0);
  });

  it('Play opens the drill picker', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    expect(screen.getByRole('img', { name: /^pet-/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
  });

  it('Shop button navigates to shop', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /shop/i }));
    expect(useGameStore.getState().screen).toBe('shop');
  });

  it('shows no room background image by default (free default)', () => {
    useGameStore.getState().resetForTest();
    render(<PetRoom />);
    expect(screen.queryByTestId('room-bg')).toBeNull();
  });

  it('renders the active room background when one is equipped', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipBackground('decor:beach');
    render(<PetRoom />);
    const bg = screen.getByTestId('room-bg');
    expect(bg).toBeInTheDocument();
    expect(bg).toHaveAttribute('src', GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!.sprite);
  });

  it('shows a chip per owned pet and switches the active pet on tap', async () => {
    useGameStore.getState().hatch();
    useGameStore.setState((s) => ({
      pets: [...s.pets, makePet({ id: 'p2', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
    }));
    render(<PetRoom />);
    expect(screen.getByRole('button', { name: /sprout \(active\)/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /switch to ember/i }));
    expect(useGameStore.getState().activePetId).toBe('p2');
  });

  it('shows the active pet battle stats', () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('ATK')).toBeInTheDocument();
    expect(screen.getByText('LUK')).toBeInTheDocument();
  });
});
