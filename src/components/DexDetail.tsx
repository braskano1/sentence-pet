import type { PetDef } from '../data/types';
import { evolutionChain } from '../domain/dex';
import { spriteSrc } from '../config/sprites';
import { ELEMENT_EMOJI, PET_NAME } from '../config/petDisplay';
import { PressButton } from './PressButton';

const dexNo = (n: number) => `#${String(n).padStart(3, '0')}`;

/** One chain node: full art + name if caught, silhouette + ??? if not. */
function ChainNode({ def, caught }: { def: PetDef; caught: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={spriteSrc(def.element, 'adult', 'happy', def)}
        alt={caught ? def.name : 'Undiscovered'}
        className="h-16 w-16 object-contain"
        style={caught ? undefined : { filter: 'brightness(0)' }}
      />
      <span className="text-[10px] font-bold text-amber-900/60">{dexNo(def.dexNo)}</span>
      <span className="text-xs font-extrabold text-amber-950">{caught ? def.name : '???'}</span>
    </div>
  );
}

/** Detail overlay for one dex entry: shows its full evolution chain (def-chain). */
export function DexDetail({
  def, defs, caught, onClose,
}: {
  def: PetDef;
  defs: readonly PetDef[];
  caught: Set<string>;
  onClose: () => void;
}) {
  const chain = evolutionChain(def, defs);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-amber-50 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-amber-950">Evolution</h3>
          <PressButton
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-amber-900/15 px-3 py-1 text-sm font-bold text-amber-950"
          >
            ✕
          </PressButton>
        </div>
        <div className="flex items-center justify-center gap-1">
          {chain.map((d, i) => (
            <div key={d.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-amber-900/40">→</span>}
              <ChainNode def={d} caught={caught.has(d.id)} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-amber-900/70">
          {ELEMENT_EMOJI[def.element]} {PET_NAME[def.element]} · {def.types.join(', ')} · {dexNo(def.dexNo)}
        </p>
      </div>
    </div>
  );
}
