# Multi-pet Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-pet store with a multi-pet collection (`pets[]` + `activePetId` + shared coin wallet + per-pet battle stats) and a PetRoom collection switcher, migrating existing saves cleanly.

**Architecture:** A new pure `domain/pets.ts` rolls battle stats and builds `PetInstance` records. `gameStore` holds `pets[]`, `activePetId`, and a root `coins` wallet; all nurture/reward actions operate on the active pet via a `selectActivePet` helper. Persist bumps v4→v5 with a version-branching migrate that restructures the legacy single `pet` into `pets[]` and lifts `pet.coins` to the wallet. PetRoom gains an egg-chip switcher row + an active-pet stat readout.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest. Seeded-RNG pure tests; render-only component tests.

**Spec:** `docs/superpowers/specs/2026-06-25-multi-pet-foundation-design.md`

**Critical conventions (from handoff):**
- Typecheck with **`npx tsc -b`**, NEVER `tsc --noEmit` (root tsconfig `files:[]` makes it a no-op).
- Run tests with `npm test -- --run`.
- React 19: no global `JSX` namespace.
- jsdom can't drive @dnd-kit/framer-motion — component tests are render-only; `motion.*`/`PressButton` render native elements so `getByRole` works.
- Mock `canvas-confetti` in any test transitively importing `effects/celebrate`.
- Anchor `getByRole` name regexes to avoid multi-match (e.g. `/^decor$/i`).
- Branch is `multi-pet-foundation` (already created). Commit per task. Do NOT push/PR until the finishing step.

---

## Task 1: Battle + pet instance types

**Files:**
- Modify: `src/data/types.ts`

- [ ] **Step 1: Add the types**

Append to `src/data/types.ts` (after the existing `Species`/`PetMood` lines):

```ts
export interface BattleStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  luk: number;
}

/** One owned creature. `coins` is NOT here — it is an account-level wallet. */
export interface PetInstance {
  id: string;          // unique; 'starter-leaf' for the seeded/migrated first pet
  species: Species;
  hatched: boolean;    // the egg ceremony gates the first pet
  xp: number;
  happiness: number;
  bars: NutritionBars;
  stats: BattleStats;  // rolled once at creation, immutable thereafter
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean (no errors — additive types, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add BattleStats and PetInstance types"
```

---

## Task 2: `domain/pets.ts` — rollStats + makePet (TDD)

**Files:**
- Create: `src/domain/pets.ts`
- Test: `src/domain/pets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/pets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rollStats, makePet } from './pets';
import { GAME_CONFIG } from '../config/gameConfig';

/** Deterministic rng that yields a fixed sequence (cycles). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('rollStats', () => {
  it('rolls all five stats within [40,90]', () => {
    const stats = rollStats(() => 0.5);
    for (const v of Object.values(stats)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(90);
    }
    expect(Object.keys(stats).sort()).toEqual(['atk', 'def', 'hp', 'luk', 'spd']);
  });

  it('rng=0 floors to 40, rng~1 ceils to 90', () => {
    expect(rollStats(() => 0).hp).toBe(40);
    expect(rollStats(() => 0.999).hp).toBe(90);
  });

  it('is deterministic for a given rng sequence', () => {
    const a = rollStats(seq([0.1, 0.2, 0.3, 0.4, 0.5]));
    const b = rollStats(seq([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(a).toEqual(b);
  });
});

describe('makePet', () => {
  it('creates a fresh unhatched pet with the given id/species/stats', () => {
    const stats = rollStats(() => 0.5);
    const p = makePet({ id: 'x', species: 'fire', stats });
    expect(p).toMatchObject({ id: 'x', species: 'fire', hatched: false, xp: 0, stats });
    expect(p.happiness).toBe(GAME_CONFIG.happiness.start);
    expect(p.bars.protein).toBe(GAME_CONFIG.bars.start);
    expect(p.bars.veggie).toBe(GAME_CONFIG.bars.start);
  });

  it('honors hatched:true', () => {
    const p = makePet({ id: 'y', species: 'leaf', stats: rollStats(() => 0.5), hatched: true });
    expect(p.hatched).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/pets.test.ts`
