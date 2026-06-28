import { useState } from 'react';
import type { PetDef } from '../../data/types';
import { getActivePetDefs, setActivePetDefs } from '../../domain/petDef';
import { validatePetDefs } from '../../content/validate';
import { savePetDefs } from '../../firebase/content';
import { writePetDefsCache } from '../../content/cache';

/** Forward links (evolvesToId) win; back-pointers (evolvesFromId) are derived/reconciled. */
export function reconcileEvolution(defs: PetDef[]): PetDef[] {
  const byId = new Map(defs.map((d) => [d.id, { ...d }]));
  for (const d of byId.values()) {
    if (d.evolvesToId && byId.has(d.evolvesToId)) byId.get(d.evolvesToId)!.evolvesFromId = d.id;
  }
  for (const d of byId.values()) {
    if (d.evolvesFromId && byId.has(d.evolvesFromId)) {
      const parent = byId.get(d.evolvesFromId)!;
      if (parent.evolvesToId !== d.id) parent.evolvesToId = d.id;
    }
  }
  return defs.map((d) => byId.get(d.id)!);
}

export function PetsTab() {
  const [draft, setDraft] = useState<PetDef[]>(() => [...getActivePetDefs()]);
  const [status, setStatus] = useState('');

  const reconciled = reconcileEvolution(draft);
  const validation = validatePetDefs(reconciled);

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

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Pets</h2>
        <span className="flex-1" />
        <button type="button" onClick={save} disabled={!validation.ok}
          className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Save</button>
        {status && <span className="font-mono">{status}</span>}
      </div>

      {!validation.ok && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-red-700">
          {validation.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      <ul className="flex flex-col gap-1">
        {draft.map((d) => (
          <li key={d.id} className="rounded border p-2">
            <span className="font-mono">#{d.dexNo}</span>{' '}
            <strong>{d.name}</strong> · {d.element} · [{d.types.join(', ')}]
            {d.starter && <span> · ⭐ starter</span>}
            {!d.enabled && <span> · (disabled)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
