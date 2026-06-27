import { useGameStore } from '../state/gameStore';
import type { ContentKind } from '../data/types';

/** Placeholder for activity kinds not yet built (flashcard/matching/fillblank).
 *  Built out in P2. Lets P1 ship a kind-routed shell without those screens. */
export function ComingSoon({ kind }: { kind: ContentKind }) {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xl font-semibold">"{kind}" activity coming soon</p>
      <button type="button" onClick={() => setScreen('pickDrill')} className="rounded-lg bg-slate-700 px-4 py-2">
        Back to map
      </button>
    </div>
  );
}
