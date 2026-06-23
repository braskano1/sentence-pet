import { useGameStore } from '../state/gameStore';

export function RewardScreen() {
  const reward = useGameStore((s) => s.lastReward);
  const setScreen = useGameStore((s) => s.setScreen);
  if (!reward) return null;

  return (
    <div className="flex h-full flex-col bg-amber-50 p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold text-amber-700">Level cleared!</h1>
        <p className="text-4xl">{'⭐'.repeat(reward.stars)}</p>
        <p className="text-lg text-slate-700">You earned {reward.food} 🥩 protein</p>
        <p className="text-lg text-slate-700">+{reward.coins} coins</p>
      </div>
      <button
        onClick={() => setScreen('petRoom')}
        className="min-h-12 w-full rounded-xl bg-amber-500 px-6 py-3 text-lg font-semibold text-white shadow"
      >
        Continue
      </button>
    </div>
  );
}
