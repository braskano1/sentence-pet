import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const savePetDefs = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  savePetDefs: (d: unknown) => savePetDefs(d),
  fetchPetDefs: vi.fn(),
}));
const writePetDefsCache = vi.fn();
vi.mock('../../content/cache', () => ({ writePetDefsCache: (d: unknown) => writePetDefsCache(d) }));

import { PetsTab, reconcileEvolution } from './PetsTab';
import type { PetDef } from '../../data/types';
import { BUILTIN_PET_DEFS, getActivePetDefs as active, setActivePetDefs } from '../../domain/petDef';

beforeEach(() => {
  savePetDefs.mockClear();
  writePetDefsCache.mockClear();
  setActivePetDefs([...BUILTIN_PET_DEFS]); // reset module-level registry between tests
});

describe('PetsTab — list + save', () => {
  it('lists every active def by name (seeded from getActivePetDefs)', () => {
    render(<PetsTab />);
    for (const d of active()) {
      expect(screen.getAllByText(new RegExp(d.name)).length).toBeGreaterThan(0);
    }
  });

  it('Save is enabled for the builtins and calls savePetDefs + swaps the live registry', async () => {
    render(<PetsTab />);
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    expect(writePetDefsCache).toHaveBeenCalled();
    expect(active().map((d) => d.id)).toEqual(BUILTIN_PET_DEFS.map((d) => d.id));
    expect(savePetDefs.mock.calls[0][0]).toHaveLength(BUILTIN_PET_DEFS.length);
  });
});

describe('PetsTab — add / delete / filter', () => {
  it('Add creates a new def with a unique id and the next free dexNo', () => {
    render(<PetsTab />);
    const before = screen.getAllByRole('listitem').length;
    fireEvent.click(screen.getByRole('button', { name: /add pet/i }));
    expect(screen.getAllByRole('listitem').length).toBe(before + 1);
    // builtins are gen1 dexNo 1..4, so the new gen-1 def gets dexNo 5
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it('Delete removes a def', () => {
    render(<PetsTab />);
    // delete the last builtin (Dewdrop / water) — not the starter, not the last enabled
    fireEvent.click(screen.getByRole('button', { name: /delete .*dewdrop/i }));
    expect(screen.queryByText(/Dewdrop/)).not.toBeInTheDocument();
  });

  it('Delete is disabled for the sole starter', () => {
    render(<PetsTab />);
    expect(screen.getByRole('button', { name: /delete .*leaflet/i })).toBeDisabled();
  });

  it('Delete is disabled for the last enabled def', () => {
    setActivePetDefs([
      { ...BUILTIN_PET_DEFS[0], enabled: false },                  // Leaflet — starter, disabled
      { ...BUILTIN_PET_DEFS[1], starter: false },                 // Embers — the ONLY enabled def
      { ...BUILTIN_PET_DEFS[2], starter: false, enabled: false }, // Zephyr — disabled
      { ...BUILTIN_PET_DEFS[3], starter: false, enabled: false }, // Dewdrop — disabled
    ]);
    render(<PetsTab />);
    expect(screen.getByRole('button', { name: /delete .*embers/i })).toBeDisabled();
  });

  it('gen filter narrows the list (no defs shown for an empty gen)', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // adds gen-1 def #5
    fireEvent.change(screen.getByLabelText(/filter by gen/i), { target: { value: '1' } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });
});

describe('PetsTab — edit form', () => {
  function openFirstEditor() {
    render(<PetsTab />);
    fireEvent.click(screen.getAllByRole('button', { name: /^edit /i })[0]); // edit Leaflet (starter)
  }

  it('edits the name', () => {
    openFirstEditor();
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Sprout' } });
    expect(screen.getByText(/Sprout/)).toBeInTheDocument();
  });

  it('toggles types via the multi-select (>=1 enforced by validate)', () => {
    openFirstEditor();
    const sel = screen.getByLabelText(/^types$/i) as HTMLSelectElement;
    Array.from(sel.options).forEach((o) => { o.selected = o.value === 'leaf' || o.value === 'fire'; });
    fireEvent.change(sel);
    expect(screen.getByText(/leaf, fire/)).toBeInTheDocument();
  });

  it('starter checkbox is disabled unless the def is gen 1 / dexNo 1', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*dewdrop/i })); // gen1 dexNo4
    expect(screen.getByLabelText(/^starter$/i)).toBeDisabled();
  });

  it('editing the id keeps the form open and renames the def', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*dewdrop/i }));
    const idInput = screen.getByLabelText(/^id$/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: 'def-renamed' } });
    // form is still open (id input still present) and shows the new id
    expect((screen.getByLabelText(/^id$/i) as HTMLInputElement).value).toBe('def-renamed');
  });

  it('keeps exactly one starter after saving the gen1/dex1 def', async () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    const cb = screen.getByLabelText(/^starter$/i) as HTMLInputElement;
    expect(cb.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(active().filter((d) => d.starter)).toHaveLength(1);
    });
  });

  it('editing a rarity band applies [min,max] to all 5 stats of that rarity on save', async () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    fireEvent.change(screen.getByLabelText(/common min/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/common max/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      const leaf = active().find((d) => d.id === 'def-leaf')!;
      expect(leaf.statBands.common.hp).toEqual([3, 9]);
    });
    const leaf = active().find((d) => d.id === 'def-leaf')!;
    for (const stat of ['hp', 'atk', 'def', 'spd', 'luk'] as const) {
      expect(leaf.statBands.common[stat]).toEqual([3, 9]);
    }
  });
});

describe('PetsTab — evolution UI + validate gate', () => {
  it('setting evolvesToId in the form persists reciprocal links on save', async () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i })); // def-leaf, gen1 dex1
    fireEvent.change(screen.getByLabelText(/evolves to/i), { target: { value: 'def-fire' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      const fire = active().find((d) => d.id === 'def-fire')!;
      expect(fire.evolvesFromId).toBe('def-leaf');
    });
  });

  it('Save is disabled + error shown when a duplicate (gen,dexNo) exists', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // gen1 dex5
    fireEvent.click(screen.getByRole('button', { name: /edit .*new pet/i }));
    fireEvent.change(screen.getByLabelText(/^dexNo$/i), { target: { value: '1' } }); // collide with starter
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/duplicate \(gen 1, dexNo 1\)/i)).toBeInTheDocument();
  });
});

describe('reconcileEvolution', () => {
  const base = (id: string, dexNo: number): PetDef => ({
    id, name: id, gen: 1, dexNo, types: ['leaf'], element: 'leaf',
    statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true,
  });

  it('returns equivalent data when there are no evolution links', () => {
    const input = [base('a', 1), base('b', 2)];
    expect(reconcileEvolution(input)).toEqual(input);
  });

  it('derives evolvesFromId from a forward evolvesToId link', () => {
    const out = reconcileEvolution([{ ...base('a', 1), evolvesToId: 'b' }, base('b', 2)]);
    expect(out.find((d) => d.id === 'b')!.evolvesFromId).toBe('a');
  });

  it('derives evolvesToId from a back evolvesFromId link', () => {
    const out = reconcileEvolution([base('a', 1), { ...base('b', 2), evolvesFromId: 'a' }]);
    expect(out.find((d) => d.id === 'a')!.evolvesToId).toBe('b');
  });
});
