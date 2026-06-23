import { useGameStore } from '../state/gameStore';
import { PetSprite } from './PetSprite';
import { StatBars } from './StatBars';

export function PetRoom() {
  const pet = useGameStore((s) => s.pet);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feedAll = useGameStore((s) => s.feedAll);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="flex h-full flex-col bg-emerald-50 p-6">
      {/* middle zone: pet + stats, centered, grabs slack */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <PetSprite stage={stage} />
        <p className="text-slate-500">XP {pet.xp} · 🪙 {pet.coins}</p>
        <StatBars bars={pet.bars} happiness={pet.happiness} />
      </div>
      {/* bottom zone: actions pinned in the thumb arc */}
      <div className="flex gap-4">
        <button
          onClick={feedAll}
          disabled={inventory.protein === 0}
          className="min-h-12 flex-1 rounded-xl bg-orange-500 px-6 py-3 text-lg font-semibold text-white shadow disabled:opacity-40"
        >
          Feed ({inventory.protein} 🥩)
        </button>
        <button
          onClick={() => setScreen('drill')}
          className="min-h-12 flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow"
        >
          Play ▶
        </button>
      </div>
    </div>
  );
}
