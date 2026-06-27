import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { orderedUnits } from '../../content/model';
import { SEED } from '../../content/seed';
import { FoldedUnitBar } from './FoldedUnitBar';

const u1 = orderedUnits(SEED)[0];
const allCleared = Object.fromEntries(u1.lessons.map((l) => [l.id, 3]));

describe('FoldedUnitBar', () => {
  it('shows the unit title and total stars, and is collapsed (aria-expanded=false)', () => {
    render(<FoldedUnitBar unit={u1} stars={allCleared} onExpand={vi.fn()} />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /expand Basics/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn.textContent).toContain('12');
  });

  it('calls onExpand when clicked', () => {
    const onExpand = vi.fn();
    render(<FoldedUnitBar unit={u1} stars={allCleared} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: /expand Basics/i }));
    expect(onExpand).toHaveBeenCalledWith(u1.id);
  });
});
