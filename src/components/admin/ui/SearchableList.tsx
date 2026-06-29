import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Generic, controlled master-list for admin surfaces. Renders a search box, an
 * optional filter slot, a "N of M" count, scrollable rows (with a built-in
 * empty state), and an optional footer. The caller owns query + selection state
 * and supplies `searchText` (the haystack each row is matched against) and
 * `renderRow`. Text search is substring, case-insensitive. Filtering by chips is
 * the caller's job — pass already-filtered `items` and the pre-filter `total`.
 *
 * The 2px left border on the selected row is a selection STATE, not a
 * decorative side-stripe.
 */
export function SearchableList<T>({
  items,
  getKey,
  selectedKey,
  onSelect,
  renderRow,
  searchText,
  query,
  onQuery,
  total,
  placeholder = 'Search…',
  filterSlot,
  footer,
  countNoun = 'item',
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  renderRow: (item: T, selected: boolean) => ReactNode;
  searchText: (item: T) => string;
  query: string;
  onQuery: (q: string) => void;
  total?: number;
  placeholder?: string;
  filterSlot?: ReactNode;
  footer?: ReactNode;
  countNoun?: string;
}) {
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => searchText(i).toLowerCase().includes(q)) : items;
  const totalN = total ?? items.length;
  const searchId = useId();

  return (
    <div className="flex w-80 shrink-0 flex-col self-start rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
        <label htmlFor={searchId} className="sr-only">Search</label>
        <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-400 focus-within:border-indigo-400">
          <span aria-hidden>🔎</span>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none"
          />
        </div>
        {filterSlot}
      </div>

      <div className="px-3 py-1.5 text-xs text-slate-500">
        {shown.length} of {totalN} {countNoun}{totalN === 1 ? '' : 's'}
      </div>

      <ul className="max-h-[28rem] flex-1 overflow-auto">
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            No matches{query ? <> for &ldquo;{query}&rdquo;</> : null}.
          </li>
        ) : (
          shown.map((item) => {
            const key = getKey(item);
            const selected = key === selectedKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-current={selected}
                  onClick={() => onSelect(key)}
                  className={`block w-full border-l-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {renderRow(item, selected)}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {footer && <div className="border-t border-slate-200 p-3">{footer}</div>}
    </div>
  );
}
