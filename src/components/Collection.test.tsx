import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Collection } from './Collection';
import { useGameStore } from '../state/gameStore';
import { makePet, rollStats } from '../domain/pets';
import { BUILTIN_PET_DEFS, setActivePetDefs } from '../domain/petDef';
import { SPRITES } from '../config/sprites';
import type { PetDef } from '../data/types';

beforeEach(() => useGameStore.getState().resetForTest());

function addPet(id: string, species: 'leaf' | 'fire' | 'air' | 'water') {
  useGameStore.setState((s) => ({
    pets: [...s.pets, makePet({ id, species, stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
  }));
}

describe('Collection', () => {
  it('shows the active pet detail with its Dex name; radar is behind the Stats tap', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    // CHANGED (redesign): the radar is now collapsed by default (calm hero) — it appears
    // only after tapping the "Stats" toggle, so assert it's ABSENT first, then present.
    expect(screen.queryByRole('img', { name: /battle stat radar/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^stats/i }));
    expect(screen.getByRole('img', { name: /battle stat radar/i })).toBeInTheDocument();
    // CHANGED (Bug 2): an unnamed pet now shows its def's authored Dex name, not the
    // PET_NAME element name. The leaf starter's def (def-leaf) is authored 'Leaflet'.
    expect(screen.getAllByText('Leaflet').length).toBeGreaterThan(0);
  });

  it('lists every owned pet in the roster and switches active on tap', () => {
    useGameStore.getState().hatch();
    addPet('p2', 'fire');
    render(<Collection />);
    expect(screen.getByText(/my pets \(2\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /raise ember/i }));
    expect(useGameStore.getState().activePetId).toBe('p2');
  });

  it('Back returns to the pet room', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /back to room/i }));
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('shows the element strong/weak line for the active pet (inside the Stats panel)', () => {
    useGameStore.getState().hatch(); // starter is leaf -> strong vs water (Bubble), weak vs air (Breeze)
    render(<Collection />);
    // CHANGED (redesign): the Strong/Weak matchup line moved off the calm hero into the
    // Stats panel (behind a tap); expand it before asserting.
    fireEvent.click(screen.getByRole('button', { name: /^stats/i }));
    const strong = screen.getByText(/strong vs/i);
    expect(strong.textContent).toMatch(/bubble/i);
    const weak = screen.getByText(/weak vs/i);
    expect(weak.textContent).toMatch(/breeze/i);
  });

  it('renames the active pet via the pencil + Save', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /pet name/i }), { target: { value: 'Leafy' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(useGameStore.getState().pets[0].name).toBe('Leafy');
  });

  it('detail card reflects growth in displayed stats', () => {
    useGameStore.getState().resetForTest();
    useGameStore.setState((s) => ({
      pets: s.pets.map((p) => ({
        ...p, hatched: true,
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 7, atk: 0, def: 0, spd: 0, luk: 0 },
      })),
    }));
    render(<Collection />);
    // CHANGED (redesign): the radar (which shows the 57 growth value) is behind the Stats
    // tap now; expand it before asserting the value renders.
    fireEvent.click(screen.getByRole('button', { name: /^stats/i }));
    // base 50 + growth 7 = 57 shown (radar value tspan)
    expect(screen.getAllByText('57').length).toBeGreaterThan(0);
  });
});

