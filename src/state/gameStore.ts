import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD } from '../data/food';
import type { DrillType, FoodGroup, NutritionBars, PetStage, Screen, Species } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { stageForXp, xpForLevel } from '../domain/xp';
import { purchase } from '../domain/shop';
import type { TreatItem } from '../domain/shop';
import { pickSpecies } from '../domain/species';

interface Pet {
  hatched: boolean;
  species: Species;
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
  buyTreat: (item: TreatItem) => void;
  stage: () => PetStage;
  // test helpers
  addXpForTest: (xp: number) => void;
  addCoinsForTest: (coins: number) => void;
  resetForTest: () => void;
}

function freshPet(): Pet {
  return {
    hatched: false,
    species: 'leaf',
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
        set((st) => ({ pet: { ...st.pet, hatched: true, species: pickSpecies() }, screen: 'petRoom' })),

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

      buyTreat: (item) =>
        set((st) => {
          const res = purchase(
            { coins: st.pet.coins, happiness: st.pet.happiness },
            item,
            GAME_CONFIG.happiness.max,
          );
          if (!res.ok) return st; // no-op; UI disables the button, this is defensive
          return { pet: { ...st.pet, coins: res.coins, happiness: res.happiness } };
        }),

      stage: () => stageForXp(get().pet.xp, get().pet.hatched),

      addXpForTest: (xp) => set((st) => ({ pet: { ...st.pet, xp: st.pet.xp + xp } })),
      addCoinsForTest: (coins) => set((st) => ({ pet: { ...st.pet, coins: st.pet.coins + coins } })),
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
      version: 3,
      // v1->v2 backfilled inventory groups; v2->v3 adds pet.species (backfill 'leaf').
      migrate: (persisted: unknown) => {
        const st = persisted as
          | { inventory?: Partial<Record<FoodGroup, number>>; pet?: Partial<Pet> }
          | null;
        if (!st) return st as unknown as GameState;
        return {
          selectedDrill: 'pattern',
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          pet: { ...freshPet(), ...(st.pet ?? {}), species: st.pet?.species ?? 'leaf' },
        } as GameState;
      },
    },
  ),
);
