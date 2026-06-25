import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD } from '../data/food';
import type { DrillType, FoodGroup, NutritionBars, PetStage, Screen } from '../data/types';
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
  group: FoodGroup;
}

interface RoundResult {
  drill: DrillType;
  level: number;
  stars: number;
  correctCount: number;
}

interface GameState {
  screen: Screen;
  pet: Pet;
  inventory: Record<FoodGroup, number>;
  selectedDrill: DrillType;
  selectedLevel: number;
  lastReward: RewardSummary | null;
  // actions
  setScreen: (s: Screen) => void;
  hatch: () => void;
  startDrill: (drill: DrillType, level: number) => void;
  finishRound: (r: RoundResult) => void;
  feed: (group: FoodGroup) => void;
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

function freshInventory(): Record<FoodGroup, number> {
  return { protein: 0, veggie: 0, vitamin: 0, treat: 0 };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'egg',
      pet: freshPet(),
      inventory: freshInventory(),
      selectedDrill: 'pattern',
      selectedLevel: 1,
      lastReward: null,

      setScreen: (screen) => set({ screen }),

      hatch: () =>
        set((st) => ({ pet: { ...st.pet, hatched: true }, screen: 'petRoom' })),

      startDrill: (drill, level) => set({ selectedDrill: drill, selectedLevel: level, screen: 'drill' }),

      finishRound: ({ drill, level, stars, correctCount }) =>
        set((st) => {
          const group = DRILL_FOOD[drill];
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
            inventory: { ...st.inventory, [group]: st.inventory[group] + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
            screen: 'reward',
          };
        }),

      feed: (group) =>
        set((st) => ({
          pet: { ...st.pet, bars: feedBar(st.pet.bars, group, st.inventory[group]) },
          inventory: { ...st.inventory, [group]: 0 },
        })),

      stage: () => stageForXp(get().pet.xp, get().pet.hatched),

      addXpForTest: (xp) => set((st) => ({ pet: { ...st.pet, xp: st.pet.xp + xp } })),
      resetForTest: () =>
        set({
          screen: 'egg',
          pet: freshPet(),
          inventory: freshInventory(),
          selectedDrill: 'pattern',
          selectedLevel: 1,
          lastReward: null,
        }),
    }),
    {
      name: 'sentence-pet',
      version: 2,
      // v1 persisted inventory was { protein } only; backfill the new groups.
      // migrate runs once per version gap; at v2 the only change is the inventory shape
      // (v1 stored { protein } only). Backfill any missing food groups without mutating input.
      migrate: (persisted: unknown) => {
        const st = persisted as { inventory?: Partial<Record<FoodGroup, number>> } | null;
        if (!st) return st as unknown as GameState;
        return { selectedDrill: 'pattern', ...st, inventory: { ...freshInventory(), ...(st.inventory ?? {}) } } as GameState;
      },
    },
  ),
);
