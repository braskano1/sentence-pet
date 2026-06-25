import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, NutritionBars, PetInstance, Rarity, Species } from '../data/types';

const STAT_MIN = 40;
const STAT_MAX = 90;

/** One stat in [STAT_MIN, STAT_MAX] inclusive. Rarity/price tiering is gacha phase #2. */
function roll(rng: () => number): number {
  return STAT_MIN + Math.floor(rng() * (STAT_MAX - STAT_MIN + 1));
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

export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  rarity: Rarity;
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
    rarity: args.rarity,
  };
}
