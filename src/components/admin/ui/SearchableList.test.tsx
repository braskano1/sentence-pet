import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SearchableList } from './SearchableList';

type Row = { id: string; text: string };
const ROWS: Row[] = [
  { id: 'a', text: 'order food now' },
  { id: 'b', text: 'where is the toilet' },
  { id: 'c', text: 'order the soup' },
];

/** Wrapper so the controlled query/selection have real state in tests. */
function Harness({ items = ROWS }: { items?: Row[] }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  return (
    <SearchableList
      items={items}
      total={items.length}
      getKey={(r) => r.id}
      selectedKey={sel}
      onSelect={setSel}
      searchText={(r) => `${r.text} ${r.id}`}
      query={q}
      onQuery={setQ}
      renderRow={(r) => <span>{r.text}</span>}
    />
  );
}

describe('SearchableList', () => {
  it('renders all rows and a "N of M" count when query is empty', () => {
    render(<Harness />);
    expect(screen.getByText('order food now')).toBeInTheDocument();
    expect(screen.getByText('where is the toilet')).toBeInTheDocument();
    expect(screen.getByText(/3 of 3/i)).toBeInTheDocument();
  });

  it('filters rows by searchText as the user types', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'order' } });
    expect(screen.getByText('order food now')).toBeInTheDocument();
    expect(screen.getByText('order the soup')).toBeInTheDocument();
    expect(screen.queryByText('where is the toilet')).not.toBeInTheDocument();
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it('marks the selected row with aria-current and fires onSelect', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('order the soup'));
    const row = screen.getByText('order the soup').closest('button')!;
    expect(row).toHaveAttribute('aria-current', 'true');
  });
});
