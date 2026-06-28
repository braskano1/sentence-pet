import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGameStore } from '../state/gameStore';
import { getActivePetDefs } from '../domain/petDef';
import { spriteSrc } from '../config/sprites';
import { PressButton } from './PressButton';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

const dexNo = (n: number) => `#${String(n).padStart(3, '0')}`;

/** The dex catalog: every enabled PetDef as caught (full art) or undiscovered (silhouette). */
export function DexGrid() {
  const caughtDefIds = useGameStore(useShallow((s) => s.caughtDefIds));
  const caught = useMemo(() => new Set(caughtDefIds), [caughtDefIds]);
  const [selected, setSelected] = useState<PetDef | null>(null);

  const defs = getActivePetDefs()
    .filter((d) => d.enabled)
    .slice()
    .sort((a, b) => a.gen - b.gen || a.dexNo - b.dexNo);
  const caughtCount = defs.filter((d) => caught.has(d.id)).length;

  return (
    <div className="relative">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-900/60">
        Caught {caughtCount} / {defs.length}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {defs.map((d) => {
          const isCaught = caught.has(d.id);
          return (
            <PressButton
              key={d.id}
              onClick={() => setSelected(d)}
              aria-label={isCaught ? d.name : `Undiscovered ${dexNo(d.dexNo)}`}
              className="flex flex-col items-center rounded-xl bg-white/70 p-2"
            >
              <img
                src={spriteSrc(d.element, 'adult', 'happy', d)}
                alt=""
                aria-hidden
                className="h-14 w-14 object-contain"
                style={isCaught ? undefined : { filter: 'brightness(0)' }}
              />
              <span className="mt-0.5 text-[10px] font-bold text-amber-900/60">{dexNo(d.dexNo)}</span>
              <span className="text-[11px] font-extrabold text-amber-950">{isCaught ? d.name : '???'}</span>
            </PressButton>
          );
        })}
      </div>
      {selected && (
        <DexDetail def={selected} defs={defs} caught={caught} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
