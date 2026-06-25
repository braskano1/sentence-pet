import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, NutritionBars, PetInstance, Rarity, Species } from '../data/types';

const STAT_MIN = 40;
const STAT_MAX = 90;
const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luk'] as const;

/** One stat in [STAT_MIN, STAT_MAX] inclusive. Starter pet + legacy migration; gacha pulls use rollStatsForRarity. */
function roll(rng: () => number): number {
  return STAT_MIN + Math.floor(rng() * (STAT_MAX - STAT_MIN + 1));
}

export interface RarityTier {
  rarity: Rarity;
  weight: number;
  band: readonly [number, number];
}

/** Inclusive integer in [min,max]. */
function rollInBand(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Weighted pick. rng() in [0,1) scaled by total weight; walks cumulative tiers. */
export function rollRarity(rng: () => number, table: readonly RarityTier[]): Rarity {
  const total = table.reduce((sum, t) => sum + t.weight, 0);
  let cursor = rng() * total;
  for (const t of table) {
    if (cursor < t.weight) return t.rarity;
    cursor -= t.weight;
  }
  return table[table.length - 1].rarity; // float-safety fallback
}

/** Each of the five stats rolls flat within the tier's band. */
export function rollStatsForRarity(rarity: Rarity, rng: () => number, table: readonly RarityTier[]): BattleStats {
  const tier = table.find((t) => t.rarity === rarity) ?? table[0];
  const [min, max] = tier.band;
  return {
    hp: rollInBand(rng, min, max),
    atk: rollInBand(rng, min, max),
    def: rollInBand(rng, min, max),
    spd: rollInBand(rng, min, max),
    luk: rollInBand(rng, min, max),
  };
}

export function rollStats(rng: () => number): BattleStats {
  return { hp: roll(rng), atk: roll(rng), def: roll(rng), spd: roll(rng), luk: roll(rng) };
}

function freshBars(): NutritionBars {
  return {
    protein: GAME_CONFIG.bars.start,
    veggie: GAME_CONFIG.bars.start,
    vitamin: GAME_CONFIG.bars.start,
    treat: GAME_CONFIG.bars.start,
  };
}

/**
 * Migrate-only: tier a pre-v6 pet by the band floor its weakest stat reaches.
 * @param table Must be non-empty and ordered weakest -> strongest by band floor.
 */
export function rarityForStats(stats: BattleStats, table: readonly RarityTier[]): Rarity {
  const minStat = Math.min(stats.hp, stats.atk, stats.def, stats.spd, stats.luk);
  // pick the highest tier whose floor <= minStat (last match wins given the ordering above).
  let result: Rarity = table[0].rarity;
  for (const t of table) {
    if (minStat >= t.band[0]) result = t.rarity;
  }
  return result;
}

export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  rarity: Rarity;
  name?: string;
  hatched?: boolean;
}): PetInstance {
  return {
    id: args.id,
    species: args.species,
    hatched: args.hatched ?? false,
    xp: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: freshBars(),
    stats: args.stats,
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: args.rarity,
    name: args.name ?? '',
  };
}

/** Add `count` points to random stats (uniform over the five), returning a new growth object. */
export function allocateStatPoints(growth: BattleStats, count: number, rng: () => number): BattleStats {
  const next: BattleStats = { ...growth };
  for (let i = 0; i < count; i++) {
    const key = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
    next[key] += 1;
  }
  return next;
}
