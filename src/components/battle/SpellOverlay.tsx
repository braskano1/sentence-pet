import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import type { SpellChallenge } from '../../domain/battle';

/** Spot-the-error overlay: the boss casts a wrong sentence. Tap the wrong word
 *  to break the spell. Auto-resolves as a miss (-1) when the window expires. */
export function SpellOverlay({
  challenge,
  onResolve,
}: {
  challenge: SpellChallenge;
  onResolve: (wordIndex: number) => void;
}) {
  const windowMs = GAME_CONFIG.battle.spellWindowMs;
  const done = useRef(false);

  const resolve = (i: number) => {
    if (done.current) return;
    done.current = true;
    onResolve(i);
  };

  useEffect(() => {
    const t = setTimeout(() => resolve(-1), windowMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMs]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-violet-950/70 backdrop-blur-sm p-6 text-center">
      <p className="text-3xl font-black text-white drop-shadow">🔮 Spell! 🔮</p>
      <p className="mt-1 text-white/80">Tap the wrong word to break it!</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {challenge.words.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => resolve(i)}
            className="min-h-12 rounded-xl bg-white/90 px-4 py-2 text-lg font-bold text-slate-800 active:scale-95"
          >
            {w}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-violet-200">{challenge.tip}</p>
    </div>
  );
}
