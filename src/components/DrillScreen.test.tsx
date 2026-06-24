// src/components/DrillScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    render(<DrillScreen drill="pattern" level={1} />);
    expect(screen.getByText(/Sentence 1 of 5/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen drill="pattern" level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('word-choice tray includes distractor tiles (more than the answer)', () => {
    render(<DrillScreen drill="wordChoice" level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen drill="pattern" level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
