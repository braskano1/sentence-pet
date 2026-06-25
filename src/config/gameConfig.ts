import type { ShopItem } from '../domain/shop';
import type { RarityTier } from '../domain/pets';
import { DECOR_SPRITES } from './decorSprites';

export const GAME_CONFIG = {
  bars: { start: 60, decayPerRound: 5, max: 100, min: 0 },
  food: { restorePerItem: 15 },
  happiness: { start: 60, decayPerRound: 5, onClear: 10, onThreeStars: 5, max: 100, min: 0 },
  mood: { happyThreshold: 0.5 }, // happiness >= max * threshold => happy
  round: { size: 5 },
  coins: { base: 10, perStar: 5 },
  xp: {
    perLevelMultiplier: 10, // xp earned per correct answer = perLevelMultiplier * drill level
    maxLevel: 50,
    curve: { base: 40, growth: 1.5 }, // xpToNext(level) = round(base * level^growth)
  },
  shop: {
    treats: [
      { id: 'snack', name: 'Snack', kind: 'treat', price: 15, happiness: 15 },
      { id: 'treat', name: 'Treat', kind: 'treat', price: 30, happiness: 35 },
      { id: 'feast', name: 'Feast', kind: 'treat', price: 60, happiness: 80 },
    ] satisfies ShopItem[],
    decor: [
      { id: 'decor:beach',       name: 'Beach',       kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:beach'] },
      { id: 'decor:forest-path', name: 'Forest Path', kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:forest-path'] },
      { id: 'decor:night-room',  name: 'Night Room',  kind: 'decor', price: 50,  sprite: DECOR_SPRITES['decor:night-room'] },
      { id: 'decor:forest-room', name: 'Forest Room', kind: 'decor', price: 100, sprite: DECOR_SPRITES['decor:forest-room'] },
      { id: 'decor:sky-room',    name: 'Sky Room',    kind: 'decor', price: 100, sprite: DECOR_SPRITES['decor:sky-room'] },
      { id: 'decor:fire-room',   name: 'Fire Room',   kind: 'decor', price: 150, sprite: DECOR_SPRITES['decor:fire-room'] },
      { id: 'decor:water-room',  name: 'Water Room',  kind: 'decor', price: 150, sprite: DECOR_SPRITES['decor:water-room'] },
    ] satisfies ShopItem[],
  },
  gacha: {
    eggPrice: 60,
    // weights sum to 100; band = inclusive [min,max] each of the 5 stats rolls within.
    rarities: [
      { rarity: 'common',    weight: 65, band: [40, 60] },
      { rarity: 'rare',      weight: 25, band: [55, 75] },
      { rarity: 'epic',      weight: 8,  band: [72, 88] },
      { rarity: 'legendary', weight: 2,  band: [85, 90] },
    ] satisfies RarityTier[],
  },
} as const;
