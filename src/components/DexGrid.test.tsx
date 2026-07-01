import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { DexGrid } from './DexGrid';
import { useGameStore } from '../state/gameStore';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';

beforeEach(() => useGameStore.getState().resetForTest());
afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore the registry after swaps

// A 3-stage authored leaf line, cloned stat bands so the defs validate.
const bands = BUILTIN_PET_DEFS[0].statBands;
const baby = { id: 'ln-baby', name: 'Sprig', gen: 3, dexNo: 1, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesToId: 'ln-young' };
const young = { id: 'ln-young', name: 'Sapling', gen: 3, dexNo: 2, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-baby', evolvesToId: 'ln-adult' };
const adult = { id: 'ln-adult', name: 'Timberon', gen: 3, dexNo: 3, types: ['leaf'], element: 'leaf' as const, statBands: bands, enabled: true, evolvesFromId: 'ln-young' };

describe('DexGrid', () => {
  it('uses a grid-rows layout with the pan viewport as a direct child of the root', () => {
    // Layout regression guard: the pan world must sit in a strict 1fr grid track
    // (not a flex-1 div, whose min-height:auto grows to content and zeroes the pan
    // range). We can't exercise the pan itself under jsdom (PanViewport's measure
    // no-ops — getBoundingClientRect returns 0), so this pins the structure only.
    const { container } = render(<DexGrid />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('grid');
    expect(root.className).toContain('grid-rows-[auto_1fr]');
    // PanViewport's root is `relative h-full overflow-hidden`; assert it's a DIRECT
    // child of the grid root (no intervening flex-1 wrapper).
    const viewport = Array.from(root.children).find((el) =>
      el.className.includes('overflow-hidden'),
    ) as HTMLElement | undefined;
    expect(viewport).toBeDefined();
    expect(viewport!.className).toContain('h-full');
  });

  it('shows a lines + forms count and renders a card per enabled line', () => {
    render(<DexGrid />);
    // built-in catalog has 4 single-form lines; starter (def-leaf) is caught.
    // 1/4 lines caught, 1/4 forms caught.
    expect(screen.getByText(/caught\s*1\s*\/\s*4\s*lines/i)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*4\s*forms/i)).toBeInTheDocument();
  });

  it('shows full art for caught lines and ??? for undiscovered ones', () => {
    render(<DexGrid />);
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(3);
  });

  it('opens the chain detail when a card is clicked', () => {
    render(<DexGrid />);
    fireEvent.click(screen.getByRole('button', { name: /leaflet/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('reflects a catalog swap (async hydration) without remount', () => {
    render(<DexGrid />);
    expect(screen.getByText(/caught\s*1\s*\/\s*4\s*lines/i)).toBeInTheDocument();

    // Simulate hydratePetDefs resolving after mount with a newly-published 5th def.
    const newDef = { ...BUILTIN_PET_DEFS[1], id: 'def-gen2', name: 'Newbie', gen: 2, dexNo: 1 };
    act(() => setActivePetDefs([...BUILTIN_PET_DEFS, newDef]));

    expect(screen.getByText(/caught\s*1\s*\/\s*5\s*lines/i)).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(4); // 4 undiscovered (3 builtins + new)
  });

  it('first-run (0 caught) shows the catch hint', () => {
    act(() => useGameStore.setState({ caughtDefIds: [] }));
    render(<DexGrid />);
    expect(screen.getByText(/caught\s*0\s*\/\s*4\s*lines/i)).toBeInTheDocument();
    expect(screen.getByText(/catch pets in battles and eggs/i)).toBeInTheDocument();
  });

  it('hides the catch hint once at least one line is caught', () => {
    render(<DexGrid />); // starter caught by default
    expect(screen.queryByText(/catch pets in battles and eggs/i)).not.toBeInTheDocument();
  });
});

describe('DexGrid per-line badge', () => {
  it('collapses a 3-stage line into ONE card showing the latest caught stage', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young'] });
    });
    const { container } = render(<DexGrid />);
    expect(screen.getByText('Sapling')).toBeInTheDocument();
    expect(screen.queryByText('Sprig')).not.toBeInTheDocument();
    expect(screen.queryByText('Timberon')).not.toBeInTheDocument();
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    expect(imgs.some((img) => img.src.includes('young'))).toBe(true);
  });

  it('shows an X/N chain-progress badge (2/3 partly caught)', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young'] });
    });
    render(<DexGrid />);
    const card = screen.getByRole('button', { name: /sapling/i });
    expect(within(card).getByText('2/3')).toBeInTheDocument();
  });

  it('shows 3/3 once the line is fully caught', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: ['ln-baby', 'ln-young', 'ln-adult'] });
    });
    render(<DexGrid />);
    const card = screen.getByRole('button', { name: /timberon/i });
    expect(within(card).getByText('3/3')).toBeInTheDocument();
  });

  it('shows 0/3 (with ??? name) for an undiscovered multi-stage line', () => {
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, baby, young, adult]);
      useGameStore.setState({ caughtDefIds: [] });
    });
    const { container } = render(<DexGrid />);
    expect(screen.getAllByText('???').length).toBe(5);
    expect(screen.getByText('0/3')).toBeInTheDocument();
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    expect(imgs.some((img) => img.src.includes('baby'))).toBe(true);
  });

  it('does not count creatures from a hidden (disabled-root) line', () => {
    const hiddenRoot = { id: 'hr-baby', name: 'Hidden', gen: 4, dexNo: 1, types: ['fire'], element: 'fire' as const, statBands: bands, enabled: false, evolvesToId: 'hr-adult' };
    const enabledChild = { id: 'hr-adult', name: 'Shown', gen: 4, dexNo: 2, types: ['fire'], element: 'fire' as const, statBands: bands, enabled: true, evolvesFromId: 'hr-baby' };
    act(() => {
      setActivePetDefs([...BUILTIN_PET_DEFS, hiddenRoot, enabledChild]);
      useGameStore.setState({ caughtDefIds: [] });
    });
    render(<DexGrid />);
    // 4 builtin lines visible; the disabled-root line is hidden.
    expect(screen.getByText(/caught\s*0\s*\/\s*4\s*lines/i)).toBeInTheDocument();
  });
});

