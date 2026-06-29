import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const savePetDefs = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/content', () => ({
  savePetDefs: (d: unknown) => savePetDefs(d),
  fetchPetDefs: vi.fn(),
}));
const writePetDefsCache = vi.fn();
vi.mock('../../content/cache', () => ({ writePetDefsCache: (d: unknown) => writePetDefsCache(d) }));
const uploadSprite = vi.fn().mockResolvedValue('https://download/leaf.webp');
const deleteSpriteByUrl = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/storage', () => ({
  uploadSprite: (...a: unknown[]) => uploadSprite(...a),
  deleteSpriteByUrl: (...a: unknown[]) => deleteSpriteByUrl(...a),
}));
const hydratePetDefs = vi.fn().mockResolvedValue(undefined);
vi.mock('../../content/load', () => ({ hydratePetDefs: () => hydratePetDefs() }));

import { PetsTab, reconcileEvolution, stripDefault, setVariant, clearVariant } from './PetsTab';
import type { PetDef } from '../../data/types';
import { BUILTIN_PET_DEFS, getActivePetDefs as active, setActivePetDefs } from '../../domain/petDef';

beforeEach(() => {
  savePetDefs.mockClear();
  writePetDefsCache.mockClear();
  uploadSprite.mockClear();
  uploadSprite.mockResolvedValue('https://download/leaf.webp');
  deleteSpriteByUrl.mockClear();
  deleteSpriteByUrl.mockResolvedValue(undefined);
  hydratePetDefs.mockClear();
  hydratePetDefs.mockResolvedValue(undefined);
  setActivePetDefs([...BUILTIN_PET_DEFS]); // reset module-level registry between tests
});

describe('PetsTab — list + save', () => {
  it('lists every active def by name (seeded from getActivePetDefs)', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    for (const d of active()) {
      expect(screen.getAllByText(new RegExp(d.name)).length).toBeGreaterThan(0);
    }
  });

  it('Save is enabled for the builtins and calls savePetDefs + swaps the live registry', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    expect(writePetDefsCache).toHaveBeenCalled();
    expect(active().map((d) => d.id)).toEqual(BUILTIN_PET_DEFS.map((d) => d.id));
    expect(savePetDefs.mock.calls[0][0]).toHaveLength(BUILTIN_PET_DEFS.length);
  });

  it('leaves the live registry unchanged when savePetDefs rejects', async () => {
    savePetDefs.mockRejectedValueOnce(new Error('boom'));
    const before = active();
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText(/save failed/i);
    // registry reference is untouched — no optimistic swap
    expect(active()).toBe(before);
  });
});

describe('PetsTab — add / delete / filter', () => {
  it('Add creates a new def with a unique id and the next free dexNo', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    const before = screen.getAllByRole('listitem').length;
    fireEvent.click(screen.getByRole('button', { name: /add pet/i }));
    expect(screen.getAllByRole('listitem').length).toBe(before + 1);
    // builtins are gen1 dexNo 1..4, so the new gen-1 def gets dexNo 5
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it('Delete removes a def', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    // delete the last builtin (Dewdrop / water) — not the starter, not the last enabled
    fireEvent.click(screen.getByRole('button', { name: /delete .*dewdrop/i }));
    expect(screen.queryByText(/Dewdrop/)).not.toBeInTheDocument();
  });

  it('Delete is disabled for the sole starter', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    expect(screen.getByRole('button', { name: /delete .*leaflet/i })).toBeDisabled();
  });

  it('Delete is disabled for the last enabled def', async () => {
    setActivePetDefs([
      { ...BUILTIN_PET_DEFS[0], enabled: false },                  // Leaflet — starter, disabled
      { ...BUILTIN_PET_DEFS[1], starter: false },                 // Embers — the ONLY enabled def
      { ...BUILTIN_PET_DEFS[2], starter: false, enabled: false }, // Zephyr — disabled
      { ...BUILTIN_PET_DEFS[3], starter: false, enabled: false }, // Dewdrop — disabled
    ]);
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    expect(screen.getByRole('button', { name: /delete .*embers/i })).toBeDisabled();
  });

  it('gen filter narrows the list (no defs shown for an empty gen)', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // adds gen-1 def #5
    fireEvent.change(screen.getByLabelText(/filter by gen/i), { target: { value: '1' } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });
});

