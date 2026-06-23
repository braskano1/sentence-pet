import { GAME_CONFIG } from '../config/gameConfig';
import type { NutritionBars } from '../data/types';

const { min, max, decayPerRound } = GAME_CONFIG.bars;

export function clamp(value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function decayBars(bars: NutritionBars): NutritionBars {
  return {
    protein: clamp(bars.protein - decayPerRound),
    veggie: clamp(bars.veggie - decayPerRound),
    vitamin: clamp(bars.vitamin - decayPerRound),
    treat: clamp(bars.treat - decayPerRound),
  };
}

export function feedBar(
  bars: NutritionBars,
  group: keyof NutritionBars,
  count: number,
): NutritionBars {
  const add = GAME_CONFIG.food.restorePerItem * count;
  return { ...bars, [group]: clamp(bars[group] + add) };
}

/** Health is the worst-fed group — forces a balanced diet. */
export function health(bars: NutritionBars): number {
  return Math.min(bars.protein, bars.veggie, bars.vitamin, bars.treat);
}

export function decayHappiness(happiness: number): number {
  return clamp(happiness - GAME_CONFIG.happiness.decayPerRound);
}
