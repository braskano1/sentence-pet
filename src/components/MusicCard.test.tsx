import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MusicCard, type MusicRow } from './MusicCard';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { DEFAULT_OVERWORLD_TRACK_URL } from '../domain/music';

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('../hooks/useAudio', () => ({ useAudio: () => ({ play }) }));

const lofiItem = GAME_CONFIG.shop.music.find((m) => m.id === 'music:lofi')!;
const lofi: MusicRow = { id: lofiItem.id, name: lofiItem.name, src: lofiItem.src, price: lofiItem.price };
const cozy: MusicRow = { id: null, name: 'Cozy Theme', src: DEFAULT_OVERWORLD_TRACK_URL };

const noop = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.getState().resetForTest();
});

describe('MusicCard', () => {
  it('not owned + affordable shows Buy; click dispatches buyMusic and plays purchase SFX', async () => {
    useGameStore.getState().addCoinsForTest(200);
    render(
      <MusicCard item={lofi} coins={150} owned={false} active={false} index={0}
        previewing={false} onPreviewToggle={noop} />,
    );
    const btn = screen.getByRole('button', { name: /buy lo-fi lounge/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(useGameStore.getState().owned).toContain('music:lofi');
    expect(play).toHaveBeenCalledWith('purchase');
  });

  it('Buy is disabled (greyed) when unaffordable', () => {
    render(
      <MusicCard item={lofi} coins={10} owned={false} active={false} index={0}
        previewing={false} onPreviewToggle={noop} />,
    );
    expect(screen.getByRole('button', { name: /buy lo-fi lounge/i })).toBeDisabled();
  });

  it('owned + not active shows Equip; click equips that track id', async () => {
    render(
      <MusicCard item={lofi} coins={0} owned={true} active={false} index={0}
        previewing={false} onPreviewToggle={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /equip lo-fi lounge/i }));
    expect(useGameStore.getState().activeTrack).toBe('music:lofi');
  });

  it('owned + active shows Equipped (disabled)', () => {
    render(
      <MusicCard item={lofi} coins={0} owned={true} active={true} index={0}
        previewing={false} onPreviewToggle={noop} />,
    );
    expect(screen.getByRole('button', { name: /equipped lo-fi lounge/i })).toBeDisabled();
  });

  it('the free default card equips null', async () => {
    // Pretend a different track is currently equipped so the default is equippable.
    useGameStore.setState({ activeTrack: 'music:lofi' });
    render(
      <MusicCard item={cozy} coins={0} owned={true} active={false} index={0}
        previewing={false} onPreviewToggle={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /equip cozy theme/i }));
    expect(useGameStore.getState().activeTrack).toBeNull();
  });

  it('preview button fires the preview toggle callback', async () => {
    const onPreviewToggle = vi.fn();
    render(
      <MusicCard item={lofi} coins={0} owned={true} active={false} index={0}
        previewing={false} onPreviewToggle={onPreviewToggle} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^preview lo-fi lounge$/i }));
    expect(onPreviewToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the pause affordance and a stop label while previewing', () => {
    render(
      <MusicCard item={lofi} coins={0} owned={true} active={false} index={0}
        previewing={true} onPreviewToggle={noop} />,
    );
    expect(screen.getByRole('button', { name: /stop preview of lo-fi lounge/i })).toBeInTheDocument();
    expect(screen.getByText('⏸')).toBeInTheDocument();
  });
});
