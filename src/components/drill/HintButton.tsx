/** Reveals the current slot's correct word (resets the streak; counts as a slip). */
export function HintButton({ onHint, disabled }: { onHint: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onHint}
      disabled={disabled}
      className="flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700 ring-1 ring-inset ring-violet-200 transition active:scale-95 disabled:opacity-40"
    >
      💡 Hint
    </button>
  );
}
