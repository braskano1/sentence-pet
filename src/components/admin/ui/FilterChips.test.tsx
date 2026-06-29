import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips } from './FilterChips';

const CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'dragdrop', label: 'dragdrop' },
  { id: 'matching', label: 'matching' },
] as const;

describe('FilterChips', () => {
  it('renders one button per chip inside a labelled group', () => {
    render(<FilterChips chips={CHIPS} active="all" onChange={() => {}} label="Filter by kind" />);
    expect(screen.getByRole('group', { name: /filter by kind/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks the active chip with aria-pressed', () => {
    render(<FilterChips chips={CHIPS} active="dragdrop" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'dragdrop' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onChange with the chip id when clicked', () => {
    const onChange = vi.fn();
    render(<FilterChips chips={CHIPS} active="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'matching' }));
    expect(onChange).toHaveBeenCalledWith('matching');
  });
});
