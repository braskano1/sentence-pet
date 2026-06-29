import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignList } from './AssignList';

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

function setup(selected: string[] = ['a']) {
  const onToggle = vi.fn();
  render(
    <AssignList
      items={rows}
      getKey={(r) => r.id}
      isSelected={(r) => selected.includes(r.id)}
      onToggle={onToggle}
      searchText={(r) => `${r.name} ${r.id}`}
      ariaLabel={(r) => `item ${r.id}`}
      renderLabel={(r) => `${r.name} · ${r.id}`}
      placeholder="Search pool…"
    />,
  );
  return { onToggle };
}

describe('AssignList', () => {
  it('renders a checkbox per item with its selected state', () => {
    setup(['a']);
    expect(screen.getByRole('checkbox', { name: 'item a' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'item b' })).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles an item on click', () => {
    const { onToggle } = setup([]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'item b' }));
    expect(onToggle).toHaveBeenCalledWith(rows[1]);
  });

  it('filters rows by the search query', () => {
    setup([]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'brav' } });
    expect(screen.getByRole('checkbox', { name: 'item b' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'item a' })).toBeNull();
  });

  it('shows the empty hint when nothing matches', () => {
    setup([]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });
});
