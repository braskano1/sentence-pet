import type { DrillItem, PosLabel } from '../../data/types';

const POS: PosLabel[] = ['Pronoun', 'Verb', 'Object'];

export function ItemEditor({ item, onChange }: { item: DrillItem; onChange: (i: DrillItem) => void }) {
  const set = (patch: Partial<DrillItem>) => onChange({ ...item, ...patch });
  const csv = (s: string) => s.split(',').map((w) => w.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      <label>id <input className="border px-1" value={item.id}
        onChange={(e) => set({ id: e.target.value })} /></label>
      <label>drill
        <select className="border px-1" value={item.drill}
          onChange={(e) => set({ drill: e.target.value as DrillItem['drill'] })}>
          {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label>level <input type="number" className="w-16 border px-1" value={item.level}
        onChange={(e) => { const n = Number(e.target.value); set({ level: Number.isNaN(n) ? item.level : n }); }} /></label>
      <label>thaiHint <input className="border px-1" value={item.thaiHint}
        onChange={(e) => set({ thaiHint: e.target.value })} /></label>
      <label>slots (csv) <input className="border px-1" value={item.slots.join(',')}
        onChange={(e) => set({ slots: csv(e.target.value) as PosLabel[] })} /></label>
      <label>answer (csv) <input className="border px-1" value={item.answer.join(',')}
        onChange={(e) => set({ answer: csv(e.target.value) })} /></label>
      <label>distractors (csv) <input className="border px-1" value={(item.distractors ?? []).join(',')}
        onChange={(e) => set({ distractors: csv(e.target.value) })} /></label>
      <p className="text-xs text-slate-400">POS options: {POS.join(', ')}. Traps edited as JSON later.</p>
    </div>
  );
}
