import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminRail } from './AdminRail';
import type { RailGroup } from './AdminRail';

const GROUPS: RailGroup<string>[] = [
  { heading: 'Workspace', items: [{ id: 'courses', label: 'Courses', count: 3 }] },
  { heading: 'Course · Thai', items: [
    { id: 'pool', label: 'Items', count: 214 },
    { id: 'journey', label: 'Journey', count: 8 },
    { id: 'bosses', label: 'Bosses', count: 10 },
  ] },
  { heading: 'Creatures · global', items: [{ id: 'pets', label: 'Pets', count: 63 }] },
];

describe('AdminRail', () => {
  it('renders group headings, labels, and counts inside a tablist', () => {
    render(<AdminRail groups={GROUPS} active="courses" onSelect={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /items/i })).toHaveTextContent('214');
  });

  it('marks the active item aria-selected and fires onSelect on click', () => {
    const onSelect = vi.fn();
    render(<AdminRail groups={GROUPS} active="pool" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: /items/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /journey/i }));
    expect(onSelect).toHaveBeenCalledWith('journey');
  });

  it('moves selection with ArrowDown across the flattened item order', () => {
    const onSelect = vi.fn();
    render(<AdminRail groups={GROUPS} active="courses" onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: /courses/i }), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('pool');
  });

  it('wraps with ArrowUp from the first item to the last', () => {
    const onSelect = vi.fn();
    render(<AdminRail groups={GROUPS} active="courses" onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: /courses/i }), { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('pets');
  });
});
