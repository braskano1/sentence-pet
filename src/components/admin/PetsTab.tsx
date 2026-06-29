import { useEffect, useMemo, useState } from 'react';
import type { PetDef, Species } from '../../data/types';
import { defaultDefForElement, getActivePetDefs, setActivePetDefs } from '../../domain/petDef';
import { hydratePetDefs } from '../../content/load';
import { validatePetDefs } from '../../content/validate';
import { savePetDefs } from '../../firebase/content';
import { writePetDefsCache } from '../../content/cache';
import { uploadSprite, deleteSpriteByUrl, type SpriteSlot } from '../../firebase/storage';
import { downscaleSprite } from '../../firebase/imageTranscode';
import { SPECIES } from '../../domain/species';
import { PET_TYPES } from '../../domain/petType';
import {
  RARITIES, VARIANT_STAGES, MOODS,
  setRarityBand, stripDefault, setVariant, clearVariant, reconcileEvolution,
} from './petsTab/helpers';

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

function SpriteUpload({ label, slot, defId, value, onUpload, onClear }: {
  label: string;
  slot: SpriteSlot;
  defId: string;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Best-effort: a stored-file delete failure must never block the strip/upload; the orphan
  // is harmless and cleanup is non-critical.
  async function deleteOrphan(url: string) {
    try { await deleteSpriteByUrl(url); } catch { /* leave orphan; cleanup is non-critical */ }
  }
  async function pick(file: File) {
    setBusy(true);
    setErr('');
    const prior = value; // the slot's current url, before the upload replaces it
    try {
      const toUpload = await downscaleSprite(file); // shrink oversized sprites; within-cap passes through untouched
      const url = await uploadSprite(defId, slot, toUpload);
      onUpload(url);
      // Replace: if a different file backed this slot, drop the now-orphaned old object.
      // Same-url overwrite (identical path/ext) already replaced the blob — never delete it.
      if (prior && prior !== url) await deleteOrphan(prior);
    } catch (e) {
      setErr((e as Error).message || 'upload failed');
    } finally {
      setBusy(false);
    }
  }
  function clear() {
    const prior = value; // capture before the def strips it
    onClear(); // strip the url first so the UI updates immediately…
    if (prior) void deleteOrphan(prior); // …then best-effort delete the now-orphaned object
  }
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs">{label}
        <input type="file" accept="image/*" className="ml-1 w-40" aria-invalid={!!err}
          onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) pick(f); }} />
      </label>
      {value && (
        <>
          <img src={value} alt={`${label} preview`} className="h-10 w-10 object-contain border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          <button type="button" aria-label={`clear ${label}`} onClick={clear} className="text-red-600 text-xs">Clear</button>
        </>
      )}
      <span aria-live="polite" className="text-xs text-slate-600">{busy ? 'uploading…' : err ? `⚠ ${err}` : ''}</span>
    </div>
  );
}

