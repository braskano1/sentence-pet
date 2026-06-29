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

describe('DexGrid per-line', () => {
  // A 3-stage authored line (clone builtin stat bands so the defs are valid).
  const bands = BUILTIN_PET_DEFS[0].statBands;
  const baby = { id: 'ln-baby', name: 'Sprig', gen: 3, dexNo: 1, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesToId: 'ln-young' };
  const young = { id: 'ln-young', name: 'Sapling', gen: 3, dexNo: 2, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-baby', evolvesToId: 'ln-adult' };
  const adult = { id: 'ln-adult', name: 'Timberon', gen: 3, dexNo: 3, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-young' };

  it('collapses a 3-stage line into ONE card showing the latest caught stage', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young'] });
    });
    const { container } = render(<DexGrid />);
    expect(screen.getByText('Sapling')).toBeInTheDocument();
    expect(screen.queryByText('Sprig')).not.toBeInTheDocument();
    expect(screen.queryByText('Timberon')).not.toBeInTheDocument();
    expect(screen.getByText('Young')).toBeInTheDocument();
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    expect(imgs.some((img) => img.src.includes('young'))).toBe(true);
  });

  it('shows the tip stage label once the line is fully caught', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young', 'ln-adult'] });
    });
    render(<DexGrid />);
    expect(screen.getByText('Timberon')).toBeInTheDocument();
    expect(screen.getByText('Adult')).toBeInTheDocument();
  });

  it('shows ??? with no stage label for an undiscovered line', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: [] });
    });
    const { container } = render(<DexGrid />);
    expect(screen.getAllByText('???').length).toBe(5);
    expect(screen.queryByText('Sapling')).not.toBeInTheDocument();
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    expect(imgs.some((img) => img.src.includes('baby'))).toBe(true);
  });

  it('does not count creatures from a hidden (disabled-root) line in the counter', () => {
    const hiddenRoot = { id: 'hr-baby', name: 'Hidden', gen: 4, dexNo: 1, types: ['fire'], element: 'fire' as const, statBands: bands, enabled: false, evolvesToId: 'hr-adult' };
    const enabledChild = { id: 'hr-adult', name: 'Shown', gen: 4, dexNo: 2, types: ['fire'], element: 'fire' as const, statBands: bands, enabled: true, evolvesFromId: 'hr-baby' };
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, hiddenRoot, enabledChild]);
      useGameStore.setState({ caughtDefIds: [] });
    });
    render(<DexGrid />);
    // 4 builtin lines are visible; the disabled-root line is hidden, so its
    // enabled child must NOT appear in the denominator. Y must be 4, not 5.
    expect(screen.getByText(/caught\s*0\s*\/\s*4/i)).toBeInTheDocument();
  });
});
