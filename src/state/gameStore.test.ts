import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, selectActivePet, STARTER_ID } from './gameStore';
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
    expect(s.activePetId).toBe(STARTER_ID);
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
        pets: [...s.pets, makePet({ id: 'p2', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
      }));
      useGameStore.getState().switchPet('p2');
      expect(useGameStore.getState().activePetId).toBe('p2');
      expect(active().species).toBe('fire');
    });

    it('is a no-op for an unknown id (invariant: active id always valid)', () => {
      useGameStore.getState().switchPet('nope');
      expect(useGameStore.getState().activePetId).toBe(STARTER_ID);
    });
  });

  it('pets level independently — xp goes only to the active pet', () => {
    useGameStore.setState((s) => ({
      pets: [...s.pets, makePet({ id: 'p2', species: 'water', stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
    }));
    useGameStore.getState().switchPet('p2');
    useGameStore.getState().addXpForTest(100);
    const pets = useGameStore.getState().pets;
    expect(pets.find((p) => p.id === 'p2')!.xp).toBe(100);
    expect(pets.find((p) => p.id === STARTER_ID)!.xp).toBe(0);
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

describe('pullEgg action', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('no-ops when coins < eggPrice', () => {
    const before = useGameStore.getState();
    before.pullEgg();
    const after = useGameStore.getState();
    expect(after.pets).toHaveLength(before.pets.length);
    expect(after.coins).toBe(before.coins);
  });

  it('appends a new pet, deducts 60 coins, leaves activePetId unchanged, sets lastPull', () => {
    useGameStore.getState().addCoinsForTest(100);
    const activeBefore = useGameStore.getState().activePetId;
    useGameStore.getState().pullEgg();
    const s = useGameStore.getState();
    expect(s.pets).toHaveLength(2);
    expect(s.coins).toBe(40);
    expect(s.activePetId).toBe(activeBefore); // joins collection only
    expect(s.lastPull).not.toBeNull();
    expect(s.lastPull?.id).toBe(s.pets[1].id);
    expect(s.lastPull?.hatched).toBe(true);
  });

  it('gives each pulled pet a unique id', () => {
    useGameStore.getState().addCoinsForTest(200);
    useGameStore.getState().pullEgg();
    useGameStore.getState().pullEgg();
    const ids = useGameStore.getState().pets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resetForTest clears lastPull', () => {
    useGameStore.getState().addCoinsForTest(100);
    useGameStore.getState().pullEgg();
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().lastPull).toBeNull();
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
    expect(m.pets[0].id).toBe(STARTER_ID);
    expect(m.pets[0].species).toBe('leaf'); // backfilled
    expect(m.pets[0].xp).toBe(7);
    expect(m.activePetId).toBe(STARTER_ID);
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
      pets: [{ id: STARTER_ID, species: 'water', xp: 3, hatched: true,
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 } }],
      activePetId: STARTER_ID,
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
