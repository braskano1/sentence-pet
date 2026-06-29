import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationSummary } from './ValidationSummary';

describe('ValidationSummary', () => {
  it('lists each error', () => {
    render(<ValidationSummary errors={['bad gen', 'dup dexNo']} />);
    expect(screen.getByText(/bad gen/)).toBeInTheDocument();
    expect(screen.getByText(/dup dexNo/)).toBeInTheDocument();
  });

  it('renders an sr-only live region (no visible error box) when there are no errors', () => {
    const { container } = render(<ValidationSummary errors={[]} />);
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list!.className).toMatch(/sr-only/);
  });
});
