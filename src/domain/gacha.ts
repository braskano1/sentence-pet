import type { PetInstance, Species } from '../data/types';
import { makePet, rollRarity, rollStatsForRarity, type RarityTier } from './pets';

const SPECIES: readonly Species[] = ['leaf', 'fire', 'air', 'water'];

export type PullEggResult =
  | { ok: true; coins: number; pet: PetInstance }
  | { ok: false; reason: 'insufficient-coins' };

/**
 * Pure. Validates coins, then rolls rarity -> species -> stats and builds a
 * hatched pet. RNG consumed in order: rarity, species, then five stats.
 * id + rng + table are injected by the store so this stays deterministic.
 */
export function pullEgg(
  state: { coins: number },
  args: { price: number; id: string; rng: () => number; table: readonly RarityTier[] },
): PullEggResult {
  if (state.coins < args.price) return { ok: false, reason: 'insufficient-coins' };
  const rarity = rollRarity(args.rng, args.table);
  const species = SPECIES[Math.floor(args.rng() * SPECIES.length)];
  const stats = rollStatsForRarity(rarity, args.rng, args.table);
  const pet = makePet({ id: args.id, species, stats, rarity, hatched: true });
  return { ok: true, coins: state.coins - args.price, pet };
}
