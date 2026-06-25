import type { Species } from '../data/types';

/** Each element is strong vs the species it maps to: Water>Fire>Air>Leaf>Water. */
export const STRONG_VS: Record<Species, Species> = {
  water: 'fire',
  fire: 'air',
  air: 'leaf',
  leaf: 'water',
};

export const TYPE_STRONG = 1.5;
export const TYPE_WEAK = 0.75;
export const TYPE_NEUTRAL = 1.0;

/** Damage multiplier for `attacker` hitting `defender`. */
export function typeMultiplier(attacker: Species, defender: Species): number {
  if (STRONG_VS[attacker] === defender) return TYPE_STRONG;
  if (STRONG_VS[defender] === attacker) return TYPE_WEAK;
  return TYPE_NEUTRAL;
}

/** The element this species beats. */
export function strongAgainst(species: Species): Species {
  return STRONG_VS[species];
}

/** The element that beats this species (i.e. this species is weak to it). */
export function weakAgainst(species: Species): Species {
  const found = (Object.keys(STRONG_VS) as Species[]).find((s) => STRONG_VS[s] === species);
  return found ?? species; // unreachable in a complete 4-cycle; satisfies the type
}
