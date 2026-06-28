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
import { BUILTIN_PET_DEFS, getActivePetDefs, setActivePetDefs } from '../../domain/petDef';

beforeEach(() => {
  savePetDefs.mockClear();
  writePetDefsCache.mockClear();
  setActivePetDefs([...BUILTIN_PET_DEFS]); // reset module-level registry between tests
});

describe('PetsTab — list + save', () => {
  it('lists every active def by name (seeded from getActivePetDefs)', () => {
    render(<PetsTab />);
    for (const d of getActivePetDefs()) {
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
    expect(getActivePetDefs().map((d) => d.id)).toEqual(BUILTIN_PET_DEFS.map((d) => d.id));
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

  it('Delete is disabled for the last enabled non-starter', () => {
    setActivePetDefs([
      { ...BUILTIN_PET_DEFS[0] },                                   // Leaflet — starter, enabled
      { ...BUILTIN_PET_DEFS[1], starter: false },                  // Embers — enabled non-starter (sole)
      { ...BUILTIN_PET_DEFS[2], starter: false, enabled: false },  // Zephyr — disabled
      { ...BUILTIN_PET_DEFS[3], starter: false, enabled: false },  // Dewdrop — disabled
    ]);
    render(<PetsTab />);
    // Leaflet (starter) is also blocked, but Embers is the last ENABLED non-starter:
    expect(screen.getByRole('button', { name: /delete .*embers/i })).toBeDisabled();
  });

  it('gen filter narrows the list (no defs shown for an empty gen)', () => {
    render(<PetsTab />);
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // adds gen-1 def #5
    fireEvent.change(screen.getByLabelText(/filter by gen/i), { target: { value: '1' } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
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
