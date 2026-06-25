import type { ShopItem } from '../domain/shop';
import { DECOR_SPRITES } from './decorSprites';

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
} as const;
