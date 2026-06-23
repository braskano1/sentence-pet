import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import type { NutritionBars, PetStage, Screen } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { stageForXp, xpForLevel } from '../domain/xp';

interface Pet {
  hatched: boolean;
  xp: number;
  coins: number;
  happiness: number;
  bars: NutritionBars;
}

interface RewardSummary {
  level: number;
  stars: number;
  food: number;
  coins: number;
}

interface RoundResult {
  level: number;
  stars: number;
  correctCount: number;
}

interface GameState {
  screen: Screen;
  pet: Pet;
  inventory: { protein: number };
  lastReward: RewardSummary | null;
  // actions
  setScreen: (s: Screen) => void;
  hatch: () => void;
  finishRound: (r: RoundResult) => void;
  feedAll: () => void;
  stage: () => PetStage;
  // test helpers
  addXpForTest: (xp: number) => void;
  resetForTest: () => void;
}

function freshPet(): Pet {
  return {
    hatched: false,
    xp: 0,
    coins: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: {
      protein: GAME_CONFIG.bars.start,
      veggie: GAME_CONFIG.bars.start,
      vitamin: GAME_CONFIG.bars.start,
      treat: GAME_CONFIG.bars.start,
    },
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'egg',
      pet: freshPet(),
      inventory: { protein: 0 },
      lastReward: null,

      setScreen: (screen) => set({ screen }),

      hatch: () =>
        set((st) => ({ pet: { ...st.pet, hatched: true }, screen: 'petRoom' })),

      finishRound: ({ level, stars, correctCount }) =>
        set((st) => {
          const xpGain = correctCount * xpForLevel(level);
          const coinsGain = GAME_CONFIG.coins.base + GAME_CONFIG.coins.perStar * stars;
          const happiness = decayHappiness(st.pet.happiness) + GAME_CONFIG.happiness.onClear +
            (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
          return {
            pet: {
              ...st.pet,
              xp: st.pet.xp + xpGain,
              coins: st.pet.coins + coinsGain,
              happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
              bars: decayBars(st.pet.bars),
            },
            inventory: { protein: st.inventory.protein + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain },
            screen: 'reward',
          };
        }),

      feedAll: () =>
        set((st) => ({
          pet: { ...st.pet, bars: feedBar(st.pet.bars, 'protein', st.inventory.protein) },
          inventory: { protein: 0 },
        })),

      stage: () => stageForXp(get().pet.xp, get().pet.hatched),

      addXpForTest: (xp) => set((st) => ({ pet: { ...st.pet, xp: st.pet.xp + xp } })),
      resetForTest: () =>
        set({ screen: 'egg', pet: freshPet(), inventory: { protein: 0 }, lastReward: null }),
    }),
    { name: 'sentence-pet' },
  ),
);
