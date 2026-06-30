import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { PetDef } from '../../data/types';
import { defaultDefForElement, getActivePetDefs, setActivePetDefs } from '../../domain/petDef';
import { hydratePetDefs } from '../../content/load';
import { validatePetDefs } from '../../content/validate';
import { importPets } from '../../content/petImport';
import { buildWorkbook } from '../../content/importTemplates';
import { savePetDefs } from '../../firebase/content';
import { writePetDefsCache } from '../../content/cache';
import {
  setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution,
} from './petsTab/helpers';
import { PetForm } from './petsTab/PetForm';
import { Card, Button, SaveBar, ValidationSummary, SearchableList, FilterChips, ImportDrawer } from './ui';
import type { FilterChip } from './ui';

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

async function defaultParsePetsFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importPets(wb);
}

export function PetsTab({ parsePetsFile = defaultParsePetsFile }: {
  parsePetsFile?: (file: File) => Promise<{ entities: PetDef[]; errors: string[] }>;
} = {}) {
  const [draft, setDraft] = useState<PetDef[]>(() => [...getActivePetDefs()]);
  const [status, setStatus] = useState('');
  const [genFilter, setGenFilter] = useState<'all' | number>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => { setConfirming(false); }, [editingId]);

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
  const genChips: FilterChip<string>[] = useMemo(
    () => [{ id: 'all', label: 'All' }, ...gens.map((g) => ({ id: String(g), label: `Gen ${g}` }))],
    [gens],
  );

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

  function applyImport(merged: PetDef[]) {
    setDraft(merged);
    setEditingId(null);
  }

  function addPet() {
    const gen = genFilter === 'all' ? 1 : genFilter;
    const id = genId(draft);
    setDraft((prev) => {
      const base = defaultDefForElement('leaf', prev);
      const newDef: PetDef = {
        ...base,
        id,
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
    setEditingId(id);
  }

  function deletePet(id: string) {
    setDraft((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) setEditingId(null);
    setConfirming(false);
  }

  function canDelete(d: PetDef): boolean {
    if (d.starter) return false;
    if (d.enabled && draft.filter((x) => x.enabled).length <= 1) return false;
    return true;
  }

  if (!loaded) return <p role="status" className="p-4 text-sm">loading pets…</p>;

  const editing = editingId ? draft.find((d) => d.id === editingId) ?? null : null;

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">Pets</h2>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
        <SaveBar valid={validation.ok} status={status} onSave={save} errorCount={validation.errors.length} />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <div className="flex gap-4">
        <SearchableList
          items={shown}
          total={draft.length}
          countNoun="pet"
          getKey={(d) => d.id}
          selectedKey={editingId}
          onSelect={setEditingId}
          searchText={(d) => `${d.name} ${d.id} ${d.element} ${d.types.join(' ')}`}
          query={query}
          onQuery={setQuery}
          placeholder="Search pets by name, id, element..."
          filterSlot={<FilterChips chips={genChips} active={String(genFilter)}
            onChange={(id) => setGenFilter(id === 'all' ? 'all' : Number(id))} label="Filter by gen" />}
          footer={<Button onClick={addPet} className="w-full">+ Add pet</Button>}
          renderRow={(d) => (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-slate-500">#{d.dexNo}</span>
              <strong>{d.name}</strong>
              <span className="text-slate-500">· {d.element} · [{d.types.join(', ')}]</span>
              {d.starter && <span>· ⭐ starter</span>}
              {!d.enabled && <span className="text-slate-400">· (disabled)</span>}
            </span>
          )}
        />

        <div className="flex-1">
          {editing ? (
            <div className="flex flex-col gap-3">
              <PetForm def={editing} allDefs={draft}
                onPatch={(p) => patch(editing.id, p)}
                onRename={(newId) => rename(editing.id, newId)}
                onSetStarter={() => setStarter(editing.id)} />
              {confirming ? (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => deletePet(editing.id)}>Confirm delete</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" className="self-start" disabled={!canDelete(editing)}
                  onClick={() => setConfirming(true)}>Delete pet</Button>
              )}
            </div>
          ) : (
            <Card><p className="text-slate-500">Select a pet to edit, or add a new one.</p></Card>
          )}
        </div>
      </div>

      <ImportDrawer<PetDef>
        open={importing}
        title="Import pets"
        noun="pet"
        existing={draft}
        getId={(d) => d.id}
        parseFile={parsePetsFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{c.incoming.name} <span className="text-slate-400">· {c.incoming.id} · gen {c.incoming.gen} #{c.incoming.dexNo}</span></>}
        downloadTemplate={{ filename: 'pets-template.xlsx', build: () => buildWorkbook(['Pets']) }}
      />
    </div>
  );
}
