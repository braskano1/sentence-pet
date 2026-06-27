interface StarPipsProps {
  n: number;
  max?: number;
  className?: string;
}

/** Compact star rating: `n` filled (amber via parent), the rest muted. Decorative. */
export function StarPips({ n, max = 3, className = '' }: StarPipsProps) {
  const filled = Math.min(Math.max(0, n), max);
  return (
    <span className={`text-[11px] leading-none tracking-tight ${className}`} aria-hidden="true">
      {'★'.repeat(filled)}
      <span className="text-slate-300">{'★'.repeat(max - filled)}</span>
    </span>
  );
}
