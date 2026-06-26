import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyMap } from './JourneyMap';
import { useGameStore } from '../state/gameStore';

describe('JourneyMap', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('renders a card per unit with its title', () => {
    render(<JourneyMap />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });

  it('locked unit cards are present but their nodes are disabled', () => {
    render(<JourneyMap />);
    // Unit 2 "Next Steps" is locked at fresh state → its first node disabled.
    const lockedNode = screen.getByRole('button', { name: /Next Steps.*pattern/i });
    expect(lockedNode).toBeDisabled();
  });

  it('tapping an available node starts that lesson', () => {
    render(<JourneyMap />);
    const node = screen.getByRole('button', { name: /Basics.*pattern.*not started/i });
    fireEvent.click(node);
    expect(useGameStore.getState().currentLessonId).toBe('u1-pattern');
    expect(useGameStore.getState().screen).toBe('drill');
  });

  it('a checkpoint is locked until the unit lessons are cleared', () => {
    render(<JourneyMap />);
    const checkpoint = screen.getByRole('button', { name: /Basics.*checkpoint/i });
    expect(checkpoint).toBeDisabled();
  });
});
