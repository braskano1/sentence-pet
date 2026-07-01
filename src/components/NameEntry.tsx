import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { sanitizeName, NAME_MAX, NAME_MIN } from '../domain/playerName';

const HINT: Record<string, string> = {
  length: `Use ${NAME_MIN}–${NAME_MAX} letters.`,
  charset: 'Use letters only — no numbers or symbols.',
  blocked: 'Please pick a different name.',
};

/** Post-hatch onboarding scene: capture the player's display name. */
export function NameEntry() {
  const setDisplayName = useGameStore((s) => s.setDisplayName);
  const setScreen = useGameStore((s) => s.setScreen);
  const [raw, setRaw] = useState('');
  const result = useMemo(() => sanitizeName(raw), [raw]);
  const showHint = raw.trim().length > 0 && !result.ok;

  const confirm = () => {
    if (!result.ok) return;
    setDisplayName(result.name);
    setScreen('petRoom');
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-amber-50 to-amber-100 p-6 text-amber-900">
      <h1 className="text-2xl font-extrabold">What should we call you?</h1>
      <input
        type="text"
        aria-label="Your name"
        value={raw}
        maxLength={NAME_MAX}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        className="w-64 rounded-2xl border-2 border-amber-300 bg-white px-4 py-3 text-center text-lg font-bold outline-none focus:border-amber-500"
        placeholder="Type your name"
      />
      <p className="h-5 text-sm text-amber-700">{showHint ? HINT[result.reason ?? 'charset'] : ''}</p>
      <button
        type="button"
        disabled={!result.ok}
        onClick={confirm}
        className="rounded-full bg-amber-500 px-8 py-3 text-lg font-extrabold text-white shadow disabled:opacity-40"
      >
        That's me!
      </button>
    </div>
  );
}
