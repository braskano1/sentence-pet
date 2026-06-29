import { useId, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Searchable multi-select. Replaces admin checkbox walls: an internal search box
 * filters `items` by `searchText`, each row is a `role="checkbox"` button whose
 * accessible name comes from `ariaLabel`. Selection is owned by the caller
 * (`isSelected` + `onToggle`); this component holds only the query.
 */
export function AssignList<T>({
  items,
  getKey,
  isSelected,
  onToggle,
  renderLabel,
  searchText,
  ariaLabel,
  placeholder = 'Search…',
  emptyHint = 'No items.',
  headerNote,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  renderLabel: (item: T) => ReactNode;
  searchText: (item: T) => string;
  ariaLabel?: (item: T) => string;
  placeholder?: string;
  emptyHint?: string;
  headerNote?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => searchText(i).toLowerCase().includes(q)) : items;
  const searchId = useId();

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span aria-hidden>🔎</span>
        <label htmlFor={searchId} className="sr-only">Filter items</label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-700 outline-none"
        />
        {headerNote && <span className="ml-auto shrink-0 text-slate-400">{headerNote}</span>}
      </div>
      <ul className="max-h-72 overflow-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-slate-400">{emptyHint}</li>
        ) : (
          shown.map((item) => {
            const key = getKey(item);
            const selected = isSelected(item);
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={ariaLabel ? ariaLabel(item) : key}
                  onClick={() => onToggle(item)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[11px] text-white ${
                      selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                    }`}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{renderLabel(item)}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