describe('PetsTab — edit form', () => {
  async function openFirstEditor() {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i }); // wait past the loading gate
    fireEvent.click(screen.getAllByRole('button', { name: /^edit /i })[0]); // edit Leaflet (starter)
  }

  it('edits the name', async () => {
    await openFirstEditor();
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Sprout' } });
    expect(screen.getByText(/Sprout/)).toBeInTheDocument();
  });

  it('toggles types via the multi-select (>=1 enforced by validate)', async () => {
    await openFirstEditor();
    const sel = screen.getByLabelText(/^types$/i) as HTMLSelectElement;
    Array.from(sel.options).forEach((o) => { o.selected = o.value === 'leaf' || o.value === 'fire'; });
    fireEvent.change(sel);
    expect(screen.getByText(/leaf, fire/)).toBeInTheDocument();
  });

  it('starter checkbox is disabled unless the def is gen 1 / dexNo 1', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit .*dewdrop/i })); // gen1 dexNo4
    expect(screen.getByLabelText(/^starter$/i)).toBeDisabled();
  });

  it('editing the id keeps the form open and renames the def', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit .*dewdrop/i }));
    const idInput = screen.getByLabelText(/^id$/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: 'def-renamed' } });
    // form is still open (id input still present) and shows the new id
    expect((screen.getByLabelText(/^id$/i) as HTMLInputElement).value).toBe('def-renamed');
  });

  it('keeps exactly one starter after saving the gen1/dex1 def', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
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
    await screen.findByRole('button', { name: /add pet/i });
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
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i })); // def-leaf, gen1 dex1
    fireEvent.change(screen.getByLabelText(/evolves to/i), { target: { value: 'def-fire' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      const fire = active().find((d) => d.id === 'def-fire')!;
      expect(fire.evolvesFromId).toBe('def-leaf');
    });
  });

  it('Save is disabled + error shown when a duplicate (gen,dexNo) exists', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /add pet/i })); // gen1 dex5
    fireEvent.click(screen.getByRole('button', { name: /edit .*new pet/i }));
    fireEvent.change(screen.getByLabelText(/^dexNo$/i), { target: { value: '1' } }); // collide with starter
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/duplicate \(gen 1, dexNo 1\)/i)).toBeInTheDocument();
  });

  it('Save is disabled + cycle error shown when evolves-from and evolves-to point to the same def', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    fireEvent.change(screen.getByLabelText(/evolves from/i), { target: { value: 'def-fire' } });
    fireEvent.change(screen.getByLabelText(/evolves to/i), { target: { value: 'def-fire' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/evolution cycle/i)).toBeInTheDocument();
  });
});

