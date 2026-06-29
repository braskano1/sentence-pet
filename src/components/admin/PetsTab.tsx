import { useEffect, useMemo, useState } from 'react';
import type { PetDef } from '../../data/types';
import { defaultDefForElement, getActivePetDefs, setActivePetDefs } from '../../domain/petDef';
import { hydratePetDefs } from '../../content/load';
import { validatePetDefs } from '../../content/validate';
import { savePetDefs } from '../../firebase/content';
import { writePetDefsCache } from '../../content/cache';
import {
  setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution,
} from './petsTab/helpers';
import { PetForm } from './petsTab/PetForm';

// Re-exported so existing test imports (`import { … } from './PetsTab'`) keep resolving.
export { setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution };

function nextDexNo(defs: PetDef[], gen: number): number {
  const used = defs.filter((d) => d.gen === gen).map((d) => d.dexNo);
  return used.length ? Math.max(...used) + 1 : 1;
}

function genId(defs: PetDef[]): string {
  let n = 1;
  while (defs.some((d) => d.id === `def-${n}`)) n++;
  return `def-${n}`;
}

export function PetsTab() {
  const [draft, setDraft] = useState<PetDef[]>(() => [...getActivePetDefs()]);
  const [status, setStatus] = useState('');
  const [genFilter, setGenFilter] = useState<'all' | number>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function patch(id: string, p: Partial<PetDef>) {
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }

  function setStarter(id: string) {
    setDraft((prev) => prev.map((d) => ({ ...d, starter: d.id === id })));
  }

  function rename(oldId: string, newId: string) {
    setDraft((prev) => prev.map((d) => (d.id === oldId ? { ...d, id: newId } : d)));
    setEditingId(newId);
  }

  const gens = useMemo(() => [...new Set(draft.map((d) => d.gen))].sort((a, b) => a - b), [draft]);
  const shown = useMemo(() => (genFilter === 'all' ? draft : draft.filter((d) => d.gen === genFilter)), [draft, genFilter]);

  const reconciled = useMemo(() => reconcileEvolution(draft), [draft]);
  const validation = useMemo(() => validatePetDefs(reconciled), [reconciled]);

  // Live-fetch the catalog on mount, re-seed the draft, then unblock. Blocking until the
  // fetch resolves means a stale draft can never be saved over the live Firestore catalog.
  useEffect(() => {
    let cancelled = false;
    // hydratePetDefs never rejects (offline resolves without changing the registry);
    // block until the fetch settles, then re-seed from whatever the registry now holds.
    hydratePetDefs().finally(() => {
      if (cancelled) return;
      setDraft([...getActivePetDefs()]);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await savePetDefs(reconciled);
      setActivePetDefs(reconciled);
      writePetDefsCache(reconciled);
      setDraft(reconciled);
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  function addPet() {
    const gen = genFilter === 'all' ? 1 : genFilter;
    setDraft((prev) => {
      const base = defaultDefForElement('leaf', prev);
      const newDef: PetDef = {
        ...base,
        id: genId(prev),
        name: 'New Pet',
        gen,
        dexNo: nextDexNo(prev, gen),
        starter: false,
        enabled: true,
        evolvesFromId: undefined,
        evolvesToId: undefined,
        evolutionStage: undefined,
      };
      return [...prev, newDef];
    });
  }

  function deletePet(id: string) {
    setDraft((prev) => prev.filter((d) => d.id !== id));
  }

  function canDelete(d: PetDef): boolean {
    if (d.starter) return false;
    if (d.enabled && draft.filter((x) => x.enabled).length <= 1) return false;
    return true;
  }

  if (!loaded) return <p role="status" className="p-4 text-sm">loading pets…</p>;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Pets</h2>
        <label className="text-xs">filter by gen
          <select className="ml-1 border px-1" value={String(genFilter)}
            onChange={(e) => setGenFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">all</option>
            {gens.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <button type="button" onClick={addPet} className="rounded bg-slate-800 px-2 py-0.5 text-white">+ Add pet</button>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono">{status}</span>}
      </div>

      <ul aria-live="polite" className={!validation.ok ? 'rounded bg-red-50 p-2 text-red-700' : 'sr-only'}>
        {!validation.ok && validation.errors.map((e) => <li key={e}>• {e}</li>)}
      </ul>

      <ul className="flex flex-col gap-1">
        {shown.map((d) => (
          <li key={d.id} className="rounded border p-2 flex items-center gap-2">
            <span className="font-mono">#{d.dexNo}</span>
            <strong>{d.name}</strong>
            <span>· {d.element} · [{d.types.join(', ')}]</span>
            {d.starter && <span>· ⭐ starter</span>}
            {!d.enabled && <span>· (disabled)</span>}
            <span className="flex-1" />
            <button type="button" aria-label={`edit ${d.name}`}
              onClick={() => setEditingId(editingId === d.id ? null : d.id)}
              className="text-indigo-600">Edit</button>
            <button type="button" aria-label={`delete ${d.name}`} disabled={!canDelete(d)}
              onClick={() => deletePet(d.id)} className="text-red-600 disabled:opacity-40">Delete</button>
          </li>
        ))}
      </ul>

      {editingId && draft.some((d) => d.id === editingId) && (
        <PetForm
          def={draft.find((d) => d.id === editingId)!}
          allDefs={draft}
          onPatch={(p) => patch(editingId, p)}
          onRename={(newId) => rename(editingId!, newId)}
          onSetStarter={() => setStarter(editingId)}
        />
      )}
    </div>
  );
}

