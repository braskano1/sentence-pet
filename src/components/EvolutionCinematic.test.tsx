import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import { EvolutionCinematic } from './EvolutionCinematic';
import { useGameStore } from '../state/gameStore';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionCinematic', () => {
  it('on skip shows the to-stage banner; Continue calls onDone and stops audio', () => {
    const onDone = vi.fn();
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={onDone} />);
    fireEvent.click(screen.getByTestId('evolution-stage')); // tap to skip
    expect(sound.stop).toHaveBeenCalled();
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays the reveal cue when sound is on, not when off', () => {
    useGameStore.setState({ soundEnabled: true });
    const { unmount } = render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).toHaveBeenCalled();
    unmount();

    Object.values(sound).forEach((f) => f.mockClear());
    useGameStore.setState({ soundEnabled: false });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).not.toHaveBeenCalled();
  });

  it('renders a sound toggle that flips soundEnabled', () => {
    useGameStore.setState({ soundEnabled: true });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(useGameStore.getState().soundEnabled).toBe(false);
  });

  it('stops in-flight audio when muted mid-sequence', () => {
    useGameStore.setState({ soundEnabled: true });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(sound.stop).toHaveBeenCalled();
  });
});
