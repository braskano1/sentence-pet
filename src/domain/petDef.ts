import { GAME_CONFIG } from '../config/gameConfig';
import { SPECIES } from './species';
import type { BattleStats, PetDef, Rarity, Species, StatRange } from '../data/types';

import falconBaby from '../assets/sprites/tempest-falcon/baby.webp';
import falconYoung from '../assets/sprites/tempest-falcon/young.webp';
import falconAdult from '../assets/sprites/tempest-falcon/adult.webp';

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

/** One built-in def per fixed element. Leaf (dexNo 1) is the gen-1 starter. All enabled. */
export const BUILTIN_PET_DEFS: readonly PetDef[] = SPECIES.map((element, i): PetDef => ({
  id: `def-${element}`,
  name: ELEMENT_NAME[element],
  gen: 1,
  dexNo: i + 1,
  types: [element],
  element,
  statBands: bandsFromGacha(),
  ...(i === 0 ? { starter: true } : {}), // SPECIES[0] === 'leaf' — the starter is dexNo 1
  enabled: true,
}));

/**
 * Proof-of-concept import from a friend's combined character sheet
 * (Air / "Tempest Falcon" / Rare). The single sheet was split into 3 stage
 * images, background-removed (transparent) and downscaled to <=512px. The same
 * creature growing baby->young->adult is ONE PetDef with per-stage sprite
 * variants — NOT evolvesToId (that's def->def for *different* creatures).
 * Happy/sad reuse one art (no mood-specific art delivered).
 */
const TEMPEST_FALCON: PetDef = {
  id: 'def-tempest-falcon',
  name: 'Tempest Falcon',
  gen: 2,
  dexNo: 1,
  types: ['air'],
  element: 'air',
  statBands: bandsFromGacha(),
  enabled: true,
  rarity: 'rare', // sheet "Rare"; a "Mythical" sheet would map -> 'legendary'
  sprite: {
    variants: {
      baby: { happy: falconBaby, sad: falconBaby },
      young: { happy: falconYoung, sad: falconYoung },
      adult: { happy: falconAdult, sad: falconAdult },
    },
  },
};

/** Built-ins + imported pets. Spread keeps the per-element starter logic intact. */
export const ALL_PET_DEFS: readonly PetDef[] = [...BUILTIN_PET_DEFS, TEMPEST_FALCON];

/** Module-level active catalog. Hydration swaps this; defaults to the built-ins so the game never blanks. */
let active: readonly PetDef[] = BUILTIN_PET_DEFS;

/** Subscribers notified when the active catalog is swapped (e.g. async hydration).
 *  Lets React views (via useSyncExternalStore) re-render instead of snapshotting once. */
const listeners = new Set<() => void>();

/** Current catalog snapshot. Stable reference between swaps — safe as a useSyncExternalStore getSnapshot. */
export function getActivePetDefs(): readonly PetDef[] {
  return active;
}

export function setActivePetDefs(defs: readonly PetDef[]): void {
  const next = defs.length > 0 ? defs : BUILTIN_PET_DEFS;
  if (next === active) return; // no-op: don't wake subscribers on an identical swap
  active = next;
  listeners.forEach((l) => l());
}

/** Subscribe to active-catalog swaps. Returns an unsubscribe fn. */
export function subscribePetDefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The default def for an element. P1 has exactly one def per element; falls back to the starter. */
export function defaultDefForElement(element: Species, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.element === element) ?? starterDef(defs);
}

/** The starter-flagged def (built-in: leaf); defensively falls back to the first def. */
export function starterDef(defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.starter) ?? defs[0] ?? BUILTIN_PET_DEFS[0];
}

/** The never-empty gacha/reward pool: enabled, obtainable, chain-ROOT defs
 *  (no evolvesFromId — gacha grants stage 1; evos are reached by leveling),
 *  or [starterDef()] as a floor. */
export function obtainablePool(defs: readonly PetDef[] = active): readonly PetDef[] {
  const pool = defs.filter((d) => d.enabled && d.gachaObtainable !== false && !d.evolvesFromId);
  return pool.length ? pool : [starterDef(defs)];
}

/** Resolve a pet's defId to a def. Never null: unknown ids fall back to the starter. */
export function resolvePetDef(defId: string, defs: readonly PetDef[] = active): PetDef {
  return defs.find((d) => d.id === defId) ?? starterDef(defs);
}
