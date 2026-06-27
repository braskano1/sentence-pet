import { useState } from 'react';
import type { ContentBundle, Lesson, Unit } from '../../content/model';
import type { ContentItem, ContentKind } from '../../data/types';
import { isDragDrop } from '../../data/types';

/** Pool item ids whose kind matches a node's kind — the items admins may assign to it. */
export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}

export function JourneyTab({ bundle, onChange }: { bundle: ContentBundle; onChange: (b: ContentBundle) => void }) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    bundle.units[0]?.lessons[0]?.id ?? null,
  );

  function setUnits(units: Unit[]) { onChange({ ...bundle, units }); }

  function patchUnit(unitId: string, patch: Partial<Unit>) {
    setUnits(bundle.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  }

  function patchLesson(unitId: string, lessonId: string, patch: Partial<Lesson>) {
    setUnits(bundle.units.map((u) => u.id !== unitId ? u : {
      ...u, lessons: u.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    }));
  }

  function toggleItem(unitId: string, lesson: Lesson, itemId: string) {
    const itemIds = lesson.itemIds.includes(itemId)
      ? lesson.itemIds.filter((id) => id !== itemId)
      : [...lesson.itemIds, itemId];
    patchLesson(unitId, lesson.id, { itemIds });
  }

  const selected = bundle.units.flatMap((u) => u.lessons.map((l) => ({ u, l })))
    .find(({ l }) => l.id === selectedLessonId);

  return (
    <div className="flex gap-4 text-sm">
      <div className="w-56 flex-col gap-2">
        {bundle.units.map((unit) => (
          <div key={unit.id} className="mb-3 rounded border p-2">
            <input className="w-full border px-1 font-semibold" value={unit.title}
              onChange={(e) => patchUnit(unit.id, { title: e.target.value })} />
            <input className="mt-1 w-16 border px-1" value={unit.emoji}
              onChange={(e) => patchUnit(unit.id, { emoji: e.target.value })} aria-label="emoji" />
            <div className="mt-1 flex flex-col">
              {unit.lessons.map((l) => (
                <button key={l.id} type="button" onClick={() => setSelectedLessonId(l.id)}
                  className={`rounded px-1 text-left ${l.id === selectedLessonId ? 'bg-indigo-100' : ''}`}>
                  {l.id}{l.isCheckpoint ? ' ★' : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {selected && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Lesson: {selected.l.id}</p>
            <label>kind
              <select className="border px-1" value={selected.l.kind ?? 'dragdrop'}
                onChange={(e) => patchLesson(selected.u.id, selected.l.id, { kind: e.target.value as ContentKind })}>
                {['flashcard', 'matching', 'dragdrop', 'fillblank'].map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label>drill
              <select className="border px-1" value={selected.l.drill}
                onChange={(e) => patchLesson(selected.u.id, selected.l.id, { drill: e.target.value as Lesson['drill'] })}>
                {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>level <input type="number" className="w-16 border px-1" value={selected.l.level}
              onChange={(e) => {
                const n = Number(e.target.value);
                patchLesson(selected.u.id, selected.l.id, { level: Number.isNaN(n) ? selected.l.level : n });
              }} /></label>
            <label><input type="checkbox" checked={!!selected.l.isCheckpoint}
              onChange={(e) => patchLesson(selected.u.id, selected.l.id, { isCheckpoint: e.target.checked })} /> checkpoint</label>
            <label><input type="checkbox" checked={!!selected.u.l1Enabled}
              onChange={(e) => patchUnit(selected.u.id, { l1Enabled: e.target.checked })} /> L1 enabled (TH/ENG toggle)</label>
            <p className="mt-2 font-semibold">Items in lesson</p>
            <div className="flex flex-col">
              {eligibleItemIds(bundle.pool, selected.l.kind ?? 'dragdrop').map((id) => (
                <label key={id}>
                  <input type="checkbox" aria-label={`item ${id}`} checked={selected.l.itemIds.includes(id)}
                    onChange={() => toggleItem(selected.u.id, selected.l, id)} /> {id} <span className="text-xs text-slate-400">({(() => { const it = bundle.pool[id]; return isDragDrop(it) ? it.drill : it.kind; })()}·{bundle.pool[id].level})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
