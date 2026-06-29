import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { importItems } from '../../content/surfaceImport';
import { ItemEditor } from './ItemEditor';
import { Button, SearchableList, FilterChips, ImportDrawer } from './ui';
import type { FilterChip } from './ui';
import { itemLabel, itemSearchText } from './poolTab/itemLabel';

async function defaultParseItemsFile(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return importItems(wb);
}

const KIND_CHIPS: readonly FilterChip<'all' | ContentItem['kind']>[] = [
  { id: 'all', label: 'All' },
  { id: 'flashcard', label: 'flashcard' },
  { id: 'matching', label: 'matching' },
  { id: 'dragdrop', label: 'dragdrop' },
  { id: 'fillblank', label: 'fillblank' },
];
type KindFilter = (typeof KIND_CHIPS)[number]['id'];

export function PoolTab({ course, onChange, parseItemsFile = defaultParseItemsFile }: {
  course: Course;
  onChange: (c: Course) => void;
  parseItemsFile?: (file: File) => Promise<{ entities: ContentItem[]; errors: string[] }>;
}) {
  const all = Object.values(course.pool);
  const [selected, setSelected] = useState<string | null>(all[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [importing, setImporting] = useState(false);

  const filtered = kind === 'all' ? all : all.filter((it) => it.kind === kind);

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

  function applyImport(merged: ContentItem[]) {
    onChange({ ...course, pool: Object.fromEntries(merged.map((it) => [it.id, it])) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setImporting(true)}>⬇ Import…</Button>
      </div>
      <div className="flex gap-4">
      <SearchableList
        items={filtered}
        total={all.length}
        getKey={(it) => it.id}
        selectedKey={selected}
        onSelect={setSelected}
        searchText={itemSearchText}
        query={query}
        onQuery={setQuery}
        placeholder="Search items by content or id…"
        filterSlot={<FilterChips chips={KIND_CHIPS} active={kind} onChange={setKind} label="Filter by kind" />}
        footer={<Button onClick={addItem} className="w-full">+ New item</Button>}
        renderRow={(it) => {
          const meta = isDragDrop(it) ? it.drill : it.kind;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-900">{itemLabel(it)}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{it.kind}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">L{it.level}</span>
              </div>
              <span className="font-mono text-xs text-slate-400">{it.id} · {meta}</span>
            </div>
          );
        }}
      />

      <div className="flex-1">
        {selected && course.pool[selected] && (
          <div className="flex flex-col gap-3">
            <ItemEditor item={course.pool[selected]} onChange={updateItem} />
            <Button variant="danger" className="self-start" onClick={() => removeItem(selected)}>Delete item</Button>
          </div>
        )}
      </div>
      </div>

      <ImportDrawer<ContentItem>
        open={importing}
        title="Import items"
        noun="item"
        existing={all}
        getId={(it) => it.id}
        parseFile={parseItemsFile}
        onApply={applyImport}
        onClose={() => setImporting(false)}
        renderChange={(c) => <>{itemLabel(c.incoming)} <span className="text-slate-400">· {c.incoming.id} · {c.incoming.kind}</span></>}
      />
    </div>
  );
}
