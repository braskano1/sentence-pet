// src/components/WordTray.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
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

  it('calls onTapPlace with the tile index when a tile is tapped', () => {
    const onTapPlace = vi.fn();
    render(<DndContext><WordTray tiles={['She', 'feeds']} used={[false, false]} onTapPlace={onTapPlace} /></DndContext>);
    fireEvent.click(screen.getByTestId('tile-feeds'));
    expect(onTapPlace).toHaveBeenCalledWith(1);
  });
});
