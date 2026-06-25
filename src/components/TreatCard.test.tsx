import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import confetti from 'canvas-confetti';
import { TreatCard } from './TreatCard';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const snack = GAME_CONFIG.shop.treats[0]; // price 15, +15

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.getState().resetForTest();
});

describe('TreatCard', () => {
  it('affordable card is enabled, shows price, and spends coins on click', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<TreatCard item={snack} coins={100} full={false} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(useGameStore.getState().coins).toBe(85);
    expect(confetti).toHaveBeenCalledTimes(1); // confetti gated to a successful buy
  });

  it('unaffordable card is tappable (not disabled), shows reason, and does not spend', async () => {
    render(<TreatCard item={snack} coins={0} full={false} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).not.toBeDisabled();
    expect(screen.getByText('Not enough coins')).toBeInTheDocument();
    await userEvent.click(btn);
    expect(useGameStore.getState().coins).toBe(0);
    expect(confetti).not.toHaveBeenCalled(); // no confetti on a denied buy
  });

  it('happiness-full card is disabled and shows the full reason', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<TreatCard item={snack} coins={100} full={true} index={0} />);
    const btn = screen.getByRole('button', { name: /snack/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText('Already happy!')).toBeInTheDocument();
  });
});
