import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shop } from './Shop';
import { useGameStore } from '../state/gameStore';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { play, previewTrack, stopPreview } = vi.hoisted(() => ({
  play: vi.fn(),
  previewTrack: vi.fn(),
  stopPreview: vi.fn(),
}));
vi.mock('../hooks/useAudio', () => ({
  useAudio: () => ({ play, previewTrack, stopPreview }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.getState().resetForTest();
});

describe('Shop', () => {
  it('renders title, coin balance, all 3 treats, and Back', () => {
    render(<Shop />);
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy snack/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy treat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy feast/i })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /buy snack/i }));
    expect(useGameStore.getState().coins).toBe(85);
  });

  it('shows Treats, Decor, and Music tabs; treats visible by default', () => {
    render(<Shop />);
    expect(screen.getByRole('tab', { name: /treats/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /decor/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /music/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy snack/i })).toBeInTheDocument();
  });

  it('switching to Decor tab shows room cards', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('tab', { name: /^decor$/i }));
    expect(screen.getByRole('button', { name: /buy beach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy fire room/i })).toBeInTheDocument();
  });

  it('switching to Music tab shows track rows incl. the free default and a buyable track', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('tab', { name: /^music$/i }));
    // The free default "Cozy Theme" is equipped by default.
    expect(screen.getByText('Cozy Theme')).toBeInTheDocument();
    expect(screen.getByText('Lo-Fi Lounge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /equipped cozy theme/i })).toBeInTheDocument();
  });

  it('previewing a music row calls previewTrack with the track src', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('tab', { name: /^music$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^preview lo-fi lounge$/i }));
    expect(previewTrack).toHaveBeenCalledWith('/audio/tracks/lofi.mp3');
  });

  it('leaving the Music tab stops the preview', async () => {
    render(<Shop />);
    await userEvent.click(screen.getByRole('tab', { name: /^music$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^preview lo-fi lounge$/i }));
    stopPreview.mockClear();
    await userEvent.click(screen.getByRole('tab', { name: /^treats$/i }));
    expect(stopPreview).toHaveBeenCalled();
  });

  it('buying a room (with coins) from the Decor tab records ownership', async () => {
    useGameStore.getState().addCoinsForTest(200);
    render(<Shop />);
    await userEvent.click(screen.getByRole('tab', { name: /^decor$/i }));
    await userEvent.click(screen.getByRole('button', { name: /buy beach/i }));
    expect(useGameStore.getState().owned).toContain('decor:beach');
  });

  it('exposes the shop tabs as a tablist with selection state', () => {
    render(<Shop />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const treats = screen.getByRole('tab', { name: /treats/i });
    expect(treats).toHaveAttribute('aria-selected', 'true');
  });

  it('arrow keys move selection and focus across all 3 tabs (roving tabindex)', () => {
    render(<Shop />);
    const treats = screen.getByRole('tab', { name: /treats/i });
    treats.focus();
    fireEvent.keyDown(treats, { key: 'ArrowRight' });
    const decor = screen.getByRole('tab', { name: /decor/i });
    expect(decor).toHaveAttribute('aria-selected', 'true');
    expect(decor).toHaveFocus();

    fireEvent.keyDown(decor, { key: 'ArrowRight' });
    const music = screen.getByRole('tab', { name: /music/i });
    expect(music).toHaveAttribute('aria-selected', 'true');
    expect(music).toHaveFocus();

    // wraps back to treats
    fireEvent.keyDown(music, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /treats/i })).toHaveFocus();

    // ArrowLeft from treats wraps to music
    fireEvent.keyDown(screen.getByRole('tab', { name: /treats/i }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: /music/i })).toHaveFocus();
  });

  it('the active tab has tabIndex 0 and the inactive tabs tabIndex -1', () => {
    render(<Shop />);
    expect(screen.getByRole('tab', { name: /treats/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /decor/i })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: /music/i })).toHaveAttribute('tabindex', '-1');
  });

  it('renders the selected panel as a tabpanel labelled by its tab', () => {
    render(<Shop />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'shop-tab-treats');
    expect(panel).toHaveAttribute('id', 'shop-panel-treats');
  });
});
