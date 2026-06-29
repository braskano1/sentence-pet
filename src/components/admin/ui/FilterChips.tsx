export type FilterChip<T extends string> = { id: T; label: string };

/**
 * A controlled row of mutually-exclusive filter chips. `role="group"` of
 * `aria-pressed` toggle buttons — the active chip is pressed. Presentational;
 * the caller owns the active value and applies the filter.
 */
export function FilterChips<T extends string>({
  chips,
  active,
  onChange,
  label = 'Filter',
}: {
  chips: readonly FilterChip<T>[];
  active: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(c.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              isActive
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 text-slate-500 hover:text-slate-800'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
