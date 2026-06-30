import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkBook } from 'xlsx';
import { downloadWorkbook } from '../../../content/downloadWorkbook';
import { downloadText } from '../../../content/downloadText';
import { mergeById } from '../../../content/mergeById';
import type { MergeChange, MergeResult } from '../../../content/mergeById';
import { Button } from './Button';
import { ValidationSummary } from './ValidationSummary';

const STATUS_LABEL: Record<MergeChange<unknown>['status'], string> = {
  new: 'new',
  updated: 'upd',
  unchanged: 'same',
};

/**
 * Per-surface additive import drawer. Reads a file via the injected `parseFile`
 * (production wires an xlsx reader + surface adapter; tests inject a fake), diffs
 * the parsed entities against `existing` by id, previews New/Updated/Unchanged,
 * and on apply hands the fully merged collection to `onApply`. Additive: nothing
 * in `existing` is ever dropped.
 */
export function ImportDrawer<T>({
  open,
  title,
  noun,
  existing,
  getId,
  parseFile,
  onApply,
  onClose,
  renderChange,
  downloadTemplate,
  downloadGuide,
}: {
  open: boolean;
  title: string;
  noun: string;                                  // singular, e.g. "item"
  existing: readonly T[];
  getId: (item: T) => string;
  parseFile: (file: File) => Promise<{ entities: T[]; errors: string[] }>;
  onApply: (merged: T[]) => void;
  onClose: () => void;
  renderChange: (change: MergeChange<T>) => ReactNode;
  downloadTemplate?: { filename: string; build: () => WorkBook };
  downloadGuide?: { filename: string; content: string };
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<MergeResult<T> | null>(null);
  const inputId = useId();
  const titleId = useId();

  // Reset all transient state each time the drawer opens.
  useEffect(() => {
    if (open) { setFileName(null); setErrors([]); setResult(null); }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onFile(file: File) {
    setFileName(file.name);
    try {
      const { entities, errors: parseErrors } = await parseFile(file);
      setErrors(parseErrors);
      setResult(parseErrors.length ? null : mergeById(existing, entities, getId));
    } catch (err) {
      setErrors([`Could not read file: ${err instanceof Error ? err.message : String(err)}`]);
      setResult(null);
    }
  }

  const changeCount = result ? result.counts.new + result.counts.updated : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span aria-hidden>⬇</span>
          <h3 id={titleId} className="text-base font-semibold text-slate-800">{title}</h3>
          <span className="flex-1" />
          <button type="button" aria-label="Close import" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
          <label htmlFor={inputId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-6 hover:border-indigo-400">
            <span aria-hidden style={{ fontSize: 22 }}>📄</span>
            <span className="flex flex-col">
              <span className="font-medium text-slate-700">{fileName ?? 'Choose a file (.xlsx)'}</span>
              <span className="text-xs text-slate-400">Additive merge: adds new and updates matches by id. Nothing is deleted.</span>
            </span>
            <input
              id={inputId}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </label>

          {(downloadTemplate || downloadGuide) && (
            <div className="flex flex-col gap-1">
              {downloadTemplate && (
                <button
                  type="button"
                  onClick={() => downloadWorkbook(downloadTemplate.build(), downloadTemplate.filename)}
                  className="self-start text-xs font-medium text-indigo-600 hover:underline"
                >
                  <span aria-hidden="true">↓ </span>Download {noun} template (with examples)
                </button>
              )}
              {downloadGuide && (
                <button
                  type="button"
                  onClick={() => downloadText(downloadGuide.content, downloadGuide.filename)}
                  className="self-start text-xs font-medium text-indigo-600 hover:underline"
                >
                  <span aria-hidden="true">↓ </span>Download AI authoring guide (.md)
                </button>
              )}
            </div>
          )}

          <ValidationSummary errors={errors} />

          {result && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat n={result.counts.new} label="new" tone="text-emerald-600" />
                <Stat n={result.counts.updated} label="updated" tone="text-indigo-600" />
                <Stat n={result.counts.unchanged} label="unchanged" tone="text-slate-400" />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Changes ({changeCount})
                </p>
                <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {result.changes
                    .filter((c) => c.status !== 'unchanged')
                    .map((c) => (
                      <li key={getId(c.incoming)} className="flex items-center gap-2 px-3 py-2">
                        <span className={`shrink-0 rounded px-1.5 text-[11px] font-semibold ${
                          c.status === 'new' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{renderChange(c)}</span>
                      </li>
                    ))}
                  {changeCount === 0 && (
                    <li className="px-3 py-3 text-center text-slate-400">Nothing to apply. Every {noun} matches.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <span className="flex-1" />
          {result && (
            <Button
              variant="primary"
              disabled={changeCount === 0}
              onClick={() => { onApply(result.merged); onClose(); }}
            >
              Apply {changeCount} change{changeCount === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <p className={`text-lg font-bold tabular-nums ${tone}`}>
        {`${n} ${label}`}
      </p>
    </div>
  );
}
