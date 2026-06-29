import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, SectionLabel } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>inner</p></Card>);
    expect(screen.getByText('inner')).toBeInTheDocument();
  });
});

describe('SectionLabel', () => {
  it('renders its text', () => {
    render(<SectionLabel>Identity</SectionLabel>);
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });
});
