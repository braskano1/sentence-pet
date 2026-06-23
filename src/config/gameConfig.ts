export const GAME_CONFIG = {
  bars: { start: 60, decayPerRound: 5, max: 100, min: 0 },
  food: { restorePerItem: 15 },
  happiness: { start: 60, decayPerRound: 5, onClear: 10, onThreeStars: 5, max: 100, min: 0 },
  round: { size: 5 },
  coins: { base: 10, perStar: 5 },
  xp: {
    perLevelMultiplier: 10, // xp per correct = perLevelMultiplier * level
    evolution: { baby: 0, young: 1000, adult: 3000 },
  },
} as const;
