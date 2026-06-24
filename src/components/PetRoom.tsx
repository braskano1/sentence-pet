import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { StatBars } from './StatBars';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';

export function PetRoom() {
  const pet = useGameStore((s) => s.pet);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feed = useGameStore((s) => s.feed);
  const setScreen = useGameStore((s) => s.setScreen);
  const [feedTrigger, setFeedTrigger] = useState(0);

  const xp = useCountUp(pet.xp);
  const coins = useCountUp(pet.coins);

  const available = FOOD_GROUPS.filter((g) => inventory[g] > 0);

  return (
    <div className="flex h-full flex-col bg-emerald-50 p-6">
      {/* middle zone: pet + stats, centered, grabs slack */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <PetSprite stage={stage} feedTrigger={feedTrigger} />
        <p className="text-slate-500">XP {xp} · 🪙 {coins}</p>
        <StatBars bars={pet.bars} happiness={pet.happiness} />
      </div>
      {/* bottom zone: actions pinned in the thumb arc */}
      <div className="flex flex-col gap-3">
        {available.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {available.map((g) => (
              <button
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className={`min-h-12 flex-1 rounded-xl ${FOOD_META[g].color} px-4 py-3 text-base font-semibold text-white shadow`}
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setScreen('pickDrill')}
          className="min-h-12 w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </button>
      </div>
    </div>
  );
}
