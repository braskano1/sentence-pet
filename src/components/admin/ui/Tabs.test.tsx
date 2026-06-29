import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './Tabs';

const TABS = [
  { id: 'pool', label: 'Pool' },
  { id: 'journey', label: 'Journey' },
  { id: 'bosses', label: 'Bosses' },
] as const;

describe('Tabs', () => {
  it('renders one tab per item inside a tablist', () => {
    render(<Tabs tabs={TABS} active="pool" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={TABS} active="journey" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /journey/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /pool/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onChange with the tab id when clicked', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="pool" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /bosses/i }));
    expect(onChange).toHaveBeenCalledWith('bosses');
  });

  it('moves selection with the right/left arrow keys (roving)', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="pool" onChange={onChange} />);
    const active = screen.getByRole('tab', { name: /pool/i });
    fireEvent.keyDown(active, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('journey');
    fireEvent.keyDown(active, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('bosses'); // wraps to last
  });
});
