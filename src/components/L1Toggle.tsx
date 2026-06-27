import { useGameStore } from '../state/gameStore';

/** TH/ENG toggle. Caller renders this only when the unit's l1Enabled is true. */
export function L1Toggle() {
  const mode = useGameStore((s) => s.l1Mode);
  const setMode = useGameStore((s) => s.setL1Mode);
  return (
    <div role="group" aria-label="Language helper" className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-bold">
      {(['TH', 'ENG'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`rounded-full px-3 py-1 ${mode === m ? 'bg-sky-500 text-white' : 'text-slate-500'}`}
        >
          {m === 'TH' ? '🇹🇭 ไทย' : 'ENG'}
        </button>
      ))}
    </div>
  );
}
