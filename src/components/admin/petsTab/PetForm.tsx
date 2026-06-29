import type { PetDef, Species } from '../../../data/types';
import { SPECIES } from '../../../domain/species';
import { PET_TYPES } from '../../../domain/petType';
import { RARITIES, VARIANT_STAGES, MOODS, setRarityBand, stripDefault, setVariant, clearVariant } from './helpers';
import { SpriteUpload } from './SpriteUpload';
import type { SpriteSlot } from '../../../firebase/storage';

export function PetForm({ def, allDefs, onPatch, onRename, onSetStarter }: {
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
