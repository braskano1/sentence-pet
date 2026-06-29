import { useState } from 'react';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { ItemEditor } from './ItemEditor';
import { Button } from './ui';

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
      <ul className="flex w-48 flex-col gap-1">
        <li>
          <Button onClick={addItem} className="w-full">+ New item</Button>
        </li>
        {ids.map((id) => {
          const it = course.pool[id];
          const meta = `${isDragDrop(it) ? it.drill : it.kind}·${it.level}`;
          return (
            <li key={id}>
              <button type="button" onClick={() => setSelected(id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${id === selected ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-50'}`}>
                <span>{id}</span>
                <span className="text-xs text-slate-400">{meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex-1">
        {selected && course.pool[selected] && (
          <div className="flex flex-col gap-3">
            <ItemEditor item={course.pool[selected]} onChange={updateItem} />
            <Button variant="danger" className="self-start" onClick={() => removeItem(selected)}>Delete item</Button>
          </div>
        )}
      </div>
    </div>
  );
}
