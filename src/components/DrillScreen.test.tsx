// src/components/DrillScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { DrillScreen } from './DrillScreen';
import { useGameStore } from '../state/gameStore';
import { SEED } from '../content/seed';
import { itemsForDrill } from '../content/model';

describe('DrillScreen', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
  });

  it('renders the Thai hint and the POS slots for the first item', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'pattern', 1)} drill="pattern" level={1} />);
    expect(screen.getByText(/Sentence 1 of 5/)).toBeInTheDocument();
    expect(screen.getAllByText('Pronoun').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verb').length).toBeGreaterThan(0);
  });

  it('renders a draggable tile for each answer word', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'pattern', 1)} drill="pattern" level={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('word-choice tray includes the distractor tiles', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'wordChoice', 1)} drill="wordChoice" level={1} />);
    // first wordChoice L1 item: answer ['I','run'] + distractors ['runs','running']
    expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'running' })).toBeInTheDocument();
  });

  it('mounts inside a DndContext without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen items={itemsForDrill(SEED, 'pattern', 2)} drill="pattern" level={2} />
        </DndContext>,
      ),
    ).not.toThrow();
  });

  it('grammar tray includes the agreement trap tile', () => {
    render(<DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />);
    // first grammar L1 item: answer ['he','eats'] + trap 'eat'
    expect(screen.getByRole('button', { name: 'eat' })).toBeInTheDocument();
  });

  it('mounts for grammar without throwing', () => {
    expect(() =>
      render(
        <DndContext>
          <DrillScreen items={itemsForDrill(SEED, 'grammar', 1)} drill="grammar" level={1} />
        </DndContext>,
      ),
    ).not.toThrow();
  });
});
