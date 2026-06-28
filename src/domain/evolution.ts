import type { BattleStats, PetDef, PetInstance, PetStage } from '../data/types';
import { resolvePetDef } from './petDef';

/**
 * Per-hop multiplier range [minPct, maxPct] applied to each effective stat
 * (stats + growth) when a pet advances one def-chain hop. Keyed by the art
 * stage just ENTERED: only baby->young and young->adult evolve; egg->baby (hatch)
 * and any non-evolving stage have no entry and are no-ops.
 */
export const HOP_RANGE: Partial<Record<PetStage, [number, number]>> = {
  young: [0.03, 0.10], // hop 1 (baby -> young, ~L16)
  adult: [0.05, 0.10], // hop 2 (young -> adult, ~L36)
};

const STAT_KEYS: (keyof BattleStats)[] = ['hp', 'atk', 'def', 'spd', 'luk'];

/**
 * Advance a pet one def-chain hop when its active def has `evolvesToId` AND the
 * entered stage evolves. Re-bases each stat by multiplying the effective total
 * (stats + growth) by a random per-stat factor in the hop's range, folding the
 * result back into `stats` so earned `growth` is preserved and the pet never
 * downgrades (factor >= 1). Also sets `species = nextDef.element` so the sprite
 * element-guard renders the evolved art. Returns the pet UNCHANGED on a no-op.
 * Pure: pass `defs` + `rng` in; no registry reach-in.
 */
export function evolvePetDef(
  pet: PetInstance,
  defs: readonly PetDef[],
  toStage: PetStage,
  rng: () => number,
): PetInstance {
  const range = HOP_RANGE[toStage];
  if (!range) return pet;
  const def = resolvePetDef(pet.defId, defs);
  if (!def.evolvesToId) return pet;
  const next = resolvePetDef(def.evolvesToId, defs);
  const [lo, hi] = range;
  const stats = { ...pet.stats };
  for (const k of STAT_KEYS) {
    const factor = 1 + lo + rng() * (hi - lo);
    const total = pet.stats[k] + pet.growth[k];
    stats[k] = Math.round(total * factor) - pet.growth[k];
  }
  return { ...pet, defId: next.id, species: next.element, stats };
}
