import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shop } from './Shop';
import { useGameStore } from '../state/gameStore';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

beforeEach(() => {
  useGameStore.getState().resetForTest();
});

describe('Shop', () => {
  it('renders title, coin balance, all 3 treats, and Back', () => {
    render(<Shop />);
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /snack/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /treat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /feast/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('Back returns to petRoom', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('buying a treat (with coins) spends coins', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Shop />);
    await userEvent.click(screen.getByRole('button', { name: /snack/i }));
    expect(useGameStore.getState().pet.coins).toBe(85);
  });
});
