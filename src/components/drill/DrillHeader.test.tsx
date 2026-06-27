import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrillHeader } from './DrillHeader';

describe('DrillHeader', () => {
  it('renders a Leave-drill button that calls onExit when clicked', () => {
    const onExit = vi.fn();
    render(<DrillHeader streak={0} index={0} total={5} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /leave drill/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('renders the streak count and one track node per item', () => {
    render(<DrillHeader streak={3} index={1} total={5} onExit={() => {}} />);
    expect(screen.getByTestId('streak')).toHaveTextContent('3');
    expect(screen.getAllByTestId(/^track-node-/)).toHaveLength(5);
  });
});
