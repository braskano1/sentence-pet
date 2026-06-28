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
