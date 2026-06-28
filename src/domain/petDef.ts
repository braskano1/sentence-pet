import { GAME_CONFIG } from '../config/gameConfig';
import { SPECIES } from './species';
import type { BattleStats, PetDef, Rarity, Species, StatRange } from '../data/types';

/** Build per-rarity × per-stat bands from the gacha rarity table (single source of truth). */
function bandsFromGacha(): Record<Rarity, Record<keyof BattleStats, StatRange>> {
  const out = {} as Record<Rarity, Record<keyof BattleStats, StatRange>>;
  for (const tier of GAME_CONFIG.gacha.rarities) {
    out[tier.rarity] = {
      hp: [tier.band[0], tier.band[1]],
      atk: [tier.band[0], tier.band[1]],
      def: [tier.band[0], tier.band[1]],
      spd: [tier.band[0], tier.band[1]],
      luk: [tier.band[0], tier.band[1]],
    };
  }
  return out;
}

const ELEMENT_NAME: Record<Species, string> = { leaf: 'Leaflet', fire: 'Embers', air: 'Zephyr', water: 'Dewdrop' };

/** One built-in def per fixed element. Leaf is the starter. All enabled. */
export const BUILTIN_PET_DEFS: readonly PetDef[] = SPECIES.map((element): PetDef => ({
  id: `def-${element}`,
  name: ELEMENT_NAME[element],
  element,
  statBands: bandsFromGacha(),
  ...(element === 'leaf' ? { starter: true } : {}),
  enabled: true,
}));

/** Module-level active catalog. Hydration swaps this; defaults to the built-ins so the game never blanks. */
let active: readonly PetDef[] = BUILTIN_PET_DEFS;

export function getActivePetDefs(): readonly PetDef[] {
  return active;
}

export function setActivePetDefs(defs: readonly PetDef[]): void {
  active = defs.length > 0 ? defs : BUILTIN_PET_DEFS;
}

/** The default def for an element. P1 has exactly one def per element; falls back to the starter. */
export function defaultDefForElement(element: Species, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.element === element) ?? starterDef(defs);
}

/** The starter-flagged def (built-in: leaf); defensively falls back to the first def. */
export function starterDef(defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.starter) ?? defs[0] ?? BUILTIN_PET_DEFS[0];
}

/** Resolve a pet's defId to a def. Never null: unknown ids fall back to the starter. */
export function resolvePetDef(defId: string, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.id === defId) ?? starterDef(defs);
}
