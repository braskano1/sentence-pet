import type { PetDef, Species, Rarity } from '../../../data/types';
import { SPECIES } from '../../../domain/species';
import { PET_TYPES } from '../../../domain/petType';
import { RARITIES, VARIANT_STAGES, MOODS, setRarityBand, stripDefault, setVariant, clearVariant } from './helpers';
import { SpriteUpload } from './SpriteUpload';
import type { SpriteSlot } from '../../../firebase/storage';
import { Card, SectionLabel, Field, TextInput, NumberInput, Select, Checkbox } from '../ui';

export function PetForm({ def, allDefs, onPatch, onRename, onSetStarter }: {
  def: PetDef;
  allDefs: PetDef[];
  onPatch: (p: Partial<PetDef>) => void;
  onRename: (newId: string) => void;
  onSetStarter: () => void;
}) {
  const starterEligible = def.gen === 1 && def.dexNo === 1;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>Identity</SectionLabel>
        <div className="flex flex-col gap-2">
          <Field label="id"><TextInput value={def.id} onChange={(e) => onRename(e.target.value)} /></Field>
          <Field label="name"><TextInput value={def.name} onChange={(e) => onPatch({ name: e.target.value })} /></Field>
          <Field label="gen"><NumberInput value={def.gen} onValueChange={(n) => { if (n !== null) onPatch({ gen: n }); }} /></Field>
          <Field label="dexNo"><NumberInput value={def.dexNo} onValueChange={(n) => { if (n !== null) onPatch({ dexNo: n }); }} /></Field>
          <Field label="element">
            <Select value={def.element} onChange={(e) => onPatch({ element: e.target.value as Species })}>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="types">
            <Select multiple value={def.types}
              onChange={(e) => onPatch({ types: Array.from(e.target.selectedOptions, (o) => o.value) })}>
              {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="rarity override">
            <Select
              value={def.rarity ?? ''}
              onChange={(e) => onPatch({ rarity: (e.target.value || undefined) as Rarity | undefined })}
            >
              <option value="">Default (roll)</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Checkbox label="enabled" checked={def.enabled} onChange={(e) => onPatch({ enabled: e.target.checked })} />
          <Checkbox label="gacha obtainable" checked={def.gachaObtainable !== false}
            onChange={(e) => onPatch({ gachaObtainable: e.target.checked })} />
          <Checkbox label="starter" checked={!!def.starter} disabled={!starterEligible}
            onChange={(e) => { if (e.target.checked) onSetStarter(); else onPatch({ starter: false }); }} />
          {!starterEligible && <p className="text-xs text-slate-500">Starter must be gen 1, dexNo 1.</p>}
        </div>
      </Card>

      <Card>
        <SectionLabel>Stats</SectionLabel>
        <p className="mb-2 text-xs text-slate-500">stat bands (per rarity, applied to all stats)</p>
        <div className="flex flex-col gap-2">
          {RARITIES.map((r) => {
            const [min, max] = def.statBands[r].hp;
            return (
              <div key={r} className="flex items-end gap-2">
                <span className="w-20">{r}</span>
                <Field label={`${r} min`}>
                  <NumberInput value={min} min={0} step={1}
                    onValueChange={(n) => { if (n !== null) onPatch(setRarityBand(def, r, [n, max])); }} />
                </Field>
                <Field label={`${r} max`}>
                  <NumberInput value={max} min={0} step={1}
                    onValueChange={(n) => { if (n !== null) onPatch(setRarityBand(def, r, [min, n])); }} />
                </Field>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionLabel>Evolution</SectionLabel>
        <div className="flex flex-col gap-2">
          <Field label="evolves from">
            <Select value={def.evolvesFromId ?? ''} onChange={(e) => onPatch({ evolvesFromId: e.target.value || undefined })}>
              <option value="">— none —</option>
              {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </Select>
          </Field>
          <Field label="evolves to">
            <Select value={def.evolvesToId ?? ''} onChange={(e) => onPatch({ evolvesToId: e.target.value || undefined })}>
              <option value="">— none —</option>
              {allDefs.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </Select>
          </Field>
          <Field label="evolutionStage">
            <NumberInput value={def.evolutionStage ?? ''} min={1} step={1}
              onValueChange={(n) => onPatch({ evolutionStage: n ?? undefined })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Art</SectionLabel>
        <div className="flex flex-col gap-2">
          <SpriteUpload label="default sprite" slot="default" defId={def.id} value={def.sprite?.default}
            onUpload={(url) => onPatch({ sprite: { ...def.sprite, default: url } })}
            onClear={() => onPatch({ sprite: stripDefault(def.sprite) })} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {VARIANT_STAGES.map((stage) => MOODS.map((mood) => (
              <SpriteUpload key={`${stage}-${mood}`} label={`${stage} ${mood} sprite`}
                slot={`${stage}-${mood}` as SpriteSlot} defId={def.id}
                value={def.sprite?.variants?.[stage]?.[mood]}
                onUpload={(url) => onPatch({ sprite: setVariant(def.sprite, stage, mood, url) })}
                onClear={() => onPatch({ sprite: clearVariant(def.sprite, stage, mood) })} />
            )))}
          </div>
        </div>
      </Card>
    </div>
  );
}
