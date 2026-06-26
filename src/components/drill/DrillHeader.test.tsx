import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrillHeader } from './DrillHeader';

describe('DrillHeader', () => {
  it('shows the streak count and a node per round item', () => {
    render(<DrillHeader streak={3} index={1} total={5} />);
    expect(screen.getByTestId('streak')).toHaveTextContent('3');
    expect(screen.getAllByTestId(/^track-node-/)).toHaveLength(5);
  });
});
