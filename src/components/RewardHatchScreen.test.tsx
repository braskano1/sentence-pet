import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RewardHatchScreen } from './RewardHatchScreen';
import { useGameStore } from '../state/gameStore';
import { makePet } from '../domain/pets';

vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>done</button>,
}));

const pet = () =>
  makePet({ id: 'p1', species: 'leaf', defId: 'leaf-1', stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 }, rarity: 'common' });

describe('RewardHatchScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('redirects to petRoom when there is no pet to hatch', () => {
    useGameStore.setState({ lastHatch: null, screen: 'rewardHatch' });
    render(<RewardHatchScreen />);
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('plays the hatch then routes to petRoom and clears lastHatch', () => {
    useGameStore.setState({ lastHatch: pet(), lastStageChange: null, screen: 'rewardHatch' });
    render(<RewardHatchScreen />);
    fireEvent.click(screen.getByText('done'));
    expect(useGameStore.getState().lastHatch).toBeNull();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('routes to evolution when an active-pet stage change is pending', () => {
    useGameStore.setState({ lastHatch: pet(), lastStageChange: { from: 'baby', to: 'young' }, screen: 'rewardHatch' });
    render(<RewardHatchScreen />);
    fireEvent.click(screen.getByText('done'));
    expect(useGameStore.getState().lastHatch).toBeNull();
    expect(useGameStore.getState().screen).toBe('evolution');
  });
});
