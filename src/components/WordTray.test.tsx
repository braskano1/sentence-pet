// src/components/WordTray.test.tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import { WordTray } from './WordTray';

function renderTray(tiles: string[], used: boolean[]) {
  return render(
    <DndContext>
      <WordTray tiles={tiles} used={used} />
    </DndContext>,
  );
}

describe('WordTray', () => {
  it('renders a draggable button for each unused tile', () => {
    renderTray(['I', 'run'], [false, false]);
    expect(screen.getByRole('button', { name: 'I' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'run' })).toBeInTheDocument();
  });

  it('does not render tiles already used', () => {
    renderTray(['I', 'run'], [true, false]);
    expect(screen.queryByRole('button', { name: 'I' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'run' })).toBeInTheDocument();
  });
});
