import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '../state/gameStore';
import { EvolutionScreen } from './EvolutionScreen';

// Drive the cinematic's onDone synchronously via a mock button.
vi.mock('./EvolutionCinematic', () => ({
  EvolutionCinematic: ({ onDone }: { onDone: () => void }) => (
    <button onClick={onDone}>done</button>
  ),
}));

beforeEach(() => useGameStore.getState().resetForTest());

describe('EvolutionScreen intro-hatch name gate', () => {
  it('intro egg hatch with no name routes to nameEntry', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'egg', to: 'baby' }, displayName: '' });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('nameEntry');
  });

  it('egg hatch when a name already exists goes to petRoom (no re-prompt)', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'egg', to: 'baby' }, displayName: 'Ava', currentCourseId: null });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('a real evolution (baby->young) never routes to nameEntry', () => {
    useGameStore.setState({ screen: 'evolution', lastStageChange: { from: 'baby', to: 'young' }, displayName: '', currentCourseId: null });
    render(<EvolutionScreen />);
    screen.getByText('done').click();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
