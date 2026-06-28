import type { PetType } from '../data/types';
import { SPECIES } from './species';

/** Expandable battle-type taxonomy. Seeded from the 4 element names so existing
 *  data + the built-ins map cleanly; extend this list to add new types later.
 *  Kept separate from `element: Species`, which remains the art-family / sprite source. */
export const PET_TYPES: readonly PetType[] = [...SPECIES];

/** True if `t` is a registered pet type. */
export function isPetType(t: string): t is PetType {
  return PET_TYPES.includes(t);
}