function PetForm({ def, allDefs, onPatch, onRename, onSetStarter }: {
  def: PetDef;
  allDefs: PetDef[];
  onPatch: (p: Partial<PetDef>) => void;
  onRename: (newId: string) => void;
  onSetStarter: () => void;
}) {
  const starterEligible = def.gen === 1 && def.dexNo === 1;
  return (
    <div className="rounded border-2 border-indigo-300 p-3 flex flex-col gap-2">
      <label>id
        <input className="border px-1 ml-1" value={def.id}
          onChange={(e) => onRename(e.target.value)} />
      </label>
      <label>name
        <input className="border px-1 ml-1" value={def.name}
          onChange={(e) => onPatch({ name: e.target.value })} />
      </label>
      <label>gen
        <input type="number" className="w-16 border px-1 ml-1" value={def.gen}
          onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch({ gen: n }); }} />
      </label>
      <label>dexNo
        <input type="number" className="w-16 border px-1 ml-1" value={def.dexNo}
          onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch({ dexNo: n }); }} />
      </label>
      <label>element
        <select className="border px-1 ml-1" value={def.element}
          onChange={(e) => onPatch({ element: e.target.value as Species })}>
          {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>types
        <select multiple className="border px-1 ml-1 align-top" value={def.types}
          onChange={(e) => onPatch({ types: Array.from(e.target.selectedOptions, (o) => o.value) })}>
          {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>enabled
        <input type="checkbox" className="ml-1" checked={def.enabled}
          onChange={(e) => onPatch({ enabled: e.target.checked })} />
      </label>
      <label>gacha obtainable
        <input type="checkbox" className="ml-1" aria-label="gacha obtainable"
          checked={def.gachaObtainable !== false}
          onChange={(e) => onPatch({ gachaObtainable: e.target.checked })} />
      </label>
      <label>starter
        <input type="checkbox" className="ml-1" checked={!!def.starter} disabled={!starterEligible}
          onChange={(e) => { if (e.target.checked) onSetStarter(); else onPatch({ starter: false }); }} />
      </label>
      {!starterEligible && <p className="text-xs text-slate-500">Starter must be gen 1, dexNo 1.</p>}
      <fieldset className="border p-2"><legend>stat bands (per rarity, applied to all stats)</legend>
        {RARITIES.map((r) => {
          const [min, max] = def.statBands[r].hp;
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="w-20">{r}</span>
              <label className="text-xs">{`${r} min`}
                <input type="number" aria-label={`${r} min`} className="w-16 border px-1 ml-1" value={min} step="1" min="0"
                  onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch(setRarityBand(def, r, [n, max])); }} />
              </label>
              <label className="text-xs">{`${r} max`}
                <input type="number" aria-label={`${r} max`} className="w-16 border px-1 ml-1" value={max} step="1" min="0"
                  onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onPatch(setRarityBand(def, r, [min, n])); }} />
              </label>
            </div>
          );
        })}
      </fieldset>
      <fieldset className="border p-2 flex flex-col gap-1"><legend>evolution</legend>
        <label>evolves from
          <select className="border px-1 ml-1" value={def.evolvesFromId ?? ''}
            onChange={(e) => onPatch({ evolvesFromId: e.target.value || undefined })}>
            <option value="">— none —</option>
            {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
          </select>
        </label>
        <label>evolves to
          <select className="border px-1 ml-1" value={def.evolvesToId ?? ''}
            onChange={(e) => onPatch({ evolvesToId: e.target.value || undefined })}>
            <option value="">— none —</option>
            {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
          </select>
        </label>
        <label>evolutionStage
          <input type="number" step="1" min="1" className="w-16 border px-1 ml-1" value={def.evolutionStage ?? ''}
            onChange={(e) => { const n = e.target.valueAsNumber; onPatch({ evolutionStage: Number.isNaN(n) ? undefined : n }); }} />
        </label>
      </fieldset>
      <fieldset className="border p-2 flex flex-col gap-1"><legend>sprite (custom art override — upload images)</legend>
        <SpriteUpload label="default sprite" slot="default" defId={def.id} value={def.sprite?.default}
          onUpload={(url) => onPatch({ sprite: { ...def.sprite, default: url } })}
          onClear={() => onPatch({ sprite: stripDefault(def.sprite) })} />
        <div className="grid grid-cols-2 gap-x-4">
          {VARIANT_STAGES.map((stage) => MOODS.map((mood) => (
            <SpriteUpload key={`${stage}-${mood}`} label={`${stage} ${mood} sprite`}
              slot={`${stage}-${mood}` as SpriteSlot} defId={def.id}
              value={def.sprite?.variants?.[stage]?.[mood]}
              onUpload={(url) => onPatch({ sprite: setVariant(def.sprite, stage, mood, url) })}
              onClear={() => onPatch({ sprite: clearVariant(def.sprite, stage, mood) })} />
          )))}
        </div>
      </fieldset>
    </div>
  );
}
