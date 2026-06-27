import { motion, useReducedMotion } from 'framer-motion';
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';
import { HpBar } from './HpBar';
import { ChargeRing } from './ChargeRing';
import { useBattleStore } from '../../state/battleStore';
import { phaseScale } from '../../domain/bossTiers';

const BOX_H = 128; // reserved bounding box (px) = the largest phase's footprint

export function BossZone({ boss, hp, hpMax, onExit }: { boss: CheckpointBoss; hp: number; hpMax: number; onExit?: () => void }) {
  const charge = useBattleStore((s) => s.charge);
  const phaseIndex = useBattleStore((s) => s.phaseIndex);
  const bossPhases = useBattleStore((s) => s.bossPhases);
  const reduce = useReducedMotion();
  const scale = phaseScale(phaseIndex, bossPhases);
  const enraged = phaseIndex > 0;

  return (
    <div className="relative rounded-b-3xl bg-gradient-to-b from-fuchsia-950 to-indigo-950 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between text-xs text-fuchsia-100">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              aria-label="Leave battle"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-lg font-bold text-slate-500 shadow ring-1 ring-inset ring-slate-200"
            >
              ✕
            </button>
          )}
          <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold">
            {bossElementEmoji(boss)} {boss.element}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {bossPhases > 1 && (
            <span className="flex gap-1" aria-label={`phase ${phaseIndex + 1} of ${bossPhases}`}>
              {Array.from({ length: bossPhases }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${i <= phaseIndex ? 'bg-rose-400' : 'bg-white/30'}`}
                />
              ))}
            </span>
          )}
          <span className="font-semibold">{boss.name}</span>
          <ChargeRing fraction={charge} />
        </div>
      </div>

      {/* Reserved box = largest phase; the sprite scales WITHIN it so layout never shifts. */}
      <div className="mx-auto my-2 flex items-end justify-center" style={{ height: BOX_H }}>
        <motion.img
          src={bossSpriteSrc(boss)}
          alt={boss.name}
          draggable={false}
          className={`h-32 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)] ${
            enraged ? 'saturate-150 hue-rotate-[330deg]' : ''
          }`}
          style={{ transformOrigin: 'bottom center' }}
          animate={{ scale }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 14 }}
        />
      </div>

      <HpBar value={hp} max={hpMax} tone="boss" />
      <div className="mt-1 text-right text-[10px] text-fuchsia-200">
        {hp} / {hpMax}
      </div>
    </div>
  );
}
