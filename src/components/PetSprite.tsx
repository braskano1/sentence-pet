import type { PetStage } from '../data/types';

const ART: Record<PetStage, string> = {
  egg: '🥚',
  baby: '🐣',
  young: '🐕',
  adult: '🐕‍🦺',
};

export function PetSprite({ stage }: { stage: PetStage }) {
  return (
    <div
      className="select-none leading-none text-[clamp(4rem,18vh,8rem)]"
      aria-label={`pet-${stage}`}
    >
      {ART[stage]}
    </div>
  );
}
