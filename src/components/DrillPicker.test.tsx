import { render, screen } from '@testing-library/react';
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

  it('picking a drill starts it', async () => {
    render(<DrillPicker />);
    await userEvent.click(screen.getByText('Word Choice'));
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('wordChoice');
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
