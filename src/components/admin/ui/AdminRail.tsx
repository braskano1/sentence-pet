import type { KeyboardEvent } from 'react';

export type RailItem<T extends string> = { id: T; label: string; count?: number; emoji?: string };
export type RailGroup<T extends string> = { heading: string; items: RailItem<T>[] };

/**
 * Grouped vertical nav for the admin console. Real `role="tablist"` semantics
 * (vertical orientation) with `aria-selected` + roving tabIndex and Up/Down arrow
 * navigation across the flattened item order. Group headings are presentational.
 * Panels are rendered by the caller (this is a switcher, not a panel host).
 */
export function AdminRail<T extends string>({
  groups,
  active,
  onSelect,
}: {
  groups: readonly RailGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  const flat = groups.flatMap((g) => g.items);
  const activeIndex = flat.findIndex((i) => i.id === active);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const next = (activeIndex + delta + flat.length) % flat.length;
    onSelect(flat[next].id);
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Admin sections"
      className="flex w-52 shrink-0 flex-col gap-4 border-r border-slate-200 py-4 pr-4"
    >
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">
            {group.heading}
          </p>
          {group.items.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(item.id)}
                onKeyDown={onKeyDown}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.emoji && <span aria-hidden>{item.emoji}</span>}
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums text-slate-400">{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
