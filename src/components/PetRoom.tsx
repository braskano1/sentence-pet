import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { StatBars } from './StatBars';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';
import { PressButton } from './PressButton';
import { DECOR_SPRITES } from '../config/decorSprites';

export function PetRoom() {
  const pet = useGameStore((s) => s.pet);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feed = useGameStore((s) => s.feed);
  const setScreen = useGameStore((s) => s.setScreen);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const bgSprite = activeBackground ? DECOR_SPRITES[activeBackground] : null;
  const [feedTrigger, setFeedTrigger] = useState(0);

  const xp = useCountUp(pet.xp);
  const coins = useCountUp(pet.coins);

  const available = FOOD_GROUPS.filter((g) => inventory[g] > 0);

  return (
    <div className={`relative flex h-full flex-col overflow-hidden p-6 ${bgSprite ? '' : 'bg-emerald-50'}`}>
      {bgSprite && (
        <>
          <img
            data-testid="room-bg"
            src={bgSprite}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* radial scrim: keeps the transparent-cutout pet + stats legible over busy art */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 45% at 50% 42%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)',
            }}
          />
        </>
      )}
      {/* middle zone: pet + stats, centered, grabs slack */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
        <PetSprite stage={stage} species={pet.species} happiness={pet.happiness} feedTrigger={feedTrigger} />
        <p className="text-slate-500">XP {xp} · 🪙 {coins}</p>
        <StatBars bars={pet.bars} happiness={pet.happiness} />
      </div>
      {/* bottom zone: actions pinned in the thumb arc */}
      <div className="relative z-10 flex flex-col gap-3">
        {available.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {available.map((g) => (
              <PressButton
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className={`min-h-12 flex-1 rounded-xl ${FOOD_META[g].color} px-4 py-3 text-base font-semibold text-white shadow`}
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </PressButton>
            ))}
          </div>
        )}
        <PressButton
          onClick={() => setScreen('shop')}
          className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Shop 🛒
        </PressButton>
        <PressButton
          onClick={() => setScreen('pickDrill')}
          className="min-h-12 w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </PressButton>
      </div>
    </div>
  );
}
