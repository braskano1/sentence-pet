// src/components/StatBars.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatBars } from './StatBars';

describe('StatBars', () => {
  const bars = { protein: 50, veggie: 50, vitamin: 50, treat: 50 };

  it('renders Health, Happiness and all four nutrition bars', () => {
    render(<StatBars bars={bars} happiness={42} />);
    expect(screen.getByText(/Health/)).toBeInTheDocument();
    expect(screen.getByText(/Happiness/)).toBeInTheDocument();
    expect(screen.getByText(/Protein/)).toBeInTheDocument();
    expect(screen.getByText(/Veggie/)).toBeInTheDocument();
    expect(screen.getByText(/Vitamin/)).toBeInTheDocument();
    expect(screen.getByText(/Treat/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
