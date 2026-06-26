import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WhyTip } from './WhyTip';

describe('WhyTip', () => {
  it('renders the tip text in a live region', () => {
    render(<WhyTip text="feeds (he/she) takes -s" />);
    const tip = screen.getByTestId('why-tip');
    expect(tip).toHaveTextContent('feeds (he/she) takes -s');
    expect(tip).toHaveAttribute('role', 'status');
  });
});
