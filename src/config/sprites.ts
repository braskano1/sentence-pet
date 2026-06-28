import type { PetDef, PetMood, PetStage, Species } from '../data/types';

import egg from '../assets/sprites/egg.webp';

import leafBabyHappy from '../assets/sprites/leaf/baby-happy.webp';
import leafBabySad from '../assets/sprites/leaf/baby-sad.webp';
import leafYoungHappy from '../assets/sprites/leaf/young-happy.webp';
import leafYoungSad from '../assets/sprites/leaf/young-sad.webp';
import leafAdultHappy from '../assets/sprites/leaf/adult-happy.webp';
import leafAdultSad from '../assets/sprites/leaf/adult-sad.webp';

import fireBabyHappy from '../assets/sprites/fire/baby-happy.webp';
import fireBabySad from '../assets/sprites/fire/baby-sad.webp';
import fireYoungHappy from '../assets/sprites/fire/young-happy.webp';
import fireYoungSad from '../assets/sprites/fire/young-sad.webp';
import fireAdultHappy from '../assets/sprites/fire/adult-happy.webp';
import fireAdultSad from '../assets/sprites/fire/adult-sad.webp';

import airBabyHappy from '../assets/sprites/air/baby-happy.webp';
import airBabySad from '../assets/sprites/air/baby-sad.webp';
import airYoungHappy from '../assets/sprites/air/young-happy.webp';
import airYoungSad from '../assets/sprites/air/young-sad.webp';
import airAdultHappy from '../assets/sprites/air/adult-happy.webp';
import airAdultSad from '../assets/sprites/air/adult-sad.webp';

import waterBabyHappy from '../assets/sprites/water/baby-happy.webp';
import waterBabySad from '../assets/sprites/water/baby-sad.webp';
import waterYoungHappy from '../assets/sprites/water/young-happy.webp';
import waterYoungSad from '../assets/sprites/water/young-sad.webp';
import waterAdultHappy from '../assets/sprites/water/adult-happy.webp';
import waterAdultSad from '../assets/sprites/water/adult-sad.webp';

import eggLeaf from '../assets/sprites/eggs/leaf.webp';
import eggFire from '../assets/sprites/eggs/fire.webp';
import eggAir from '../assets/sprites/eggs/air.webp';
import eggWater from '../assets/sprites/eggs/water.webp';

/** Stages that have a per-species sprite (egg is generic, see EGG_SPRITE). */
type SpriteStage = Exclude<PetStage, 'egg'>;

export const EGG_SPRITE: string = egg;

export const SPRITES: Record<Species, Record<SpriteStage, Record<PetMood, string>>> = {
  leaf: {
    baby: { happy: leafBabyHappy, sad: leafBabySad },
    young: { happy: leafYoungHappy, sad: leafYoungSad },
    adult: { happy: leafAdultHappy, sad: leafAdultSad },
  },
  fire: {
    baby: { happy: fireBabyHappy, sad: fireBabySad },
    young: { happy: fireYoungHappy, sad: fireYoungSad },
    adult: { happy: fireAdultHappy, sad: fireAdultSad },
  },
  air: {
    baby: { happy: airBabyHappy, sad: airBabySad },
    young: { happy: airYoungHappy, sad: airYoungSad },
    adult: { happy: airAdultHappy, sad: airAdultSad },
  },
  water: {
    baby: { happy: waterBabyHappy, sad: waterBabySad },
    young: { happy: waterYoungHappy, sad: waterYoungSad },
    adult: { happy: waterAdultHappy, sad: waterAdultSad },
  },
};

/** Single source of truth for resolving a pet's artwork. Egg is generic and never
 *  overridable. With a `def`, a sprite override resolves variant → default → element art. */
export function spriteSrc(species: Species, stage: PetStage, mood: PetMood, def?: PetDef): string {
  if (stage === 'egg') return EGG_SPRITE;
  return def?.sprite?.variants?.[stage]?.[mood] ?? def?.sprite?.default ?? SPRITES[species][stage][mood];
}

/** Reserved for Phase B (species shop icons). Unused by Phase 0 components. */
export const ELEMENTAL_EGGS: Record<Species, string> = {
  leaf: eggLeaf,
  fire: eggFire,
  air: eggAir,
  water: eggWater,
};
