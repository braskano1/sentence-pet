import type {
  ContentItem,
  DragDropItem,
  FlashcardItem,
  MatchingItem,
  FillBlankItem,
  MatchingPair,
  PosLabel,
} from '../../data/types';

const POS: PosLabel[] = ['Pronoun', 'Verb', 'Object'];
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
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      <label>id <input className="border px-1" value={item.id}
        onChange={(e) => onChange({ ...item, id: e.target.value })} /></label>
      <label>kind
        <select className="border px-1" value={item.kind}
          onChange={(e) => onChange(blankOf(e.target.value as ContentItem['kind'], item.id, item.level))}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label>level <input type="number" className="w-16 border px-1" value={item.level}
        onChange={(e) => { const n = Number(e.target.value); onChange({ ...item, level: Number.isNaN(n) ? item.level : n }); }} /></label>

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
    <label>th (l1) <input className="border px-1" value={value}
      onChange={(e) => onChange(e.target.value)} /></label>
  );
}

function FlashcardForm({ item, onChange }: { item: FlashcardItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FlashcardItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <label>front <input className="border px-1" value={item.front}
        onChange={(e) => set({ front: e.target.value })} /></label>
      <label>back <input className="border px-1" value={item.back}
        onChange={(e) => set({ back: e.target.value })} /></label>
      <label>audio <input className="border px-1" value={item.audio ?? ''}
        onChange={(e) => set({ audio: e.target.value.trim() ? e.target.value : undefined })} /></label>
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
      <div className="flex flex-col gap-1">
        {item.pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-1">
            <label>left <input className="border px-1" value={p.left}
              onChange={(e) => setPair(i, { left: e.target.value })} /></label>
            <label>right <input className="border px-1" value={p.right}
              onChange={(e) => setPair(i, { right: e.target.value })} /></label>
            <label>th <input className="border px-1" value={p.l1?.th ?? ''}
              onChange={(e) => setPair(i, { l1: e.target.value.trim() ? { th: e.target.value } : undefined })} /></label>
            <button type="button" className="text-red-600"
              onClick={() => setPairs(item.pairs.filter((_, idx) => idx !== i))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="self-start text-indigo-600"
        onClick={() => setPairs([...item.pairs, { left: '', right: '' }])}>+ pair</button>
    </>
  );
}

function DragDropForm({ item, onChange }: { item: DragDropItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<DragDropItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <label>drill
        <select className="border px-1" value={item.drill}
          onChange={(e) => set({ drill: e.target.value as DragDropItem['drill'] })}>
          {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label>thaiHint <input className="border px-1" value={item.thaiHint}
        onChange={(e) => set({ thaiHint: e.target.value })} /></label>
      <label>slots (csv) <input className="border px-1" value={item.slots.join(',')}
        onChange={(e) => set({ slots: csv(e.target.value) as PosLabel[] })} /></label>
      <label>answer (csv) <input className="border px-1" value={item.answer.join(',')}
        onChange={(e) => set({ answer: csv(e.target.value) })} /></label>
      <label>distractors (csv) <input className="border px-1" value={(item.distractors ?? []).join(',')}
        onChange={(e) => set({ distractors: csv(e.target.value) })} /></label>
      <label>hidePos <input type="checkbox" checked={!!item.hidePos}
        onChange={(e) => set({ hidePos: e.target.checked || undefined })} /></label>
      <p className="text-xs text-slate-400">POS options: {POS.join(', ')}. Traps edited as JSON later.</p>
    </>
  );
}

function FillBlankForm({ item, onChange }: { item: FillBlankItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FillBlankItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <label>template <input className="border px-1" value={item.template}
        onChange={(e) => set({ template: e.target.value })} /></label>
      <label>answer <input className="border px-1" value={item.answer}
        onChange={(e) => set({ answer: e.target.value })} /></label>
      <label>alternates (csv) <input className="border px-1" value={(item.alternates ?? []).join(',')}
        onChange={(e) => set({ alternates: csv(e.target.value) })} /></label>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => set({ l1: th.trim() ? { th } : undefined })} />
    </>
  );
}
