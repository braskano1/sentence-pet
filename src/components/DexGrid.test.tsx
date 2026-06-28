import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DexGrid } from './DexGrid';
import { useGameStore } from '../state/gameStore';

beforeEach(() => useGameStore.getState().resetForTest());

describe('DexGrid', () => {
  it('shows a caught/total count and renders a tile per enabled def', () => {
    render(<DexGrid />);
    // built-in catalog has 4 enabled defs; starter (def-leaf) is caught
    expect(screen.getByText(/caught\s*1\s*\/\s*4/i)).toBeInTheDocument();
  });

  it('shows full art for caught defs and ??? for undiscovered ones', () => {
    render(<DexGrid />);
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(3);
  });

  it('opens the chain detail when a tile is clicked', () => {
    render(<DexGrid />);
    fireEvent.click(screen.getByRole('button', { name: /leaflet/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
