// src/components/EggHatch.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { EggHatch } from './EggHatch';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('EggHatch', () => {
  it('renders the egg prompt, hint, and POS slots', () => {
    render(<EggHatch />);
    expect(screen.getByText(/Build the sentence to hatch/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'egg' })).toBeTruthy();
  });

  it('renders draggable tiles for the answer words', () => {
    render(<EggHatch />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <EggHatch />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
