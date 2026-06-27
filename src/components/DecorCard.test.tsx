import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecorCard } from './DecorCard';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

const beach = GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!;

beforeEach(() => {
  useGameStore.getState().resetForTest();
});

describe('DecorCard', () => {
  it('shows name and price', () => {
    render(<DecorCard item={beach} coins={0} owned={false} active={false} index={0} />);
    expect(screen.getByText('Beach')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it('Buy with enough coins purchases the room', async () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<DecorCard item={beach} coins={100} owned={false} active={false} index={0} />);
    await userEvent.click(screen.getByRole('button', { name: /buy beach/i }));
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('Buy is disabled when unaffordable', () => {
    render(<DecorCard item={beach} coins={10} owned={false} active={false} index={0} />);
    expect(screen.getByRole('button', { name: /buy beach/i })).toBeDisabled();
  });

  it('owned + not active shows Equip; click equips', async () => {
    render(<DecorCard item={beach} coins={0} owned={true} active={false} index={0} />);
    await userEvent.click(screen.getByRole('button', { name: /equip beach/i }));
    expect(useGameStore.getState().activeBackground).toBe('decor:beach');
  });

  it('owned + active shows Equipped (disabled)', () => {
    render(<DecorCard item={beach} coins={0} owned={true} active={true} index={0} />);
    expect(screen.getByRole('button', { name: /equipped beach/i })).toBeDisabled();
  });

  it('plays purchase SFX on a successful buy', async () => {
    play.mockClear();
    useGameStore.getState().addCoinsForTest(100);
    render(<DecorCard item={beach} coins={100} owned={false} active={false} index={0} />);
    await userEvent.click(screen.getByRole('button', { name: /buy beach/i }));
    expect(play).toHaveBeenCalledWith('purchase');
  });
});
