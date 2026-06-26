/** Round status: streak chip + a node per item (done / current / pending). Cosmetic. */
export function DrillHeader({ streak, index, total }: { streak: number; index: number; total: number }) {
  return (
    <div className="flex items-center justify-between">
      <span
        data-testid="streak"
        className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200"
      >
        🔥 {streak}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-testid={`track-node-${i}`}
            className={`h-2.5 w-2.5 rounded-full ${
              i < index ? 'bg-amber-400' : i === index ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-white ring-1 ring-inset ring-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
