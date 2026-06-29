import type { InputHTMLAttributes } from 'react';

export function TextInput({
  invalid,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      type="text"
      aria-invalid={invalid || undefined}
      className={`rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
