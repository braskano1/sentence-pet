import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { useCountUp } from '../effects/useCountUp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';
import { PressButton } from './PressButton';
import { DECOR_SPRITES } from '../config/decorSprites';
import { health } from '../domain/pet';
import { barColor } from '../domain/bars';
import type { Species } from '../data/types';

/** Friendly, A1-readable pet name per species; level reads off the growth stage. */
const PET_NAME: Record<Species, string> = { leaf: 'Sprout', fire: 'Ember', air: 'Breeze', water: 'Bubble' };
const STAGE_LEVEL: Record<string, number> = { egg: 0, baby: 1, young: 2, adult: 3 };

/** One stat = icon + slim track + value, sitting on the solid warm panel (always legible). */
function StatChip({ icon, value, fill }: { icon: string; value: number; fill: string }) {
  const shown = useCountUp(value);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-amber-950/15">
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-7 text-right text-xs font-bold tabular-nums text-amber-950">{shown}</span>
    </div>
  );
}

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

  const stats = [
    { key: 'health', icon: '❤️', value: health(pet.bars), fill: barColor(health(pet.bars), 'bg-rose-500') },
    { key: 'happy', icon: '😊', value: pet.happiness, fill: barColor(pet.happiness, 'bg-yellow-400') },
    ...FOOD_GROUPS.map((g) => ({
      key: g,
      icon: FOOD_META[g].emoji,
      value: pet.bars[g],
      fill: barColor(pet.bars[g], FOOD_META[g].color),
    })),
  ];

  return (
    <div className={`relative flex h-full flex-col overflow-hidden ${bgSprite ? '' : 'bg-emerald-50'}`}>
      {/* ── scene: room art + pet, art kept clean of UI ── */}
      {bgSprite && (
        <img
          data-testid="room-bg"
          src={bgSprite}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {/* soft glow lifts the pet off busy art without dimming the whole room */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 52% 40% at 50% 46%, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)',
          }}
        />
        <div className="relative drop-shadow-[0_14px_26px_rgba(0,0,0,0.4)]">
          <PetSprite stage={stage} species={pet.species} happiness={pet.happiness} feedTrigger={feedTrigger} />
        </div>
      </div>

      {/* ── carved warm panel: name, stats, care + actions live in the world ── */}
      <div
        className="relative z-10 rounded-t-[2rem] border-t-4 border-amber-900/30 px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 60%,#ebcb91 100%)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="rounded-full bg-amber-900/15 px-3 py-1 text-sm font-extrabold text-amber-950">
              {PET_NAME[pet.species]} · Lv {STAGE_LEVEL[stage] || 1}
            </span>
            <span className="text-xs font-semibold text-amber-900/70 tabular-nums">XP {xp}</span>
          </div>
          <span className="rounded-full bg-amber-950/85 px-3 py-1 text-sm font-bold text-amber-50 tabular-nums">
            🪙 {coins}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2">
          {stats.map((s) => (
            <StatChip key={s.key} icon={s.icon} value={s.value} fill={s.fill} />
          ))}
        </div>

        {available.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {available.map((g) => (
              <PressButton
                key={g}
                onClick={() => {
                  feed(g);
                  setFeedTrigger((n) => n + 1);
                }}
                className={`min-h-11 flex-1 rounded-xl border-b-4 border-black/20 ${FOOD_META[g].color} px-3 py-2 text-sm font-bold text-white shadow active:translate-y-0.5 active:border-b-2`}
              >
                Feed {FOOD_META[g].emoji} ({inventory[g]})
              </PressButton>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <PressButton
            onClick={() => setScreen('shop')}
            className="min-h-12 flex-1 rounded-2xl border-b-4 border-amber-900/50 bg-amber-500 px-6 py-3 text-lg font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2"
          >
            Shop 🛒
          </PressButton>
          <PressButton
            onClick={() => setScreen('pickDrill')}
            className="min-h-12 flex-1 rounded-2xl border-b-4 border-emerald-800 bg-emerald-500 px-6 py-3 text-lg font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2"
          >
            Play ▶
          </PressButton>
        </div>
      </div>
    </div>
  );
}
