import type { SelectHTMLAttributes } from 'react';

export function Select({
  invalid,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`rounded-md border bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