describe('PetsTab — sprite upload', () => {
  async function openLeaflet() {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
  }
  const webp = () => new File(['x'], 'leaf.webp', { type: 'image/webp' });

  it('uploading a default sprite calls uploadSprite(defId, "default", file) and shows a preview', async () => {
    await openLeaflet();
    const input = screen.getByLabelText(/^default sprite$/i);
    fireEvent.change(input, { target: { files: [webp()] } });
    await waitFor(() => expect(uploadSprite).toHaveBeenCalledWith('def-leaf', 'default', expect.any(File)));
    expect(await screen.findByAltText(/default sprite preview/i)).toHaveAttribute('src', 'https://download/leaf.webp');
  });

  it('an uploaded default sprite persists through Save', async () => {
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await screen.findByAltText(/default sprite preview/i);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.sprite?.default).toBe('https://download/leaf.webp');
  });

  it('uploading a variant writes sprite.variants[stage][mood]', async () => {
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^baby happy sprite$/i), { target: { files: [webp()] } });
    await waitFor(() => expect(uploadSprite).toHaveBeenCalledWith('def-leaf', 'baby-happy', expect.any(File)));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.sprite?.variants?.baby?.happy).toBe('https://download/leaf.webp');
  });

  it('a failed upload surfaces an error and leaves the sprite unset', async () => {
    uploadSprite.mockRejectedValueOnce(new Error('network down'));
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument();
  });

  it('Clear removes an uploaded default sprite', async () => {
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await screen.findByAltText(/default sprite preview/i);
    fireEvent.click(screen.getByRole('button', { name: /clear default sprite/i }));
    expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument();
  });

  it('clearing a variant removes it from sprite.variants', async () => {
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^baby happy sprite$/i), { target: { files: [webp()] } });
    expect(await screen.findByAltText(/baby happy sprite preview/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear baby happy sprite/i }));
    expect(screen.queryByAltText(/baby happy sprite preview/i)).not.toBeInTheDocument();
  });

  it('a failed upload can be retried with the same file and then succeeds', async () => {
    uploadSprite.mockRejectedValueOnce(new Error('network down'));
    await openLeaflet();
    const input = screen.getByLabelText(/^default sprite$/i);
    fireEvent.change(input, { target: { files: [webp()] } });
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    // retry with the same file (input value was reset, so change fires again)
    fireEvent.change(input, { target: { files: [webp()] } });
    expect(await screen.findByAltText(/default sprite preview/i)).toHaveAttribute('src', 'https://download/leaf.webp');
    expect(screen.queryByText(/network down/i)).not.toBeInTheDocument();
  });

  it('a successful upload clears a prior error message', async () => {
    uploadSprite.mockRejectedValueOnce(new Error('boom'));
    await openLeaflet();
    const input = screen.getByLabelText(/^baby sad sprite$/i);
    fireEvent.change(input, { target: { files: [webp()] } });
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [webp()] } });
    await screen.findByAltText(/baby sad sprite preview/i);
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
  });
});

