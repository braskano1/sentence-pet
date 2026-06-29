import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { DexGrid } from './DexGrid';
import { useGameStore } from '../state/gameStore';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';

beforeEach(() => useGameStore.getState().resetForTest());
afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore the registry after swaps

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

  it('reflects a catalog swap (async hydration) without remount', () => {
    render(<DexGrid />);
    expect(screen.getByText(/caught\s*1\s*\/\s*4/i)).toBeInTheDocument();

    // Simulate hydratePetDefs resolving after mount with a newly-published 5th def.
    const newDef = { ...BUILTIN_PET_DEFS[1], id: 'def-gen2', name: 'Newbie', gen: 2, dexNo: 1 };
    act(() => setActivePetDefs([...BUILTIN_PET_DEFS, newDef]));

    expect(screen.getByText(/caught\s*1\s*\/\s*5/i)).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(4); // 4 undiscovered (3 builtins + new)
  });
});
