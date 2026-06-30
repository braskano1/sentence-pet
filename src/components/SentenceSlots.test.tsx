// src/components/SentenceSlots.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
import { SentenceSlots } from './SentenceSlots';

describe('SentenceSlots', () => {
  it('capitalizes the first placed word for display', () => {
    render(
      <DndContext>
        <SentenceSlots slots={['Subject', 'Verb']} placed={['i', 'run']} onClearSlot={() => {}} />
      </DndContext>,
    );
    expect(screen.getByText('I')).toBeInTheDocument(); // first slot capitalized
    expect(screen.getByText('run')).toBeInTheDocument();
  });

  it('calls onClearSlot when a filled slot is tapped', async () => {
    const onClearSlot = vi.fn();
    render(
      <DndContext>
        <SentenceSlots slots={['Subject', 'Verb']} placed={['i', null]} onClearSlot={onClearSlot} />
      </DndContext>,
    );
    await userEvent.click(screen.getByText('I'));
    expect(onClearSlot).toHaveBeenCalledWith(0);
  });

  it('highlights the current (leftmost empty) slot', () => {
    render(
      <DndContext>
        <SentenceSlots slots={['Subject', 'Verb', 'Object']} placed={['She', null, null]} onClearSlot={() => {}} />
      </DndContext>,
    );
    expect(screen.getByTestId('slot-1')).toHaveClass('border-emerald-500');
  });

  it('colors a filled slot by its part of speech', () => {
    render(
      <DndContext>
        <SentenceSlots slots={['Subject', 'Verb', 'Object']} placed={['She', 'feeds', null]} onClearSlot={() => {}} />
      </DndContext>,
    );
    expect(screen.getByTestId('slot-1')).toHaveClass('bg-emerald-100');
  });

  describe('hidePos', () => {
    it('shows the POS label when hidePos is false', () => {
      render(
        <DndContext>
          <SentenceSlots slots={['Subject']} placed={[null]} onClearSlot={() => {}} hidePos={false} />
        </DndContext>,
      );
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    it('hides the POS label when hidePos is true', () => {
      render(
        <DndContext>
          <SentenceSlots slots={['Subject']} placed={[null]} onClearSlot={() => {}} hidePos />
        </DndContext>,
      );
      expect(screen.queryByText('Subject')).toBeNull();
    });

    it('skips the POS color tint on a filled slot when hidePos is true', () => {
      render(
        <DndContext>
          <SentenceSlots slots={['Subject', 'Verb', 'Object']} placed={['She', 'feeds', null]} onClearSlot={() => {}} hidePos />
        </DndContext>,
      );
      const filled = screen.getByTestId('slot-1');
      expect(filled).not.toHaveClass('bg-emerald-100');
      expect(filled).toHaveClass('bg-white'); // neutral fallback
    });
  });
});
