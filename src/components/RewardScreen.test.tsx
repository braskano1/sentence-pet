import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RewardScreen } from './RewardScreen';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('RewardScreen', () => {
  it('shows stars and food, and returns to petRoom on continue', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ level: 1, stars: 3, correctCount: 5 });
    render(<RewardScreen />);
    expect(screen.getByText(/⭐⭐⭐/)).toBeInTheDocument();
    expect(screen.getByText(/5 .*protein/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
