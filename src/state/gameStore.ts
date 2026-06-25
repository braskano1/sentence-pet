import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD } from '../data/food';
import type { DrillType, FoodGroup, NutritionBars, PetInstance, PetStage, Screen } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { sanitizePetName } from '../domain/petName';
import { stageForXp, xpPerCorrect } from '../domain/xp';
import { purchase } from '../domain/shop';
import type { TreatItem, DecorItem } from '../domain/shop';
import { buyDecor } from '../domain/decor';
import { makePet, rollStats, rarityForStats } from '../domain/pets';
import { pullEgg as pullEggDomain } from '../domain/gacha';

export const STARTER_ID = 'starter-leaf';

/** App-side RNG. Kept out of pure domain so domain stays deterministically testable. */
function rng(): number {
  return Math.random();
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
  pets: PetInstance[];
  activePetId: string;
  coins: number; // account-level wallet
  inventory: Record<FoodGroup, number>;
  selectedDrill: DrillType;
  selectedLevel: number;
  lastReward: RewardSummary | null;
  // Last gacha pull, for the reveal. The Gacha screen gates the reveal on its own local
  // state, so this is intentionally NOT cleared on navigation; persisting it is harmless
  // (the pet is already in pets[]). Only freshState/resetForTest reset it.
  lastPull: PetInstance | null;
  owned: string[];
  activeBackground: string | null;
  // actions
  setScreen: (s: Screen) => void;
  hatch: () => void;
  startDrill: (drill: DrillType, level: number) => void;
  finishRound: (r: RoundResult) => void;
  feed: (group: FoodGroup) => void;
  buyTreat: (item: TreatItem) => void;
  buyDecor: (item: DecorItem) => void;
  pullEgg: () => void;
  equipBackground: (id: string | null) => void;
  switchPet: (id: string) => void;
  renamePet: (id: string, name: string) => void;
  stage: () => PetStage;
  // test helpers
  addXpForTest: (xp: number) => void;
  addCoinsForTest: (coins: number) => void;
  resetForTest: () => void;
}

/** Active pet. Invariant: activePetId always resolves; fall back to pets[0] defensively. */
export const selectActivePet = (s: { pets: PetInstance[]; activePetId: string }): PetInstance =>
  s.pets.find((p) => p.id === s.activePetId) ?? s.pets[0];

/** Immutably replace the active pet via a transform. */
function updateActive(s: GameState, fn: (p: PetInstance) => PetInstance): PetInstance[] {
  return s.pets.map((p) => (p.id === s.activePetId ? fn(p) : p));
}

function freshPet(): PetInstance {
  return makePet({ id: STARTER_ID, species: 'leaf', stats: rollStats(rng), rarity: 'common', hatched: false });
}

function freshInventory(): Record<FoodGroup, number> {
  return { protein: 0, veggie: 0, vitamin: 0, treat: 0 };
}

