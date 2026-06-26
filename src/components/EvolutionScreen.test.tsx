import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

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

  it('renders the cinematic; Continue clears the change and routes to petRoom', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, screen: 'evolution' });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // tap to skip
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().lastStageChange).toBeNull();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
