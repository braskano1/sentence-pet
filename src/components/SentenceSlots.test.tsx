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
        <SentenceSlots slots={['Pronoun', 'Verb']} placed={['i', 'run']} onClearSlot={() => {}} />
      </DndContext>,
    );
    expect(screen.getByText('I')).toBeInTheDocument(); // first slot capitalized
    expect(screen.getByText('run')).toBeInTheDocument();
  });

  it('calls onClearSlot when a filled slot is tapped', async () => {
    const onClearSlot = vi.fn();
    render(
      <DndContext>
        <SentenceSlots slots={['Pronoun', 'Verb']} placed={['i', null]} onClearSlot={onClearSlot} />
      </DndContext>,
    );
    await userEvent.click(screen.getByText('I'));
    expect(onClearSlot).toHaveBeenCalledWith(0);
  });
});
