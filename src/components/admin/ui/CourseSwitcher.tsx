import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { CourseIndexEntry } from '../../../content/course';

/**
 * Header control that shows the active course and switches the editing context.
 * Trigger opens an absolutely-positioned `role="listbox"` (z-50, so it is not
 * clipped — keep it out of any `overflow-hidden` ancestor). Escape and
 * select-then-close are handled here; the caller loads the chosen course.
 */
export function CourseSwitcher({
  courses,
  activeId,
  onSelect,
}: {
  courses: readonly CourseIndexEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = courses.find((c) => c.id === activeId);

  function choose(id: string) {
    setOpen(false);
    if (id !== activeId) onSelect(id);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {active?.emoji && <span aria-hidden>{active.emoji}</span>}
        <span>{active?.title ?? 'Select course'}</span>
        {active && <code className="rounded bg-slate-100 px-1 text-xs text-slate-500">{active.id}</code>}
        <span aria-hidden className="text-slate-400">▾</span>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            aria-label="Courses"
            onKeyDown={onKeyDown}
            tabIndex={-1}
            className="absolute left-0 top-full z-50 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {courses.map((c) => {
              const selected = c.id === activeId;
              return (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(c.id)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                    selected ? 'font-semibold text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  {c.emoji && <span aria-hidden>{c.emoji}</span>}
                  <span className="flex-1">{c.title}</span>
                  {selected && <span aria-hidden className="text-indigo-500">✓</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
