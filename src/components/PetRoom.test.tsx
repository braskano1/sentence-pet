import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';

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
});
