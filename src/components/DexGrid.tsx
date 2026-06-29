import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGameStore } from '../state/gameStore';
import { usePetDefs } from '../state/usePetDefs';
import { spriteSrc } from '../config/sprites';
import { formatDexNo, STAGE_NAME } from '../config/petDisplay';
import { dexLines, latestUnlockedInChain, stageForChainPosition } from '../domain/dex';
import { PressButton } from './PressButton';
import { DexDetail } from './DexDetail';
import type { PetDef } from '../data/types';

/** The dex catalog: one card per evolution line. Card art is the latest stage the
 *  player has caught in that line; undiscovered lines show the base-form silhouette. */
export function DexGrid() {
  const caughtDefIds = useGameStore(useShallow((s) => s.caughtDefIds));
  const caught = useMemo(() => new Set(caughtDefIds), [caughtDefIds]);
  const [selected, setSelected] = useState<PetDef | null>(null);

  // Reactive catalog: re-renders when hydratePetDefs swaps the registry post-mount.
  const allDefs = usePetDefs();

  // One card per line; gate visibility by the root's enabled flag (chains are
  // walked over the full catalog so a disabled later stage doesn't truncate shape).
  const lines = useMemo(
    () => dexLines(allDefs).filter((line) => line[0].enabled),
    [allDefs],
  );
  // Collection count stays per-creature: enabled defs caught / total enabled.
  const enabledDefs = useMemo(() => allDefs.filter((d) => d.enabled), [allDefs]);
  const caughtCount = enabledDefs.filter((d) => caught.has(d.id)).length;

  return (
    <div className="relative">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-900/60">
        Caught {caughtCount} / {enabledDefs.length}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {lines.map((chain) => {
          const root = chain[0];
          const latest = latestUnlockedInChain(chain, caught);
          const shown = latest ?? { def: root, index: 0 };
          const stage = stageForChainPosition(shown.index, chain.length);
          const isCaught = latest !== null;
          return (
            <PressButton
              key={root.id}
              onClick={() => setSelected(root)}
              aria-label={isCaught ? shown.def.name : `Undiscovered ${formatDexNo(root.dexNo)}`}
              className="relative flex flex-col items-center rounded-xl bg-white/70 p-2"
            >
              {isCaught && (
                <span className="absolute right-1 top-1 rounded bg-amber-200 px-1 text-[8px] font-extrabold uppercase tracking-wide text-amber-800">
                  {STAGE_NAME[stage]}
                </span>
              )}
              <img
                src={spriteSrc(shown.def.element, stage, 'happy', shown.def)}
                alt=""
                aria-hidden
                className="h-14 w-14 object-contain"
                style={isCaught ? undefined : { filter: 'brightness(0)' }}
              />
              <span className="mt-0.5 text-[10px] font-bold text-amber-900/60">{formatDexNo(root.dexNo)}</span>
              <span className="text-[11px] font-extrabold text-amber-950">{isCaught ? shown.def.name : '???'}</span>
            </PressButton>
          );
        })}
      </div>
      {selected && (
        <DexDetail def={selected} defs={allDefs} caught={caught} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
