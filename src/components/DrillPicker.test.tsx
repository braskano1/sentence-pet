import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { DrillPicker } from './DrillPicker';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('DrillPicker', () => {
  it('shows a card for each drill', () => {
    render(<DrillPicker />);
    expect(screen.getByText('Pattern')).toBeInTheDocument();
    expect(screen.getByText('Word Choice')).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('shows a level chip per authored level (4 L1 chips, 2 L2 chips)', () => {
    render(<DrillPicker />);
    expect(screen.getAllByRole('button', { name: 'L1' }).length).toBe(4); // all 4 drills
    expect(screen.getAllByRole('button', { name: 'L2' }).length).toBe(2); // pattern + grammar
  });

  it('tapping a level chip starts that drill at that level', async () => {
    render(<DrillPicker />);
    const grammarCard = screen.getByText('Grammar').closest('div')!;
    await userEvent.click(within(grammarCard).getByRole('button', { name: 'L2' }));
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('grammar');
    expect(s.selectedLevel).toBe(2);
    expect(s.screen).toBe('drill');
  });

  it('Back returns to the pet room', async () => {
    useGameStore.getState().hatch();
    useGameStore.getState().setScreen('pickDrill');
    render(<DrillPicker />);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
