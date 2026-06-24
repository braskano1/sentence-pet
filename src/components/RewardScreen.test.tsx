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

  it('shows the earned food group (protein) when present', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' } });
    render(<RewardScreen />);
    expect(screen.getByText(/Level cleared/)).toBeInTheDocument();
    expect(screen.getByText(/protein/i)).toBeInTheDocument();
    expect(screen.getByText(/coins/)).toBeInTheDocument();
  });

  it('shows veggie for a word-choice reward', () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'veggie' } });
    render(<RewardScreen />);
    expect(screen.getByText(/veggie/i)).toBeInTheDocument();
  });

  it('navigates to petRoom when Continue is clicked', async () => {
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' } });
    render(<RewardScreen />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