// Element chip accessible names come from PET_NAME (leaf=Sprout, fire=Ember, air=Breeze, water=Bubble).
describe('DexGrid element filter', () => {
  it('filters to a single element when its chip is tapped', () => {
    render(<DexGrid />);
    // Tap the fire (Ember) chip -> only fire root(s) show; Leaflet (leaf) hidden.
    fireEvent.click(screen.getByRole('button', { name: /^ember$/i }));
    expect(screen.queryByText('Leaflet')).not.toBeInTheDocument();
    // Header count still reflects the full catalog (filters don't change it).
    expect(screen.getByText(/caught\s*1\s*\/\s*4\s*lines/i)).toBeInTheDocument();
    // Only the fire line shows: it's uncaught so it renders as a single ??? card.
    expect(screen.getAllByText('???').length).toBe(1);
  });

  it('All chip restores the full catalog', () => {
    render(<DexGrid />);
    fireEvent.click(screen.getByRole('button', { name: /^ember$/i }));
    expect(screen.queryByText('Leaflet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /all elements/i }));
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
  });

  it('an element chip is aria-pressed when active', () => {
    render(<DexGrid />);
    const fire = screen.getByRole('button', { name: /^ember$/i });
    expect(fire).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(fire);
    expect(fire).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DexGrid progress toggle', () => {
  it('Caught shows only caught lines; Missing shows only uncaught', () => {
    render(<DexGrid />); // leaf line caught
    fireEvent.click(screen.getByRole('button', { name: /^caught$/i }));
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
    expect(screen.queryAllByText('???').length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /^missing$/i }));
    expect(screen.queryByText('Leaflet')).not.toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBe(3);
  });

  it('composes element + progress filters and shows friendly empty copy', () => {
    render(<DexGrid />);
    // Leaf (Sprout): 1 line, caught. Missing + leaf -> empty -> "all caught!".
    fireEvent.click(screen.getByRole('button', { name: /^sprout$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^missing$/i }));
    expect(screen.getByText(/no missing .*sprout pets — all caught!/i)).toBeInTheDocument();
  });

  it('shows "none caught yet" empty copy for Caught + an uncaught element', () => {
    render(<DexGrid />);
    // Fire (Ember) has no caught line by default.
    fireEvent.click(screen.getByRole('button', { name: /^ember$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^caught$/i }));
    expect(screen.getByText(/no .*ember pets caught yet/i)).toBeInTheDocument();
  });
});
