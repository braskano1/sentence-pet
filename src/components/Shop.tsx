import { useGameStore } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { canAfford } from '../domain/shop';
import { fireConfetti, buzz } from '../effects/celebrate';

export function Shop() {
  const coins = useGameStore((s) => s.pet.coins);
  const happiness = useGameStore((s) => s.pet.happiness);
  const buyTreat = useGameStore((s) => s.buyTreat);
  const setScreen = useGameStore((s) => s.setScreen);
  const full = happiness >= GAME_CONFIG.happiness.max;

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-700">Shop</h2>
        <p className="text-slate-500">🪙 {coins}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {GAME_CONFIG.shop.treats.map((item) => {
          const afford = canAfford(coins, item);
          const disabled = full || !afford;
          const reason = full ? 'Already happy!' : !afford ? 'Not enough coins' : '';
          return (
            <button
              key={item.id}
              disabled={disabled}
              onClick={() => {
                buyTreat(item);
                fireConfetti();
                buzz();
              }}
              className={`min-h-16 w-full rounded-xl px-5 py-3 text-left shadow ${
                disabled ? 'bg-slate-200 text-slate-400' : 'bg-amber-500 text-white'
              }`}
            >
              <span className="font-semibold">{item.name}</span>{' '}
              <span>🪙 {item.price} · +{item.happiness} 😊</span>
              {disabled && <span className="block text-xs">{reason}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-slate-600 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        ← Back
      </button>
    </div>
  );
}