function freshState() {
  return {
    screen: 'egg' as Screen,
    pets: [freshPet()],
    activePetId: STARTER_ID,
    coins: 0,
    inventory: freshInventory(),
    selectedDrill: 'pattern' as DrillType,
    selectedLevel: 1,
    lastReward: null,
    lastPull: null as PetInstance | null,
    owned: [] as string[],
    activeBackground: null as string | null,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...freshState(),

      setScreen: (screen) => set({ screen }),

      hatch: () =>
        set((s) => ({ pets: updateActive(s, (p) => ({ ...p, hatched: true })), screen: 'petRoom' })),

      startDrill: (drill, level) => set({ selectedDrill: drill, selectedLevel: level, screen: 'drill' }),

      finishRound: ({ drill, level, stars, correctCount }) =>
        set((s) => {
          const group = DRILL_FOOD[drill];
          const xpGain = correctCount * xpPerCorrect(level);
          const coinsGain = GAME_CONFIG.coins.base + GAME_CONFIG.coins.perStar * stars;
          return {
            pets: updateActive(s, (p) => {
              const happiness =
                decayHappiness(p.happiness) +
                GAME_CONFIG.happiness.onClear +
                (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
              return {
                ...p,
                xp: p.xp + xpGain,
                happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
                bars: decayBars(p.bars),
              };
            }),
            coins: s.coins + coinsGain,
            inventory: { ...s.inventory, [group]: s.inventory[group] + correctCount },
            lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
            screen: 'reward',
          };
        }),

      feed: (group) =>
        set((s) => ({
          pets: updateActive(s, (p) => ({ ...p, bars: feedBar(p.bars, group, s.inventory[group]) })),
          inventory: { ...s.inventory, [group]: 0 },
        })),

      buyTreat: (item) =>
        set((s) => {
          const active = selectActivePet(s);
          const res = purchase({ coins: s.coins, happiness: active.happiness }, item, GAME_CONFIG.happiness.max);
          if (!res.ok) return s; // no-op; UI disables the button, this is defensive
          return { coins: res.coins, pets: updateActive(s, (p) => ({ ...p, happiness: res.happiness })) };
        }),

      buyDecor: (item) =>
        set((s) => {
          const res = buyDecor({ coins: s.coins, owned: s.owned }, item);
          if (!res.ok) return s; // no-op; UI disables Buy when owned/too poor
          return { coins: res.coins, owned: res.owned };
        }),

      pullEgg: () =>
        set((s) => {
          const res = pullEggDomain(
            { coins: s.coins },
            { price: GAME_CONFIG.gacha.eggPrice, id: crypto.randomUUID(), rng, table: GAME_CONFIG.gacha.rarities },
          );
          if (!res.ok) return s; // no-op; UI disables Pull when too poor
          return { pets: [...s.pets, res.pet], coins: res.coins, lastPull: res.pet };
        }),

      equipBackground: (id) => set({ activeBackground: id }),

      switchPet: (id) => set((s) => (s.pets.some((p) => p.id === id) ? { activePetId: id } : s)),

      renamePet: (id, name) =>
        set((s) => {
          const clean = sanitizePetName(name);
          return {
            pets: s.pets.map((p) => (p.id === id ? { ...p, name: clean } : p)),
            // keep the gacha-reveal snapshot in sync so its headline reflects the new name
            lastPull: s.lastPull?.id === id ? { ...s.lastPull, name: clean } : s.lastPull,
          };
        }),

      stage: () => {
        const p = selectActivePet(get());
        return stageForXp(p.xp, p.hatched);
      },

      addXpForTest: (xp) => set((s) => ({ pets: updateActive(s, (p) => ({ ...p, xp: p.xp + xp })) })),
      addCoinsForTest: (coins) => set((s) => ({ coins: s.coins + coins })),
      resetForTest: () => set(freshState()),
    }),
    {
      name: 'sentence-pet',
      version: 7,
      // v1->v2 inventory groups; v2->v3 pet.species; v3->v4 owned[]+activeBackground;
      // v4->v5 single `pet` (+pet.coins) restructured into pets[]+activePetId+wallet.
      // v5->v6 backfills pet.rarity (derived from stats). v6->v7 backfills pet.name (default '').
      migrate: (persisted: unknown) => {
        const st = persisted as
          | {
              pet?: {
                hatched?: boolean;
                species?: PetInstance['species'];
                xp?: number;
                coins?: number;
                happiness?: number;
                bars?: Partial<NutritionBars>;
              };
              pets?: PetInstance[];
              inventory?: Partial<Record<FoodGroup, number>>;
              owned?: string[];
              activeBackground?: string | null;
            }
          | null;
        // Zustand treats a null migrate return as "reset to initial state".
        if (!st) return st as unknown as GameState;

        // Normalize additive fields shared by all versions.
        const base = {
          selectedDrill: 'pattern' as DrillType,
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          owned: st.owned ?? [],
          activeBackground: st.activeBackground ?? null,
        };

        // v<5 (no pets[]): restructure the legacy single pet into pets[] + wallet.
        if (!st.pets && st.pet) {
          const legacy = st.pet;
          const fresh = makePet({
            id: STARTER_ID,
            species: legacy.species ?? 'leaf',
            stats: rollStats(rng),
            rarity: 'common', // overwritten below from the merged stats
            hatched: legacy.hatched ?? false,
          });
          const migrated: PetInstance = {
            ...fresh,
            xp: legacy.xp ?? 0,
            happiness: legacy.happiness ?? GAME_CONFIG.happiness.start,
            bars: { ...fresh.bars, ...(legacy.bars ?? {}) },
            rarity: rarityForStats(fresh.stats, GAME_CONFIG.gacha.rarities),
          };
          const next = { ...base, pets: [migrated], activePetId: STARTER_ID, coins: legacy.coins ?? 0 };
          delete (next as { pet?: unknown }).pet;
          return next as unknown as GameState;
        }

        // v5->v6: backfill rarity on any pet that predates the field.
        // Skip pets already tagged, and defensively skip any (corrupt) pet missing stats.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).rarity || !(p as PetInstance).stats
              ? p
              : { ...p, rarity: rarityForStats((p as PetInstance).stats, GAME_CONFIG.gacha.rarities) },
          );
        }

        // v6->v7: backfill name on any pet that predates the field.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            typeof (p as PetInstance).name === 'string' ? p : { ...p, name: '' },
          );
        }

        // Drop any stale legacy `pet` key (e.g. a hand-edited save with both shapes).
        delete (base as { pet?: unknown }).pet;
        return base as unknown as GameState;
      },
    },
  ),
);
