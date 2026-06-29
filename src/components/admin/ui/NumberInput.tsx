import type { InputHTMLAttributes } from 'react';

export function NumberInput({
  onValueChange,
  invalid,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
  onValueChange: (n: number | null) => void;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        if (e.target.value === '') {
          onValueChange(null);
          return;
        }
        const n = e.target.valueAsNumber;
        if (!Number.isNaN(n)) onValueChange(n);
      }}
      className={`w-20 rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
