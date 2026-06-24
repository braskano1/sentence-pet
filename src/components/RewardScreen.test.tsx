// src/components/RewardScreen.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { RewardScreen } from './RewardScreen';
import { useGameStore } from '../state/gameStore';

describe('RewardScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders nothing when there is no reward', () => {
    const { container } = render(<RewardScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the reward details when a reward is present', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25 } });
    render(<RewardScreen />);
    expect(screen.getByText(/Level cleared/)).toBeInTheDocument();
    expect(screen.getByText(/protein/)).toBeInTheDocument();
    expect(screen.getByText(/coins/)).toBeInTheDocument();
  });

  it('navigates to petRoom when Continue is clicked', async () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25 } });
    render(<RewardScreen />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
