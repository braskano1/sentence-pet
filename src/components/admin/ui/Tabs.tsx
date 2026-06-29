import type { KeyboardEvent } from 'react';

export type TabItem<T extends string> = { id: T; label: string };

/**
 * Accessible tablist for the admin console. Real `role="tab"` semantics with
 * `aria-selected` and roving arrow-key navigation. The active trigger is the
 * only one in the tab order (roving tabIndex). Tab *panels* are rendered by the
 * caller (this is a switcher, not a panel host).
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const activeIndex = tabs.findIndex((t) => t.id === active);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const next = (activeIndex + delta + tabs.length) % tabs.length;
    onChange(tabs[next].id);
  }

  return (
    <div role="tablist" className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
