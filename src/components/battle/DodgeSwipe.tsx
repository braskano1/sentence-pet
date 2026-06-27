import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';

const SWIPE_PX = 48; // horizontal distance that counts as a dodge swipe

/** Active swipe-to-dodge overlay. Calls onResolve(true) on a valid swipe,
 *  onResolve(false) once the window expires. Reflex only — no reading. */
export function DodgeSwipe({ onResolve }: { onResolve: (success: boolean) => void }) {
  const windowMs = GAME_CONFIG.battle.timer.swipeWindowMs;
  const startX = useRef<number | null>(null);
  const done = useRef(false);

  const resolve = (success: boolean) => {
    if (done.current) return;
    done.current = true;
    onResolve(success);
  };

  useEffect(() => {
    const t = setTimeout(() => resolve(false), windowMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMs]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-rose-950/60 backdrop-blur-sm"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current !== null && Math.abs(e.clientX - startX.current) >= SWIPE_PX) {
          resolve(true);
        }
        startX.current = null;
      }}
    >
      <p className="text-4xl font-black text-white drop-shadow">⚡ SWIPE! ⚡</p>
      <p className="mt-1 text-white/80">Swipe to dodge!</p>
      <div className="mt-3 text-3xl text-white/90">⟵ 💨 ⟶</div>
    </div>
  );
}
