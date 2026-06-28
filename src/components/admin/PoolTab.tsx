import { useState } from 'react';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { ItemEditor } from './ItemEditor';

export function PoolTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const ids = Object.keys(course.pool);
  const [selected, setSelected] = useState<string | null>(ids[0] ?? null);

  function freshId(): string {
    let n = 1;
    while (course.pool[`item-${n}`]) n++;
    return `item-${n}`;
  }

  function addItem() {
    const id = freshId();
    const fresh: DrillItem = { id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun', 'Verb'], answer: ['', ''] };
    onChange({ ...course, pool: { ...course.pool, [id]: fresh } });
    setSelected(id);
  }

  function updateItem(next: ContentItem) {
    const pool = { ...course.pool };
    delete pool[selected!];
    pool[next.id] = next;
    onChange({ ...course, pool });
    setSelected(next.id);
  }

  function removeItem(id: string) {
    const pool = { ...course.pool };
    delete pool[id];
    onChange({ ...course, pool });
    setSelected(Object.keys(pool)[0] ?? null);
  }

  return (
    <div className="flex gap-4">
      <div className="flex w-48 flex-col gap-1">
        <button type="button" onClick={addItem} className="rounded bg-slate-800 px-2 py-1 text-white">+ New item</button>
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => setSelected(id)}
            className={`flex justify-between rounded px-2 py-1 text-left text-sm ${id === selected ? 'bg-indigo-100' : ''}`}>
            <span>{id}</span>
            <span className="text-xs text-slate-400">{(() => { const it = course.pool[id]; return isDragDrop(it) ? it.drill : it.kind; })()}·{course.pool[id].level}</span>
          </button>
        ))}
      </div>
      <div className="flex-1">
        {selected && course.pool[selected] && (
          <>
            <ItemEditor item={course.pool[selected]} onChange={updateItem} />
            <button type="button" onClick={() => removeItem(selected)} className="mt-2 text-sm text-red-600">Delete item</button>
          </>
        )}
      </div>
    </div>
  );
}
