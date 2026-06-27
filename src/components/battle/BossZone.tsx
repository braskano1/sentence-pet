import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';
import { HpBar } from './HpBar';

export function BossZone({ boss, hp, hpMax }: { boss: CheckpointBoss; hp: number; hpMax: number }) {
  return (
    <div className="relative rounded-b-3xl bg-gradient-to-b from-fuchsia-950 to-indigo-950 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between text-xs text-fuchsia-100">
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold">
          {bossElementEmoji(boss)} {boss.element}
        </span>
        <span className="font-semibold">{boss.name}</span>
      </div>
      <img
        src={bossSpriteSrc(boss)}
        alt={boss.name}
        draggable={false}
        className="mx-auto my-2 h-28 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]"
      />
      <HpBar value={hp} max={hpMax} tone="boss" />
      <div className="mt-1 text-right text-[10px] text-fuchsia-200">
        {hp} / {hpMax}
      </div>
    </div>
  );
}