Expected: FAIL — cannot find module `./pets`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/pets.ts`:

```ts
import { GAME_CONFIG } from '../config/gameConfig';
import type { BattleStats, NutritionBars, PetInstance, Species } from '../data/types';

const STAT_MIN = 40;
const STAT_MAX = 90;

/** One stat in [STAT_MIN, STAT_MAX] inclusive. Rarity/price tiering is gacha phase #2. */
function roll(rng: () => number): number {
  return STAT_MIN + Math.floor(rng() * (STAT_MAX - STAT_MIN + 1));
}

export function rollStats(rng: () => number): BattleStats {
  return { hp: roll(rng), atk: roll(rng), def: roll(rng), spd: roll(rng), luk: roll(rng) };
}

function freshBars(): NutritionBars {
  return {
    protein: GAME_CONFIG.bars.start,
    veggie: GAME_CONFIG.bars.start,
    vitamin: GAME_CONFIG.bars.start,
    treat: GAME_CONFIG.bars.start,
  };
}

export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  hatched?: boolean;
}): PetInstance {
  return {
    id: args.id,
    species: args.species,
    hatched: args.hatched ?? false,
    xp: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: freshBars(),
    stats: args.stats,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/pets.test.ts`
Expected: PASS (8 assertions across 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pets.ts src/domain/pets.test.ts
git commit -m "feat: rollStats + makePet pure pet factory"
```

---

## Task 3: gameStore multi-pet refactor (TDD, atomic green)

This is the core refactor. Changing the store shape breaks every consumer's compile at once, so the store + all consumers + all affected tests are updated together and the task ends with the **full suite green**. Do the steps in order.

**Files:**
- Modify: `src/state/gameStore.ts`
- Modify (tests): `src/state/gameStore.test.ts` (full rewrite)
- Modify (consumers): `src/App.tsx`, `src/components/Shop.tsx`, `src/components/DevPanel.tsx`, `src/components/PetRoom.tsx`
- Modify (consumer tests): `src/components/Shop.test.tsx`, `src/components/DevPanel.test.tsx`, `src/components/TreatCard.test.tsx`

- [ ] **Step 1: Rewrite the store test (failing spec)**

Replace the entire contents of `src/state/gameStore.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, selectActivePet } from './gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { makePet, rollStats } from '../domain/pets';

function reset() {
  useGameStore.getState().resetForTest();
}
const active = () => selectActivePet(useGameStore.getState());

describe('gameStore', () => {
  beforeEach(reset);

  it('starts on the egg screen with one unhatched leaf pet and zero coins', () => {
    const s = useGameStore.getState();
    expect(s.screen).toBe('egg');
    expect(s.pets).toHaveLength(1);
    expect(s.activePetId).toBe('starter-leaf');
    expect(s.coins).toBe(0);
    expect(active().species).toBe('leaf');
    expect(active().hatched).toBe(false);
    expect(active().xp).toBe(0);
  });

  it('the seeded pet has battle stats in [40,90]', () => {
    for (const v of Object.values(active().stats)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it('hatch() marks the active pet hatched, keeps its species, and moves to petRoom', () => {
    useGameStore.getState().hatch();
    expect(active().hatched).toBe(true);
    expect(active().species).toBe('leaf'); // hatch no longer randomizes species
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('startDrill selects the drill, sets the level, and opens the drill screen', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().startDrill('grammar', 2);
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('grammar');
    expect(s.selectedLevel).toBe(2);
    expect(s.screen).toBe('drill');
  });

  it('resetForTest restores selectedLevel to 1', () => {
    useGameStore.getState().startDrill('grammar', 2);
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().selectedLevel).toBe(1);
  });

  it('finishRound (pattern) adds xp to the active pet, protein food, coins to the wallet, decays bars', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(active().xp).toBe(50);
    expect(s.inventory.protein).toBe(5);
    expect(s.coins).toBe(25);
    expect(active().bars.protein).toBe(55);
    expect(s.lastReward).toEqual({ level: 1, stars: 3, food: 5, coins: 25, group: 'protein' });
  });

  it('finishRound (wordChoice) routes food to the veggie group', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.inventory.veggie).toBe(5);
    expect(s.inventory.protein).toBe(0);
    expect(s.lastReward?.group).toBe('veggie');
  });

  it('feed(group) moves that food into the active pet bar and clears only that group', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().feed('veggie');
    const s = useGameStore.getState();
    expect(s.inventory.veggie).toBe(0);
    expect(active().bars.veggie).toBe(100);
    expect(active().bars.protein).toBe(55);
  });

  it('xp at/over young threshold reports young stage for the active pet', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().addXpForTest(1000);
    expect(useGameStore.getState().stage()).toBe('young');
  });

  describe('switchPet', () => {
    it('switches the active pet when the id exists', () => {
      useGameStore.setState((s) => ({
        pets: [...s.pets, makePet({ id: 'p2', species: 'fire', stats: rollStats(() => 0.5), hatched: true })],
      }));
      useGameStore.getState().switchPet('p2');
      expect(useGameStore.getState().activePetId).toBe('p2');
      expect(active().species).toBe('fire');
    });

    it('is a no-op for an unknown id (invariant: active id always valid)', () => {
      useGameStore.getState().switchPet('nope');
      expect(useGameStore.getState().activePetId).toBe('starter-leaf');
    });
  });

  it('pets level independently — xp goes only to the active pet', () => {
    useGameStore.setState((s) => ({
      pets: [...s.pets, makePet({ id: 'p2', species: 'water', stats: rollStats(() => 0.5), hatched: true })],
    }));
    useGameStore.getState().switchPet('p2');
    useGameStore.getState().addXpForTest(100);
    const pets = useGameStore.getState().pets;
    expect(pets.find((p) => p.id === 'p2')!.xp).toBe(100);
    expect(pets.find((p) => p.id === 'starter-leaf')!.xp).toBe(0);
  });

  describe('buyTreat', () => {
    const snack = GAME_CONFIG.shop.treats[0]; // price 15, +15 happiness

    it('spends wallet coins and raises the active pet happiness', () => {
      useGameStore.getState().resetForTest();
      useGameStore.getState().addCoinsForTest(100);
      useGameStore.getState().buyTreat(snack);
      expect(useGameStore.getState().coins).toBe(85);
      expect(active().happiness).toBe(GAME_CONFIG.happiness.start + 15);
    });

    it('is a no-op when unaffordable', () => {
      useGameStore.getState().resetForTest(); // coins 0
      useGameStore.getState().buyTreat(snack);
      expect(useGameStore.getState().coins).toBe(0);
      expect(active().happiness).toBe(GAME_CONFIG.happiness.start);
    });
  });
});

describe('species', () => {
  it('the seeded pet defaults to leaf before hatch', () => {
    useGameStore.getState().resetForTest();
    expect(active().species).toBe('leaf');
  });
});

describe('decor ownership', () => {
  const beach = GAME_CONFIG.shop.decor.find((d) => d.id === 'decor:beach')!;

  it('starts with empty owned and null activeBackground', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().owned).toEqual([]);
    expect(useGameStore.getState().activeBackground).toBeNull();
  });

  it('buyDecor with enough coins spends wallet coins and records ownership', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('buyDecor without enough coins is a no-op', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(10);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().coins).toBe(10);
    expect(useGameStore.getState().owned).toEqual([]);
  });

  it('buyDecor twice does not double-charge or duplicate', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().buyDecor(beach);
    useGameStore.getState().buyDecor(beach);
    expect(useGameStore.getState().coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['decor:beach']);
  });

  it('equipBackground sets and clears the active background', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipBackground('decor:beach');
    expect(useGameStore.getState().activeBackground).toBe('decor:beach');
    useGameStore.getState().equipBackground(null);
    expect(useGameStore.getState().activeBackground).toBeNull();
  });
});

describe('migrate -> v5 (multi-pet)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  type V5 = {
    pets: { id: string; species: string; xp: number; coins?: number; hatched: boolean;
            bars: Record<string, number>; stats: Record<string, number> }[];
    activePetId: string;
    coins: number;
    inventory: Record<string, number>;
    owned: string[];
    activeBackground: string | null;
    pet?: unknown;
  };

  it('restructures a v2 single pet into pets[] + wallet, backfilling inventory', () => {
    const m = getMigrate()(
      { pet: { hatched: true, xp: 7, coins: 5, happiness: 60, bars: { protein: 1 } }, inventory: { protein: 2 } },
      2,
    ) as V5;
    expect(m.pets).toHaveLength(1);
    expect(m.pets[0].id).toBe('starter-leaf');
    expect(m.pets[0].species).toBe('leaf'); // backfilled
    expect(m.pets[0].xp).toBe(7);
    expect(m.activePetId).toBe('starter-leaf');
    expect(m.coins).toBe(5); // lifted to wallet
    expect(m.pet).toBeUndefined();
    expect(m.inventory.protein).toBe(2);
    expect(m.inventory.veggie).toBe(0); // missing group backfilled
    for (const v of Object.values(m.pets[0].stats)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it('restructures a v4 save and preserves species, owned, activeBackground', () => {
    const m = getMigrate()(
      {
        pet: { hatched: true, species: 'fire', xp: 12, coins: 5 },
        inventory: { protein: 2 },
        owned: ['decor:beach'],
        activeBackground: 'decor:beach',
      },
      4,
    ) as V5;
    expect(m.pets[0].species).toBe('fire');
    expect(m.pets[0].xp).toBe(12);
    expect(m.coins).toBe(5);
    expect(m.owned).toEqual(['decor:beach']);
    expect(m.activeBackground).toBe('decor:beach');
    expect(m.pet).toBeUndefined();
  });

  it('passes an already-v5 save through, keeping pets and wallet', () => {
    const v5 = {
      pets: [{ id: 'starter-leaf', species: 'water', xp: 3, hatched: true,
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 } }],
      activePetId: 'starter-leaf',
      coins: 42,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [],
      activeBackground: null,
    };
    const m = getMigrate()(v5, 5) as V5;
    expect(m.pets).toHaveLength(1);
    expect(m.pets[0].species).toBe('water');
    expect(m.coins).toBe(42);
  });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `selectActivePet` export missing / `s.pets` undefined.

- [ ] **Step 3: Rewrite the store**

Replace the entire contents of `src/state/gameStore.ts` with:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_CONFIG } from '../config/gameConfig';
import { DRILL_FOOD } from '../data/food';
import type { DrillType, FoodGroup, NutritionBars, PetInstance, PetStage, Screen } from '../data/types';
import { decayBars, decayHappiness, feedBar } from '../domain/pet';
import { stageForXp, xpForLevel } from '../domain/xp';
import { purchase } from '../domain/shop';
import type { TreatItem, DecorItem } from '../domain/shop';
import { buyDecor } from '../domain/decor';
import { makePet, rollStats } from '../domain/pets';

const STARTER_ID = 'starter-leaf';

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
  equipBackground: (id: string | null) => void;
  switchPet: (id: string) => void;
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
  return makePet({ id: STARTER_ID, species: 'leaf', stats: rollStats(rng), hatched: false });
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
          const xpGain = correctCount * xpForLevel(level);
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

      equipBackground: (id) => set({ activeBackground: id }),

      switchPet: (id) => set((s) => (s.pets.some((p) => p.id === id) ? { activePetId: id } : s)),

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
      version: 5,
      // v1->v2 inventory groups; v2->v3 pet.species; v3->v4 owned[]+activeBackground;
      // v4->v5 single `pet` (+pet.coins) restructured into pets[]+activePetId+wallet.
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
          const migrated = makePet({
            id: STARTER_ID,
            species: legacy.species ?? 'leaf',
            stats: rollStats(rng),
            hatched: legacy.hatched ?? false,
          });
          migrated.xp = legacy.xp ?? 0;
          migrated.happiness = legacy.happiness ?? GAME_CONFIG.happiness.start;
          migrated.bars = { ...migrated.bars, ...(legacy.bars ?? {}) };
          const next = { ...base, pets: [migrated], activePetId: STARTER_ID, coins: legacy.coins ?? 0 };
          delete (next as { pet?: unknown }).pet;
          return next as unknown as GameState;
        }

        return base as unknown as GameState;
      },
    },
  ),
);
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS. (Other test files + `tsc -b` are still red — consumers not yet fixed. That's expected; fix them next.)

- [ ] **Step 5: Fix consumer `App.tsx`**

In `src/App.tsx`, change the import and the `hatched` selector:

```ts
import { useGameStore, selectActivePet } from './state/gameStore';
```

```ts
  const hatched = useGameStore((s) => selectActivePet(s).hatched);
```

(Everything else in `App.tsx` is unchanged.)

- [ ] **Step 6: Fix consumer `Shop.tsx`**

In `src/components/Shop.tsx`, change the coins selector from `s.pet.coins` to the wallet:

```ts
  const coins = useGameStore((s) => s.coins);
```

(The rest — `happiness`, `owned`, `activeBackground`, tabs, cards — is unchanged.)

- [ ] **Step 7: Fix consumer `DevPanel.tsx`**

Replace the top helpers and selectors in `src/components/DevPanel.tsx`:

```ts
import { useState } from 'react';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { GAME_CONFIG } from '../config/gameConfig';
import { pickSpecies } from '../domain/species';

function bumpHappiness(delta: number) {
  useGameStore.setState((s) => ({
    pets: s.pets.map((p) =>
      p.id === s.activePetId
        ? {
            ...p,
            happiness: Math.max(
              GAME_CONFIG.happiness.min,
              Math.min(GAME_CONFIG.happiness.max, p.happiness + delta),
            ),
          }
        : p,
    ),
  }));
}

function rerollSpecies() {
  useGameStore.setState((s) => ({
    pets: s.pets.map((p) => (p.id === s.activePetId ? { ...p, species: pickSpecies() } : p)),
  }));
}
```

Then inside the component, replace the selectors:

```ts
  const [open, setOpen] = useState(false);
  const pet = useGameStore((s) => selectActivePet(s));
  const coins = useGameStore((s) => s.coins);
  const stage = useGameStore((s) => s.stage());
  const addXp = useGameStore((s) => s.addXpForTest);
  const addCoins = useGameStore((s) => s.addCoinsForTest);
  const reset = useGameStore((s) => s.resetForTest);
  const hatch = useGameStore((s) => s.hatch);
```

And the coins readout line (the `xp:` row) becomes:

```tsx
        <div>xp: <b>{pet.xp}</b> · 🪙 <b>{coins}</b></div>
```

(The rest of `DevPanel.tsx` — `pet.species`, `pet.happiness`, `pet.hatched`, buttons — is unchanged; `pet` is now the active `PetInstance`.)

- [ ] **Step 8: Fix consumer `PetRoom.tsx` (minimal rewire only — switcher comes in Task 4)**

In `src/components/PetRoom.tsx`, replace the store selectors and references so the component reads the active pet + wallet. Change the selector block:

```ts
  const activePet = useGameStore((s) => selectActivePet(s));
  const walletCoins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const stage = useGameStore((s) => s.stage());
  const feed = useGameStore((s) => s.feed);
  const setScreen = useGameStore((s) => s.setScreen);
  const activeBackground = useGameStore((s) => s.activeBackground);
  const bgSprite = activeBackground ? DECOR_SPRITES[activeBackground] : null;
  const [feedTrigger, setFeedTrigger] = useState(0);

  const xp = useCountUp(activePet.xp);
  const coins = useCountUp(walletCoins);
```

Update the import line:

```ts
import { useGameStore, selectActivePet } from '../state/gameStore';
```

Then replace every remaining `pet.` with `activePet.` in the file:
- `stats` array: `health(activePet.bars)`, `activePet.happiness`, `activePet.bars[g]`.
- name chip: `PET_NAME[activePet.species]`.
- `<PetSprite stage={stage} species={activePet.species} happiness={activePet.happiness} feedTrigger={feedTrigger} />`.

(The `coins` `useCountUp` value now comes from the wallet; the JSX `🪙 {coins}` line is unchanged.)

- [ ] **Step 9: Fix consumer tests**

In `src/components/Shop.test.tsx`, the buy-a-treat assertion:

```ts
    expect(useGameStore.getState().coins).toBe(85);
```

In `src/components/TreatCard.test.tsx`, both coin assertions:

```ts
    expect(useGameStore.getState().coins).toBe(85);
```
```ts
    expect(useGameStore.getState().coins).toBe(0);
```

In `src/components/DevPanel.test.tsx`, import the helper and fix the xp + reroll assertions:

```ts
import { useGameStore, selectActivePet } from '../state/gameStore';
```
```ts
    const before = selectActivePet(useGameStore.getState()).xp;
    fireEvent.click(screen.getByRole('button', { name: '+50xp' }));
    expect(selectActivePet(useGameStore.getState()).xp).toBe(before + 50);
```
```ts
    fireEvent.click(screen.getByRole('button', { name: 'reroll' }));
    expect(['leaf', 'fire', 'air', 'water']).toContain(selectActivePet(useGameStore.getState()).species);
```

(`PetRoom.test.tsx` needs no changes in this task — it never reads `pet.coins`.)

- [ ] **Step 10: Run the full suite + typecheck to verify green**

Run: `npm test -- --run`
Expected: PASS — all suites green (existing count + the new store/migrate tests).

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts src/App.tsx src/components/Shop.tsx src/components/Shop.test.tsx src/components/DevPanel.tsx src/components/DevPanel.test.tsx src/components/PetRoom.tsx src/components/TreatCard.test.tsx
git commit -m "feat: multi-pet store (pets[]/activePetId/wallet) + v5 migrate"
```

---

## Task 4: PetRoom collection switcher + active-pet stats (TDD)

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these imports at the top of `src/components/PetRoom.test.tsx`:

```ts
import { makePet, rollStats } from '../domain/pets';
```

Add these tests inside the `describe('PetRoom', ...)` block:

```ts
  it('shows a chip per owned pet and switches the active pet on tap', async () => {
    useGameStore.getState().hatch();
    useGameStore.setState((s) => ({
      pets: [...s.pets, makePet({ id: 'p2', species: 'fire', stats: rollStats(() => 0.5), hatched: true })],
    }));
    render(<PetRoom />);
    expect(screen.getByRole('button', { name: /sprout \(active\)/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /switch to ember/i }));
    expect(useGameStore.getState().activePetId).toBe('p2');
  });

  it('shows the active pet battle stats', () => {
    useGameStore.getState().hatch();
    render(<PetRoom />);
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('ATK')).toBeInTheDocument();
    expect(screen.getByText('LUK')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: FAIL — no `Switch to Ember` button / no `HP` text.

- [ ] **Step 3: Implement the switcher row + stats readout**

In `src/components/PetRoom.tsx`, add to the imports:

```ts
import { ELEMENTAL_EGGS } from '../config/sprites';
```

Add these selectors to the component (next to the others):

```ts
  const pets = useGameStore((s) => s.pets);
  const activePetId = useGameStore((s) => s.activePetId);
  const switchPet = useGameStore((s) => s.switchPet);
```

Inside the carved panel, immediately AFTER the name/coins header `<div>` (the one closing at the `🪙 {coins}` span) and BEFORE the stats grid, insert the collection row:

```tsx
        {/* ── collection: tap an egg to switch which pet you are raising ── */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {pets.map((p) => {
            const isActive = p.id === activePetId;
            return (
              <PressButton
                key={p.id}
                onClick={() => switchPet(p.id)}
                aria-label={isActive ? `${PET_NAME[p.species]} (active)` : `Switch to ${PET_NAME[p.species]}`}
                className={`flex shrink-0 flex-col items-center rounded-xl px-2 py-1 ${
                  isActive ? 'bg-amber-900/25 ring-2 ring-amber-700' : 'bg-amber-900/10'
                }`}
              >
                <img src={ELEMENTAL_EGGS[p.species]} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                <span className="text-[10px] font-bold text-amber-950">{PET_NAME[p.species]}</span>
              </PressButton>
            );
          })}
        </div>
```

Immediately AFTER the existing stats grid (the `grid-cols-2` block of `StatChip`s), insert the battle-stats readout:

```tsx
        {/* ── battle stats (flavor now; powers battle in a later phase) ── */}
        <div className="mb-4 flex justify-between gap-1" aria-label="Battle stats">
          {([['HP', 'hp'], ['ATK', 'atk'], ['DEF', 'def'], ['SPD', 'spd'], ['LUK', 'luk']] as const).map(
            ([label, key]) => (
              <span
                key={key}
                className="flex flex-1 flex-col items-center rounded-lg bg-amber-900/10 px-1 py-0.5 text-[11px] font-bold text-amber-950"
              >
                <span className="text-amber-900/70">{label}</span>
                <span className="tabular-nums">{activePet.stats[key]}</span>
              </span>
            ),
          )}
        </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/PetRoom.test.tsx`
Expected: PASS (existing PetRoom tests + the 2 new ones).

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test -- --run`
Expected: PASS.

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/PetRoom.tsx src/components/PetRoom.test.tsx
git commit -m "feat: PetRoom collection switcher + active-pet battle stats"
```

---

## Task 5: Docs + final verification

**Files:**
- Modify: `GAME_DESIGN.md` (repo root) and `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md` (keep both in sync)

- [ ] **Step 1: Update GAME_DESIGN §7**

In the repo-root `GAME_DESIGN.md`, in §7 (shop/economy), under the existing "Decor shop (Phase A, shipped)" note, add a short subsection:

```markdown
**Multi-pet foundation (Phase B-1, shipped).** The single pet became a collection: `pets[]` + `activePetId` + an account-level coin wallet. Each pet carries innate battle stats (HP/ATK/DEF/SPD/LUK, rolled 40–90 at creation). The PetRoom has an egg-chip switcher to choose which pet you raise. Coins are now a shared wallet (no longer per-pet). Roadmap: **B-2 gacha** (egg pull → random species + rarity-tiered stats, replaces buy-a-species) → **B-3 battle** (team of 3; multiplayer rides the Firebase phase).
```

Copy the same edit into the H:-drive `GAME_DESIGN.md`.

- [ ] **Step 2: Final verification**

Run: `npm test -- --run`
Expected: PASS (all suites).

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add GAME_DESIGN.md
git commit -m "docs: note multi-pet foundation shipped in GAME_DESIGN §7"
```

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR → merge-commit (`gh pr merge N --merge --delete-branch`), preserving TDD history. Then `git fetch --prune`.

---

## Self-review notes

- **Spec coverage:** types (T1), rollStats/makePet (T2), pets[]/activePetId/wallet + all action rewires + switchPet + fresh + v5 migrate + consumer rewire (T3), collection switcher + stats readout (T4), docs (T5). All spec sections mapped.
- **`activePetId` invariant:** `switchPet` guards unknown ids (T3 test); fresh/migrate/reset always seed one pet; `selectActivePet` falls back to `pets[0]`.
- **`pickSpecies`:** removed from `hatch` (T3) but RETAINED in `DevPanel` reroll — so `src/domain/species.ts` stays used (no dangling module; the spec's "left for #2" note is moot — it stays live via DevPanel).
- **Deferred (not in this plan):** gacha pull/rarity (#2), battle engine (#3), Shop scroll-chain fix + a11y tab roles (→ #2), Shop "Pets tab"/PetCard/ShopItemCard (dropped — gacha supersedes).
- **Type consistency:** `selectActivePet`, `makePet({id,species,stats,hatched?})`, `rollStats(rng)`, `switchPet(id)`, `STARTER_ID='starter-leaf'` used identically across all tasks.
```
