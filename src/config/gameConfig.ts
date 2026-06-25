import type { ShopItem } from '../domain/shop';

export const GAME_CONFIG = {
  bars: { start: 60, decayPerRound: 5, max: 100, min: 0 },
  food: { restorePerItem: 15 },
  happiness: { start: 60, decayPerRound: 5, onClear: 10, onThreeStars: 5, max: 100, min: 0 },
  mood: { happyThreshold: 0.5 }, // happiness >= max * threshold => happy
  round: { size: 5 },
  coins: { base: 10, perStar: 5 },
  xp: {
    perLevelMultiplier: 10, // xp per correct = perLevelMultiplier * level
    evolution: { baby: 0, young: 1000, adult: 3000 },
  },
  shop: {
    treats: [
      { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 },
      { id: 'treat', name: 'Treat', kind: 'treat', price: 30, happiness: 35 },
      { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 },
    ] satisfies ShopItem[],
  },
} as const;