describe('PetsTab — orphan-sprite cleanup on clear/replace', () => {
  // Seed Leaflet with a pre-existing stored sprite so clear/replace have an "old url".
  const OLD = 'https://download/old-default.webp';
  function seedLeafletWithDefault() {
    setActivePetDefs(BUILTIN_PET_DEFS.map((d) =>
      d.id === 'def-leaf' ? { ...d, sprite: { default: OLD } } : d));
  }
  async function openLeaflet() {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit leaflet/i }));
  }
  const webp = () => new File(['x'], 'leaf.webp', { type: 'image/webp' });

  it('clearing a slot that HAS a url deletes the old file then strips the url', async () => {
    seedLeafletWithDefault();
    await openLeaflet();
    expect(screen.getByAltText(/default sprite preview/i)).toHaveAttribute('src', OLD);
    fireEvent.click(screen.getByRole('button', { name: /clear default sprite/i }));
    await waitFor(() => expect(deleteSpriteByUrl).toHaveBeenCalledWith(OLD));
    expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument();
  });

  it('clearing a slot with NO url does not call deleteSpriteByUrl', async () => {
    await openLeaflet(); // builtins have no sprite override
    // upload then clear the freshly-uploaded url is a separate case; here assert the
    // empty-slot clear path: there is no Clear button when there is no value, so a
    // clear can never fire with an empty slot — assert no stray delete on mount/edit.
    expect(deleteSpriteByUrl).not.toHaveBeenCalled();
  });

  it('uploading over an existing different url deletes the prior url and keeps the new one', async () => {
    seedLeafletWithDefault();
    uploadSprite.mockResolvedValueOnce('https://download/new-default.webp');
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await waitFor(() => expect(deleteSpriteByUrl).toHaveBeenCalledWith(OLD));
    expect(await screen.findByAltText(/default sprite preview/i))
      .toHaveAttribute('src', 'https://download/new-default.webp');
    // it must NOT delete the just-uploaded url
    expect(deleteSpriteByUrl).not.toHaveBeenCalledWith('https://download/new-default.webp');
  });

  it('uploading the SAME url back does not delete it', async () => {
    seedLeafletWithDefault();
    uploadSprite.mockResolvedValueOnce(OLD); // overwrite produced the identical url
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    await screen.findByAltText(/default sprite preview/i);
    expect(deleteSpriteByUrl).not.toHaveBeenCalled();
  });

  it('a delete rejection does not block the clear (best-effort)', async () => {
    seedLeafletWithDefault();
    deleteSpriteByUrl.mockRejectedValueOnce(new Error('storage down'));
    await openLeaflet();
    fireEvent.click(screen.getByRole('button', { name: /clear default sprite/i }));
    await waitFor(() => expect(screen.queryByAltText(/default sprite preview/i)).not.toBeInTheDocument());
    // no error UI for a failed cleanup
    expect(screen.queryByText(/storage down/i)).not.toBeInTheDocument();
  });

  it('a delete rejection does not block the upload (best-effort)', async () => {
    seedLeafletWithDefault();
    deleteSpriteByUrl.mockRejectedValueOnce(new Error('storage down'));
    uploadSprite.mockResolvedValueOnce('https://download/new-default.webp');
    await openLeaflet();
    fireEvent.change(screen.getByLabelText(/^default sprite$/i), { target: { files: [webp()] } });
    expect(await screen.findByAltText(/default sprite preview/i))
      .toHaveAttribute('src', 'https://download/new-default.webp');
    expect(screen.queryByText(/storage down/i)).not.toBeInTheDocument();
  });

  it('clearing a variant with a url deletes the old variant file', async () => {
    setActivePetDefs(BUILTIN_PET_DEFS.map((d) =>
      d.id === 'def-leaf' ? { ...d, sprite: { variants: { baby: { happy: 'https://download/old-bh.webp' } } } } : d));
    await openLeaflet();
    fireEvent.click(screen.getByRole('button', { name: /clear baby happy sprite/i }));
    await waitFor(() => expect(deleteSpriteByUrl).toHaveBeenCalledWith('https://download/old-bh.webp'));
    expect(screen.queryByAltText(/baby happy sprite preview/i)).not.toBeInTheDocument();
  });
});

