import type {
  ContentItem,
  DragDropItem,
  FlashcardItem,
  MatchingItem,
  FillBlankItem,
  MatchingPair,
  PosLabel,
} from '../../data/types';
import { Field, TextInput, NumberInput, Select, Checkbox, Button } from './ui';
import { LessonImageUpload } from './LessonImageUpload';

const POS: PosLabel[] = ['Subject', 'Verb', 'Object'];
const KINDS: ContentItem['kind'][] = ['flashcard', 'matching', 'dragdrop', 'fillblank'];

const csv = (s: string) => s.split(',').map((w) => w.trim()).filter(Boolean);

function blankOf(kind: ContentItem['kind'], id: string, level: number): ContentItem {
  switch (kind) {
    case 'flashcard':
      return { id, kind, level, front: '', back: '' };
    case 'matching':
      return { id, kind, level, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    case 'dragdrop':
      return { id, kind, level, drill: 'pattern', thaiHint: '', slots: [], answer: [] };
    case 'fillblank':
      return { id, kind, level, template: '___', answer: '' };
  }
}

export function ItemEditor({ item, onChange }: { item: ContentItem; onChange: (i: ContentItem) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="id">
        <TextInput value={item.id} onChange={(e) => onChange({ ...item, id: e.target.value })} />
      </Field>
      <Field label="kind">
        <Select value={item.kind}
          onChange={(e) => onChange(blankOf(e.target.value as ContentItem['kind'], item.id, item.level))}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="level">
        <NumberInput value={item.level}
          onValueChange={(n) => { if (n !== null) onChange({ ...item, level: n }); }} />
      </Field>

      {item.kind === 'flashcard' && <FlashcardForm item={item} onChange={onChange} />}
      {item.kind === 'matching' && <MatchingForm item={item} onChange={onChange} />}
      {item.kind === 'dragdrop' && <DragDropForm item={item} onChange={onChange} />}
      {item.kind === 'fillblank' && <FillBlankForm item={item} onChange={onChange} />}
    </div>
  );
}

/** Shared optional Thai helper input (flashcard/matching/fillblank). */
function L1Input({ value, onChange }: { value: string; onChange: (th: string) => void }) {
  return (
    <Field label="th (l1)">
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function FlashcardForm({ item, onChange }: { item: FlashcardItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FlashcardItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="front"><TextInput value={item.front} onChange={(e) => set({ front: e.target.value })} /></Field>
      <Field label="back"><TextInput value={item.back} onChange={(e) => set({ back: e.target.value })} /></Field>
      <Field label="audio">
        <TextInput value={item.audio ?? ''}
          onChange={(e) => set({ audio: e.target.value.trim() ? e.target.value : undefined })} />
      </Field>
      <Field label="image (url)">
        <TextInput value={item.image ?? ''}
          onChange={(e) => set({ image: e.target.value.trim() ? e.target.value : undefined })} />
      </Field>
      <Checkbox label="image caption" checked={item.imageCaption !== false}
        onChange={(e) => set({ imageCaption: e.target.checked ? undefined : false })} />
      <LessonImageUpload label="upload image" itemId={item.id} slot="image"
        value={item.image} onUpload={(url) => set({ image: url })}
        onClear={() => set({ image: undefined })} />
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => set({ l1: th.trim() ? { th } : undefined })} />
    </>
  );
}

function MatchingForm({ item, onChange }: { item: MatchingItem; onChange: (i: ContentItem) => void }) {
  const setPairs = (pairs: MatchingPair[]) => onChange({ ...item, pairs });
  const setPair = (i: number, patch: Partial<MatchingPair>) =>
    setPairs(item.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => onChange({ ...item, l1: th.trim() ? { th } : undefined })} />
      <div className="flex flex-col gap-2">
        {item.pairs.map((p, i) => (
          <div key={i} className="flex flex-col gap-1 border-b border-slate-200 pb-2">
            <div className="flex items-end gap-2">
              <Field label="left"><TextInput value={p.left} onChange={(e) => setPair(i, { left: e.target.value })} /></Field>
              <Field label="right"><TextInput value={p.right} onChange={(e) => setPair(i, { right: e.target.value })} /></Field>
              <Field label="th">
                <TextInput value={p.l1?.th ?? ''}
                  onChange={(e) => setPair(i, { l1: e.target.value.trim() ? { th: e.target.value } : undefined })} />
              </Field>
              <Button variant="danger" aria-label={`remove pair ${i + 1}`}
                onClick={() => setPairs(item.pairs.filter((_, idx) => idx !== i))}>×</Button>
            </div>
            <div className="flex items-end gap-2">
              <Field label="left image (url)">
                <TextInput value={p.leftImage ?? ''}
                  onChange={(e) => setPair(i, { leftImage: e.target.value.trim() ? e.target.value : undefined })} />
              </Field>
              <Checkbox label="left cap" checked={p.leftImageCaption !== false}
                onChange={(e) => setPair(i, { leftImageCaption: e.target.checked ? undefined : false })} />
              <Field label="right image (url)">
                <TextInput value={p.rightImage ?? ''}
                  onChange={(e) => setPair(i, { rightImage: e.target.value.trim() ? e.target.value : undefined })} />
              </Field>
              <Checkbox label="right cap" checked={p.rightImageCaption !== false}
                onChange={(e) => setPair(i, { rightImageCaption: e.target.checked ? undefined : false })} />
              <LessonImageUpload label="upload left image" itemId={item.id} slot="leftImage"
                value={p.leftImage} onUpload={(url) => setPair(i, { leftImage: url })}
                onClear={() => setPair(i, { leftImage: undefined })} />
              <LessonImageUpload label="upload right image" itemId={item.id} slot="rightImage"
                value={p.rightImage} onUpload={(url) => setPair(i, { rightImage: url })}
                onClear={() => setPair(i, { rightImage: undefined })} />
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="self-start"
        onClick={() => setPairs([...item.pairs, { left: '', right: '' }])}>+ pair</Button>
    </>
  );
}

function DragDropForm({ item, onChange }: { item: DragDropItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<DragDropItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="drill">
        <Select value={item.drill} onChange={(e) => set({ drill: e.target.value as DragDropItem['drill'] })}>
          {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
        </Select>
      </Field>
      <Field label="thaiHint"><TextInput value={item.thaiHint} onChange={(e) => set({ thaiHint: e.target.value })} /></Field>
      <Field label="slots (csv)">
        <TextInput value={item.slots.join(',')} onChange={(e) => set({ slots: csv(e.target.value) as PosLabel[] })} />
      </Field>
      <Field label="answer (csv)">
        <TextInput value={item.answer.join(',')} onChange={(e) => set({ answer: csv(e.target.value) })} />
      </Field>
      <Field label="distractors (csv)">
        <TextInput value={(item.distractors ?? []).join(',')} onChange={(e) => set({ distractors: csv(e.target.value) })} />
      </Field>
      <Checkbox label="hidePos" checked={!!item.hidePos}
        onChange={(e) => set({ hidePos: e.target.checked || undefined })} />
      <p className="text-xs text-slate-500">POS options: {POS.join(', ')}. Traps edited as JSON later.</p>
    </>
  );
}

function FillBlankForm({ item, onChange }: { item: FillBlankItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FillBlankItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="template"><TextInput value={item.template} onChange={(e) => set({ template: e.target.value })} /></Field>
      <Field label="answer"><TextInput value={item.answer} onChange={(e) => set({ answer: e.target.value })} /></Field>
      <Field label="alternates (csv)">
        <TextInput value={(item.alternates ?? []).join(',')} onChange={(e) => set({ alternates: csv(e.target.value) })} />
      </Field>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => set({ l1: th.trim() ? { th } : undefined })} />
    </>
  );
}
