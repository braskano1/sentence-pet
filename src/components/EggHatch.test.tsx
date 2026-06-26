// src/components/EggHatch.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const speech = vi.hoisted(() => ({
  speakWord: vi.fn(),
  speakThai: vi.fn(),
  speakSentence: vi.fn(),
}));
vi.mock('../hooks/useSpeech', () => ({ useSpeech: () => speech }));

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

  it('lets you tap a tile into the current slot', () => {
    render(<EggHatch />);
    const firstTile = screen.getAllByTestId(/^tile-/)[0];
    const word = firstTile.getAttribute('data-testid')!.replace('tile-', '');
    fireEvent.click(firstTile);
    expect(screen.getByTestId('slot-0')).toHaveTextContent(new RegExp(word, 'i'));
  });

  it('shows no Submit button until all slots are filled, then reveals it', () => {
    render(<EggHatch />);
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    const tileCount = screen.getAllByTestId(/^tile-/).length;
    for (let i = 0; i < tileCount; i++) {
      const tiles = screen.getAllByTestId(/^tile-/);
      fireEvent.click(tiles[0]);
    }
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders the Thai hint card with a play-audio button', () => {
    render(<EggHatch />);
    expect(screen.getByRole('button', { name: /hear the meaning/i })).toBeInTheDocument();
  });

  it('does not grade (no ✓/✗ feedback) when the last slot is filled before Submit', () => {
    render(<EggHatch />);
    const tileCount = screen.getAllByTestId(/^tile-/).length;
    for (let i = 0; i < tileCount; i++) {
      fireEvent.click(screen.getAllByTestId(/^tile-/)[0]);
    }
    // Submit is now showing, but grading has NOT run: no ✓/✗ feedback overlay yet.
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('✗')).not.toBeInTheDocument();
  });

  it('plays the Thai hint when the 🔊 button is tapped', () => {
    speech.speakThai.mockClear();
    render(<EggHatch />);
    fireEvent.click(screen.getByRole('button', { name: /hear the meaning/i }));
    expect(speech.speakThai).toHaveBeenCalledTimes(1);
  });
});
