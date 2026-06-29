import type { ReactNode } from 'react';

/**
 * Wraps a SINGLE labeled control (TextInput / NumberInput / Select) — the <label>
 * wraps the control, so do NOT nest a self-labeling control like Checkbox inside it
 * (that would produce invalid nested <label>s) and pass only one control as children.
 * aria-describedby wiring for the error is deferred to consumers that own the input id.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
