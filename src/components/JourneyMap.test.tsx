import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyMap } from './JourneyMap';
import { useGameStore } from '../state/gameStore';
import { orderedUnits } from '../content/model';
import { SEED } from '../content/seed';

const u1 = orderedUnits(SEED)[0];
const u1AllCleared = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));

describe('JourneyMap', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  // ---- preserved behavior ----
  it('renders each unit title', () => {
    render(<JourneyMap />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });

  it('a locked unit\'s first node is disabled', () => {
    render(<JourneyMap />);
    expect(screen.getByRole('button', { name: /Next Steps.*pattern/i })).toBeDisabled();
  });

  it('tapping an available node starts that lesson', () => {
    render(<JourneyMap />);
    fireEvent.click(screen.getByRole('button', { name: /Basics.*pattern.*not started/i }));
    expect(useGameStore.getState().currentLessonId).toBe('u1-pattern');
    expect(useGameStore.getState().screen).toBe('drill');
  });

  it('a checkpoint is locked until the unit lessons are cleared', () => {
    render(<JourneyMap />);
    expect(screen.getByRole('button', { name: /Basics.*checkpoint/i })).toBeDisabled();
  });

  // ---- new behavior ----
  it('a fully-cleared unit starts folded (summary bar, nodes hidden)', () => {
    useGameStore.setState({ journey: { lessonStars: u1AllCleared } });
    render(<JourneyMap />);
    expect(screen.getByRole('button', { name: /expand Basics/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Basics: pattern lesson/i })).not.toBeInTheDocument();
  });

  it('expanding a folded unit reveals its nodes', () => {
    useGameStore.setState({ journey: { lessonStars: u1AllCleared } });
    render(<JourneyMap />);
    fireEvent.click(screen.getByRole('button', { name: /expand Basics/i }));
    expect(screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i })).toBeInTheDocument();
  });

  it('cleared nodes show their food emoji, not just a check', () => {
    useGameStore.setState({ journey: { lessonStars: { 'u1-pattern': 3 } } });
    render(<JourneyMap />);
    const node = screen.getByRole('button', { name: /Basics: pattern lesson, cleared/i });
    expect(node.textContent).toContain('🥩');
  });
});
