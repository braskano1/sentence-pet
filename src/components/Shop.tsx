import { motion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { useCountUp } from '../effects/useCountUp';
import { TreatCard } from './TreatCard';

export function Shop() {
  const coins = useGameStore((s) => s.pet.coins);
  const happiness = useGameStore((s) => s.pet.happiness);
  const setScreen = useGameStore((s) => s.setScreen);
  const shownCoins = useCountUp(coins);
  const full = happiness >= GAME_CONFIG.happiness.max;

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {shownCoins}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {GAME_CONFIG.shop.treats.map((item, index) => (
          <TreatCard key={item.id} item={item} coins={coins} full={full} index={index} />
        ))}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </motion.button>
    </div>
  );
}
