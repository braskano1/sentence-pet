import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetRoom } from './PetRoom';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('PetRoom', () => {
  it('Feed button consumes protein inventory into the bar', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().setScreen('petRoom');
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /feed/i }));
    expect(useGameStore.getState().inventory.protein).toBe(0);
  });

  it('Play button switches to the drill screen', async () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(useGameStore.getState().screen).toBe('drill');
  });
});
