import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40',
  ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-40',
};

export function Button({
  variant = 'primary',
  type,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type ?? 'button'}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