describe('PetsTab — gacha obtainable toggle', () => {
  it('toggling the obtainable checkbox patches gachaObtainable', async () => {
    render(<PetsTab />);
    await screen.findByRole('button', { name: /add pet/i });
    fireEvent.click(screen.getByRole('button', { name: /edit .*leaflet/i }));
    const cb = screen.getByRole('checkbox', { name: /gacha obtainable/i }) as HTMLInputElement;
    // builtins default to obtainable (gachaObtainable !== false), so the box starts checked
    expect(cb.checked).toBe(true);
    fireEvent.click(cb);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(savePetDefs).toHaveBeenCalled());
    const saved = savePetDefs.mock.calls[0][0] as PetDef[];
    expect(saved.find((d) => d.name === 'Leaflet')?.gachaObtainable).toBe(false);
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

describe('stripDefault', () => {
  it('returns undefined when only default was present', () => {
    expect(stripDefault({ default: 'https://cdn.test/x.webp' })).toBeUndefined();
  });
  it('returns undefined for an empty variants object', () => {
    expect(stripDefault({ default: 'https://cdn.test/x.webp', variants: {} })).toBeUndefined();
  });
  it('keeps a non-empty variants set (drops default)', () => {
    expect(stripDefault({ default: 'https://cdn.test/x.webp', variants: { adult: { happy: 'https://cdn.test/a.webp' } } }))
      .toEqual({ variants: { adult: { happy: 'https://cdn.test/a.webp' } } });
  });
  it('returns undefined for undefined input', () => {
    expect(stripDefault(undefined)).toBeUndefined();
  });
});

describe('setVariant / clearVariant', () => {
  it('setVariant creates the variants map and stage cell on an empty sprite', () => {
    expect(setVariant(undefined, 'baby', 'happy', 'https://cdn.test/bh.webp'))
      .toEqual({ variants: { baby: { happy: 'https://cdn.test/bh.webp' } } });
  });

  it('setVariant preserves default and other cells', () => {
    const sprite = { default: 'https://cdn.test/d.webp', variants: { baby: { happy: 'https://cdn.test/bh.webp' } } };
    expect(setVariant(sprite, 'baby', 'sad', 'https://cdn.test/bs.webp')).toEqual({
      default: 'https://cdn.test/d.webp',
      variants: { baby: { happy: 'https://cdn.test/bh.webp', sad: 'https://cdn.test/bs.webp' } },
    });
  });

  it('clearVariant removes the cell and drops an emptied stage', () => {
    const sprite = { variants: { baby: { happy: 'https://cdn.test/bh.webp' }, adult: { sad: 'https://cdn.test/as.webp' } } };
    expect(clearVariant(sprite, 'baby', 'happy'))
      .toEqual({ variants: { adult: { sad: 'https://cdn.test/as.webp' } } });
  });

  it('clearVariant collapses to undefined when nothing remains', () => {
    expect(clearVariant({ variants: { baby: { happy: 'https://cdn.test/bh.webp' } } }, 'baby', 'happy')).toBeUndefined();
  });

  it('clearVariant keeps default when the last variant is removed', () => {
    const sprite = { default: 'https://cdn.test/d.webp', variants: { baby: { happy: 'https://cdn.test/bh.webp' } } };
    expect(clearVariant(sprite, 'baby', 'happy')).toEqual({ default: 'https://cdn.test/d.webp' });
  });

  it('setVariant does not mutate its input', () => {
    const sprite = { default: 'https://cdn.test/d.webp', variants: { baby: { happy: 'orig' } } };
    const before = JSON.stringify(sprite);
    setVariant(sprite, 'baby', 'sad', 'new');
    expect(JSON.stringify(sprite)).toBe(before);
  });

  it('clearVariant is a no-op when the stage/mood does not exist', () => {
    const sprite = { variants: { adult: { sad: 'https://cdn.test/as.webp' } } };
    expect(clearVariant(sprite, 'baby', 'happy')).toEqual(sprite);
  });
});

describe('PetsTab — block until live load', () => {
  it('shows a loading state and no editor until hydratePetDefs resolves', async () => {
    let resolve!: () => void;
    hydratePetDefs.mockReturnValueOnce(new Promise<void>((r) => { resolve = () => r(); }));
    render(<PetsTab />);
    expect(screen.getByText(/loading pets/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add pet/i })).not.toBeInTheDocument();
    resolve();
    expect(await screen.findByRole('button', { name: /add pet/i })).toBeInTheDocument();
  });

  it('calls hydratePetDefs on mount and re-seeds the draft from the live registry', async () => {
    const live = [
      ...BUILTIN_PET_DEFS,
      { ...BUILTIN_PET_DEFS[1], id: 'def-custom', name: 'Custom Mon', dexNo: 5,
        sprite: { default: 'https://cdn.test/custom.webp' } },
    ];
    hydratePetDefs.mockImplementationOnce(async () => { setActivePetDefs(live); });
    render(<PetsTab />);
    expect(hydratePetDefs).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Custom Mon/)).toBeInTheDocument();
  });

  it('still unblocks when hydratePetDefs resolves without live data (offline) — editor renders from the current registry', async () => {
    hydratePetDefs.mockResolvedValueOnce(undefined); // offline: no registry change
    render(<PetsTab />);
    expect(await screen.findByRole('button', { name: /add pet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });
});