describe('Collection — My Pets redesign (hero / stats / controls / pan roster)', () => {
  it('Stats toggle shows and hides the radar', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    const toggle = screen.getByRole('button', { name: /^stats/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img', { name: /battle stat radar/i })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: /battle stat radar/i })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('element chip filters the roster', () => {
    useGameStore.getState().hatch(); // leaf starter (active → labelled "Leaflet (active)")
    addPet('p2', 'fire');
    render(<Collection />);
    // Both roster tiles visible by default (Leaflet active + Embers).
    expect(screen.getByRole('button', { name: /leaflet \(active\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raise embers/i })).toBeInTheDocument();
    // Filter to fire only.
    fireEvent.click(screen.getByRole('button', { name: /^ember$/i }));
    expect(screen.queryByRole('button', { name: /leaflet/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raise embers/i })).toBeInTheDocument();
  });

  it('search filters the roster by name', () => {
    useGameStore.getState().hatch(); // Leaflet
    addPet('p2', 'fire'); // Embers
    render(<Collection />);
    fireEvent.change(screen.getByRole('textbox', { name: /search your pets/i }), { target: { value: 'ember' } });
    expect(screen.getByRole('button', { name: /raise embers/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /raise leaflet/i })).not.toBeInTheDocument();
  });

  it('empty search shows friendly no-match copy', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.change(screen.getByRole('textbox', { name: /search your pets/i }), { target: { value: 'zzzz' } });
    expect(screen.getByText(/no pets match "zzzz"/i)).toBeInTheDocument();
  });

  it('Name sort reorders the roster alphabetically', () => {
    useGameStore.getState().hatch();
    addPet('p2', 'fire');
    addPet('p3', 'water');
    // give deterministic names so alpha order is obvious (the starter is 'starter-leaf')
    useGameStore.getState().renamePet('starter-leaf', 'Zebra');
    useGameStore.getState().renamePet('p2', 'Apple');
    useGameStore.getState().renamePet('p3', 'Mango');
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /^name$/i }));
    // Read the visible tile name labels (title attr) in DOM order.
    const ordered = screen
      .getAllByTitle(/zebra|apple|mango/i)
      .map((el) => el.getAttribute('title') ?? '');
    expect(ordered).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('rename Cancel reverts without changing the name', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /pet name/i }), { target: { value: 'Nope' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useGameStore.getState().pets[0].name).toBe('');
    expect(screen.queryByRole('textbox', { name: /pet name/i })).not.toBeInTheDocument();
  });

  it('rename Esc reverts without changing the name', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /pet name/i });
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useGameStore.getState().pets[0].name).toBe('');
    expect(screen.queryByRole('textbox', { name: /pet name/i })).not.toBeInTheDocument();
  });

  it('Save is disabled when the draft is empty', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /pet name/i }), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });
});

describe('Collection dex tab', () => {
  it('switches to the Dex tab and shows the caught count', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('tab', { name: /^dex$/i }));
    expect(screen.getByText(/caught\s*\d+\s*\/\s*\d+/i)).toBeInTheDocument();
  });

  it('keeps the My Pets roster on the default tab', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    expect(screen.getAllByText(/my pets/i).length).toBeGreaterThan(0);
  });
});

// Regression: the My Pets tab reads petStageSprite (which resolves the active
// pet-def catalog singleton) but subscribes only to gameStore. On a fresh load
// the Firestore catalog hydrates AFTER paint via setActivePetDefs(...); without a
// pet-def subscription the portrait/roster stay stuck on element art. Collection
// must re-render on that swap.
describe('Collection — owned-pet art tracks async catalog hydration', () => {
  afterEach(() => setActivePetDefs([...BUILTIN_PET_DEFS])); // restore the registry after swaps

  const PLAIN_LEAF = BUILTIN_PET_DEFS[0]; // def-leaf, no sprite override (pre-hydration snapshot)
  const ART_LEAF: PetDef = { ...PLAIN_LEAF, sprite: { default: 'https://cdn.test/leaf-real.webp' } };

  it('re-renders the portrait from element art to def art on setActivePetDefs swap (no remount)', () => {
    // A hatched leaf pet at baby stage (xp 0) owning the leaf def.
    const pet = makePet({ id: 'p1', species: 'leaf', stats: rollStats(() => 0.5), rarity: 'common', hatched: true, defId: PLAIN_LEAF.id });
    act(() => useGameStore.setState({ pets: [pet], activePetId: 'p1' }));

    // Pre-hydration: catalog has the plain (no-art) leaf def → plain element art.
    render(<Collection />);
    const portrait = screen.getByRole('img', { name: 'Sprout' }); // PET_NAME.leaf = Sprout
    expect(portrait.getAttribute('src')).toBe(SPRITES.leaf.baby.happy);

    // Firestore hydration resolves after paint and swaps in the def WITH art.
    act(() => setActivePetDefs([ART_LEAF, ...BUILTIN_PET_DEFS.slice(1)]));

    expect(screen.getByRole('img', { name: 'Sprout' }).getAttribute('src')).toBe('https://cdn.test/leaf-real.webp');
  });
});
