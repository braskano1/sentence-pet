import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, Rarity, StatRange } from '../data/types';

/** Per-rarity offset of the gacha band from the gacha *common* band. */
function rarityOffsets(): Record<Rarity, [number, number]> {
  const rarities = GAME_CONFIG.gacha.rarities;
  const common = rarities.find((r) => r.rarity === 'common')!.band;
  const out = {} as Record<Rarity, [number, number]>;
  for (const tier of rarities) {
    out[tier.rarity] = [tier.band[0] - common[0], tier.band[1] - common[1]];
  }
  return out;
}

/**
 * Build the full 4-rarity × 5-stat band table from a single base range.
 * Each rarity = base + that rarity's offset-from-common (from the gacha table),
 * clamped so min >= 0. All five stats share the rarity band (matches builtins).
 * base = gacha common reproduces bandsFromGacha() exactly, so an
 * omitted base yields builtin-identical stats.
 */
export function deriveStatBands(base: StatRange): Record<Rarity, Record<keyof BattleStats, StatRange>> {
  const offsets = rarityOffsets();
  const out = {} as Record<Rarity, Record<keyof BattleStats, StatRange>>;
  for (const rarity of Object.keys(offsets) as Rarity[]) {
    const [offMin, offMax] = offsets[rarity];
    const min = Math.max(0, base[0] + offMin);
    const max = Math.max(min, base[1] + offMax);
    const band: StatRange = [min, max];
    out[rarity] = { hp: band, atk: band, def: band, spd: band, luk: band };
  }
  return out;
}
