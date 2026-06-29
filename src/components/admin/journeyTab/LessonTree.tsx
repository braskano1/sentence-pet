import { useId, useState } from 'react';
import type { Unit } from '../../../content/model';
import { Button, FilterChips } from '../ui';
import type { FilterChip } from '../ui';

export type TreeSelection = { type: 'unit' | 'lesson'; id: string };

const FILTERS: readonly FilterChip<'all' | 'checkpoints'>[] = [
  { id: 'all', label: 'All' },
  { id: 'checkpoints', label: 'Checkpoints ★' },
];
type TreeFilter = (typeof FILTERS)[number]['id'];

function lessonText(l: { id: string; title?: string }): string {
  return `${l.title ?? ''} ${l.id}`.toLowerCase();
}

export function LessonTree({ units, selected, onSelect, onAddUnit, onAddLesson }: {
  units: Unit[];
  selected: TreeSelection | null;
  onSelect: (s: TreeSelection) => void;
  onAddUnit: () => void;
  onAddLesson: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TreeFilter>('all');
  const searchId = useId();
  const q = query.trim().toLowerCase();

  const lessonCount = units.reduce((n, u) => n + u.lessons.length, 0);
  const isUnit = (id: string) => selected?.type === 'unit' && selected.id === id;
  const isLesson = (id: string) => selected?.type === 'lesson' && selected.id === id;

  function visibleLessons(u: Unit) {
    return u.lessons.filter((l) => {
      if (filter === 'checkpoints' && !l.isCheckpoint) return false;
      if (q && !lessonText(l).includes(q)) return false;
      return true;
    });
  }

  return (
    <div className="flex w-80 shrink-0 flex-col self-start rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
        <label htmlFor={searchId} className="sr-only">Search lessons</label>
        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-400 focus-within:border-indigo-400">
          <span aria-hidden>🔎</span>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Search lessons…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none"
          />
        </div>
        <FilterChips chips={FILTERS} active={filter} onChange={setFilter} label="Filter lessons" />
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500">
        <span>{units.length} units · {lessonCount} lessons</span>
        <button
          type="button"
          onClick={onAddUnit}
          className="font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          + Unit
        </button>
      </div>

      <ul className="max-h-[28rem] flex-1 overflow-auto">
        {units.map((u) => {
          const lessons = visibleLessons(u);
          // Hide units with no matching lessons while a filter or query is active
          if ((q || filter === 'checkpoints') && lessons.length === 0) return null;
          return (
            <li key={u.id}>
              <button
                type="button"
                aria-current={isUnit(u.id) ? true : undefined}
                onClick={() => onSelect({ type: 'unit', id: u.id })}
                className={`flex w-full items-center gap-2 border-b border-l-2 border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                  isUnit(u.id)
                    ? 'border-l-indigo-500 bg-indigo-50'
                    : 'border-l-transparent hover:bg-slate-100'
                }`}
              >
                <span aria-hidden>{u.emoji}</span>
                <span className="truncate">{u.title}</span>
                <span className="ml-auto text-xs font-normal text-slate-400">{u.lessons.length}</span>
              </button>
              <ul>
                {lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      aria-current={isLesson(l.id) ? true : undefined}
                      onClick={() => onSelect({ type: 'lesson', id: l.id })}
                      className={`flex w-full items-center gap-2 border-b border-l-2 border-slate-100 py-2 pl-8 pr-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                        isLesson(l.id)
                          ? 'border-l-indigo-500 bg-indigo-50 text-indigo-900'
                          : 'border-l-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{l.title ?? l.id}</span>
                      {l.isCheckpoint && <span className="text-amber-500" aria-hidden>★</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-200 p-3">
        <Button onClick={onAddLesson} className="w-full">+ Add lesson</Button>
      </div>
    </div>
  );
}
