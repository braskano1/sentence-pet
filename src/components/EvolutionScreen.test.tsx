import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// Real framer-motion renders fine in jsdom; matchMedia is polyfilled in src/test/setup.ts
// so useReducedMotion() returns false. Only the sound module is mocked.
const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import { EvolutionScreen } from './EvolutionScreen';
import { useGameStore } from '../state/gameStore';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionScreen', () => {
  it('redirects to petRoom when there is no stage change', () => {
    useGameStore.setState({ lastStageChange: null, screen: 'evolution' });
    render(<EvolutionScreen />);
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('on skip shows the new stage banner and Continue routes to petRoom + clears the change', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, screen: 'evolution' });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // tap to skip
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().lastStageChange).toBeNull();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('plays the reveal cue when sound is on, not when off', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: true });
    const { unmount } = render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // skip -> reveal
    expect(sound.reveal).toHaveBeenCalled();
    unmount();

    Object.values(sound).forEach((f) => f.mockClear());
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: false });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).not.toHaveBeenCalled();
  });

  it('renders a sound toggle that flips soundEnabled', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, soundEnabled: true });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(useGameStore.getState().soundEnabled).toBe(false);
  });
});
