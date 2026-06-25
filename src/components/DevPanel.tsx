// src/components/DevPanel.tsx
// Dev-only cheat panel. Rendered by App ONLY when import.meta.env.DEV is true,
// so it is tree-shaken out of production builds. Pairs with `window.store`
// (set in main.tsx) for console access.
import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { pickSpecies } from '../domain/species';

function bumpHappiness(delta: number) {
  useGameStore.setState((s) => ({
    pet: {
      ...s.pet,
      happiness: Math.max(
        GAME_CONFIG.happiness.min,
        Math.min(GAME_CONFIG.happiness.max, s.pet.happiness + delta),
      ),
    },
  }));
}

function rerollSpecies() {
  useGameStore.setState((s) => ({ pet: { ...s.pet, species: pickSpecies() } }));
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const pet = useGameStore((s) => s.pet);
  const stage = useGameStore((s) => s.stage());
  const addXp = useGameStore((s) => s.addXpForTest);
  const addCoins = useGameStore((s) => s.addCoinsForTest);
  const reset = useGameStore((s) => s.resetForTest);
  const hatch = useGameStore((s) => s.hatch);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-2 right-2 z-50 rounded-full bg-fuchsia-700/80 px-3 py-1 text-xs font-mono text-white shadow"
      >
        dev
      </button>
    );
  }

  const btn = 'rounded bg-slate-700 px-2 py-1 text-xs font-mono text-white hover:bg-slate-600';

  return (
    <div className="fixed bottom-2 right-2 z-50 w-56 rounded-lg bg-slate-900/95 p-3 text-xs font-mono text-slate-100 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-fuchsia-300">DEV</span>
        <button type="button" onClick={() => setOpen(false)} className={btn}>×</button>
      </div>
      <div className="mb-2 leading-5">
        <div>species: <b>{pet.species}</b> · stage: <b>{stage}</b></div>
        <div>xp: <b>{pet.xp}</b> · 🪙 <b>{pet.coins}</b></div>
        <div>😊 <b>{pet.happiness}</b> · hatched: <b>{String(pet.hatched)}</b></div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button type="button" className={btn} onClick={() => addXp(50)}>+50xp</button>
        <button type="button" className={btn} onClick={() => addXp(1000)}>young</button>
        <button type="button" className={btn} onClick={() => addXp(3000)}>adult</button>
        <button type="button" className={btn} onClick={() => addCoins(100)}>+100🪙</button>
        <button type="button" className={btn} onClick={() => bumpHappiness(-25)}>😊-25</button>
        <button type="button" className={btn} onClick={() => bumpHappiness(25)}>😊+25</button>
        <button type="button" className={btn} onClick={rerollSpecies}>reroll</button>
        {!pet.hatched && <button type="button" className={btn} onClick={hatch}>hatch</button>}
        <button type="button" className={`${btn} bg-red-800 hover:bg-red-700`} onClick={reset}>reset</button>
      </div>
    </div>
  );
}
