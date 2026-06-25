import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Gacha } from './Gacha';
import { useGameStore } from '../state/gameStore';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

describe('Gacha screen', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('shows the pull button disabled when too poor', () => {
    render(<Gacha />);
    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
  });

  it('enables pull when the player can afford an egg', () => {
    useGameStore.getState().addCoinsForTest(60);
    render(<Gacha />);
    expect(screen.getByRole('button', { name: /pull/i })).not.toBeDisabled();
  });

  it('pulling reveals the new pet with its rarity, and grows the collection', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    expect(useGameStore.getState().pets).toHaveLength(2);
    const rarity = useGameStore.getState().lastPull?.rarity ?? '';
    expect(screen.getByText(new RegExp(`^${rarity}$`, 'i'))).toBeTruthy();
  });

  it('Back returns to the pet room', () => {
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
