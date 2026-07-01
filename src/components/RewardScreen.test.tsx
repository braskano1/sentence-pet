// src/components/RewardScreen.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { play, playStinger } = vi.hoisted(() => ({ play: vi.fn(), playStinger: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play, playStinger }) }));

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

  it('returns to the journey map (pickDrill) after a lesson when a course is loaded', async () => {
    useGameStore.setState({
      lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' },
      currentCourseId: 'default',
    });
    render(<RewardScreen />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('pickDrill');
  });

  it('routes to the evolution screen when a stage change is pending', async () => {
    useGameStore.setState({
      lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' },
      lastStageChange: { from: 'baby', to: 'young' },
    });
    render(<RewardScreen />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().screen).toBe('evolution');
  });

  it('shows level-up callout with toLevel and gained stat when lastLevelUp is set', () => {
    useGameStore.setState({
      lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' },
      lastLevelUp: { toLevel: 3, gained: ['atk'] },
    });
    render(<RewardScreen />);
    expect(screen.getByText(/Lv 3/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 ATK/)).toBeInTheDocument();
  });

  it('plays coin SFX once on mount when a reward is present', () => {
    play.mockClear();
    useGameStore.setState({ lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' } });
    render(<RewardScreen />);
    expect(play).toHaveBeenCalledWith('coin');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('fires the queued boss stinger on mount and clears it', () => {
    playStinger.mockClear();
    useGameStore.setState({
      lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' },
      pendingStinger: 'win',
    });
    render(<RewardScreen />);
    expect(playStinger).toHaveBeenCalledWith('win');
    expect(playStinger).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().pendingStinger).toBeNull();
  });

  it('does not fire a stinger when none is queued', () => {
    playStinger.mockClear();
    useGameStore.setState({
      lastReward: { level: 1, stars: 3, food: 5, coins: 25, group: 'protein' },
      pendingStinger: null,
    });
    render(<RewardScreen />);
    expect(playStinger).not.toHaveBeenCalled();
  });
});
