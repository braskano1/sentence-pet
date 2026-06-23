import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders its children inside the column', () => {
    render(<AppShell><p>hello</p></AppShell>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders a rotate nudge (hidden unless landscape)', () => {
    render(<AppShell><p>hello</p></AppShell>);
    expect(screen.getByText(/rotate/i)).toBeInTheDocument();
  });
});
