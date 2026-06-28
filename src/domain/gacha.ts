import type { PetDef, PetInstance } from '../data/types';
import { makePet, rollRarity, rollStatsFromBands, type RarityTier } from './pets';

export type PullEggResult =
  | { ok: true; coins: number; pet: PetInstance }
  | { ok: false; reason: 'insufficient-coins' };

/**
 * Pure. Validates coins, then rolls rarity -> picks a def from `defs` -> rolls
 * stats from that def's bands and builds a hatched pet.
 * RNG consumed in order: [0] rarity, [1] pool-pick, [2..6] five stats.
 * The caller passes a NON-EMPTY obtainable pool (it falls back to the starter).
 */
export function pullEgg(
  state: { coins: number },
  args: { price: number; id: string; rng: () => number; table: readonly RarityTier[]; defs: readonly PetDef[] },
): PullEggResult {
  if (state.coins < args.price) return { ok: false, reason: 'insufficient-coins' };
  const rarity = rollRarity(args.rng, args.table);
  const def = args.defs[Math.floor(args.rng() * args.defs.length)];
  const stats = rollStatsFromBands(def.statBands[rarity], args.rng);
  const pet = makePet({ id: args.id, defId: def.id, species: def.element, stats, rarity, hatched: true });
  return { ok: true, coins: state.coins - args.price, pet };
}
