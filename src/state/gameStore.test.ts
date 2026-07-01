import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore, selectActivePet, selectCaughtSet, postCinematicScreen, STARTER_ID, PERSIST_VERSION, type GameState } from './gameStore';
import type { PetDef } from '../data/types';
import { defaultAudioSettings } from '../audio/mixer';
import { GAME_CONFIG } from '../config/gameConfig';
import { makePet, rollStats } from '../domain/pets';
import { levelForXp, totalXpForLevel, xpPerCorrect } from '../domain/xp';
import { SEED, SEED_COURSE } from '../content/seed';
import { useContentStore } from '../content/store';
import { defaultDefForElement, obtainablePool, starterDef, setActivePetDefs, BUILTIN_PET_DEFS } from '../domain/petDef';
import type { ContentBundle } from '../content/model';

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

  it('hatch() marks the active pet hatched, keeps its species, and moves to evolution', () => {
    useGameStore.getState().hatch();
    expect(active().hatched).toBe(true);
    expect(active().species).toBe('leaf'); // hatch no longer randomizes species
    expect(useGameStore.getState().screen).toBe('evolution');
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

  it('finishRound with kind:flashcard awards KIND_FOOD protein (overriding drill:mixed)', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'mixed', kind: 'flashcard', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.inventory.protein).toBe(5);
    expect(s.inventory.treat).toBe(0); // would be treat if drill:mixed still drove food
    expect(s.lastReward?.group).toBe('protein');
  });

  it('finishRound with kind:fillblank awards KIND_FOOD treat', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'mixed', kind: 'fillblank', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.inventory.treat).toBe(5);
    expect(s.lastReward?.group).toBe('treat');
  });

  it('finishRound WITHOUT kind (dragdrop path) still uses DRILL_FOOD[pattern] = protein', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.inventory.protein).toBe(5);
    expect(s.lastReward?.group).toBe('protein');
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
    useGameStore.getState().addXpForTest(15123); // totalXpForLevel(16)
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

describe('music ownership', () => {
  const lofi = GAME_CONFIG.shop.music.find((t) => t.id === 'music:lofi')!;

  it('starts with null activeTrack (free default)', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().activeTrack).toBeNull();
  });

  it('buyMusic with enough coins spends wallet coins and records ownership', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(200);
    useGameStore.getState().buyMusic(lofi);
    expect(useGameStore.getState().coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['music:lofi']);
  });

  it('buyMusic without enough coins is a no-op', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(10);
    useGameStore.getState().buyMusic(lofi);
    expect(useGameStore.getState().coins).toBe(10);
    expect(useGameStore.getState().owned).toEqual([]);
  });

  it('buyMusic twice does not double-charge or duplicate', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addCoinsForTest(200);
    useGameStore.getState().buyMusic(lofi);
    useGameStore.getState().buyMusic(lofi);
    expect(useGameStore.getState().coins).toBe(50);
    expect(useGameStore.getState().owned).toEqual(['music:lofi']);
  });

  it('equipTrack sets and clears the active track', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().equipTrack('music:lofi');
    expect(useGameStore.getState().activeTrack).toBe('music:lofi');
    useGameStore.getState().equipTrack(null);
    expect(useGameStore.getState().activeTrack).toBeNull();
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

describe('migrate -> v7 (name)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('backfills name="" on a v6 save (pets without a name)', () => {
    const v6 = {
      pets: [{ id: STARTER_ID, species: 'leaf', xp: 0, hatched: true, rarity: 'common',
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 } }],
      activePetId: STARTER_ID, coins: 0,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v6, 6) as { pets: { name: string }[] };
    expect(m.pets[0].name).toBe('');
  });

  it('a v7 save keeps a custom name', () => {
    const v7 = {
      pets: [{ id: STARTER_ID, species: 'fire', xp: 0, hatched: true, rarity: 'epic', name: 'Blaze',
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 80, atk: 80, def: 80, spd: 80, luk: 80 } }],
      activePetId: STARTER_ID, coins: 0,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v7, 7) as { pets: { name: string }[] };
    expect(m.pets[0].name).toBe('Blaze');
  });
});

describe('renamePet action', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('sets a sanitized name on the matching pet', () => {
    const id = useGameStore.getState().pets[0].id;
    useGameStore.getState().renamePet(id, '  Rocky  ');
    expect(useGameStore.getState().pets[0].name).toBe('Rocky');
  });

  it('reverts to empty on a blank name', () => {
    const id = useGameStore.getState().pets[0].id;
    useGameStore.getState().renamePet(id, 'Rocky');
    useGameStore.getState().renamePet(id, '   ');
    expect(useGameStore.getState().pets[0].name).toBe('');
  });

  it('no-ops on an unknown id', () => {
    const before = useGameStore.getState().pets.map((p) => p.name);
    useGameStore.getState().renamePet('nope', 'X');
    expect(useGameStore.getState().pets.map((p) => p.name)).toEqual(before);
  });

  it('renames a non-active pet by id (leaves the active pet untouched)', () => {
    useGameStore.setState((s) => ({
      pets: [...s.pets, makePet({ id: 'p2', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common', hatched: true })],
    }));
    // active is still the starter (pets[0]); rename the second pet
    useGameStore.getState().renamePet('p2', 'Blaze');
    const pets = useGameStore.getState().pets;
    expect(pets.find((p) => p.id === 'p2')!.name).toBe('Blaze');
    expect(pets[0].name).toBe(''); // active starter unchanged
    expect(useGameStore.getState().activePetId).toBe(STARTER_ID);
  });
});

describe('applyXp / level-up', () => {
  it('addXpForTest levels the pet and allocates one growth point per level', () => {
    const { resetForTest, addXpForTest } = useGameStore.getState();
    resetForTest();
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
    const need = totalXpForLevel(3); // jump straight to level 3 -> +2 points
    addXpForTest(need);
    const p = useGameStore.getState().pets[0];
    expect(levelForXp(p.xp)).toBe(3);
    const totalGrowth = p.growth.hp + p.growth.atk + p.growth.def + p.growth.spd + p.growth.luk;
    expect(totalGrowth).toBe(2);
    expect(useGameStore.getState().lastLevelUp?.toLevel).toBe(3);
  });

  it('clearLevelUp nulls lastLevelUp after a level-up', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addXpForTest(totalXpForLevel(3));
    expect(useGameStore.getState().lastLevelUp?.toLevel).toBe(3);
    useGameStore.getState().clearLevelUp();
    expect(useGameStore.getState().lastLevelUp).toBeNull();
  });

  it('persisted slice excludes lastLevelUp', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().addXpForTest(totalXpForLevel(3));
    expect(useGameStore.getState().lastLevelUp).not.toBeNull();
    const getPartialize = (useGameStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions().partialize;
    expect(getPartialize).toBeDefined();
    const persisted = getPartialize!(useGameStore.getState()) as Record<string, unknown>;
    expect('lastLevelUp' in persisted).toBe(false);
  });
});

describe('migrate -> v8 (growth)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('migrate backfills zeroed growth on pets without it (v7->v8)', () => {
    const v7 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    };
    const out = getMigrate()(v7, 7) as { pets: { growth: unknown }[] };
    expect(out.pets[0].growth).toEqual({ hp: 0, atk: 0, def: 0, spd: 0, luk: 0 });
  });
});

describe('migrate -> v6 (rarity)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('backfills rarity from stats on a v5 save (derive from min stat)', () => {
    const v5 = {
      pets: [{ id: STARTER_ID, species: 'water', xp: 3, hatched: true,
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 80, atk: 80, def: 80, spd: 80, luk: 80 } }],
      activePetId: STARTER_ID, coins: 42,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v5, 5) as { pets: { rarity: string }[] };
    expect(m.pets[0].rarity).toBe('epic'); // min stat 80 -> epic floor 72
  });

  it('a v4 single-pet save gets a derived rarity too', () => {
    const m = getMigrate()(
      { pet: { hatched: true, species: 'fire', xp: 12, coins: 5 }, inventory: { protein: 2 } },
      4,
    ) as { pets: { rarity: string }[] };
    expect(['common', 'rare', 'epic', 'legendary']).toContain(m.pets[0].rarity);
  });

  it('a v6 save passes rarity through unchanged', () => {
    const v6 = {
      pets: [{ id: STARTER_ID, species: 'leaf', xp: 0, hatched: true, rarity: 'legendary',
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 } }],
      activePetId: STARTER_ID, coins: 0,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v6, 6) as { pets: { rarity: string }[] };
    expect(m.pets[0].rarity).toBe('legendary');
  });
});

describe('startLesson + journey star recording', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('startLesson resolves a lesson to its drill/level and sets currentLessonId', () => {
    useGameStore.getState().startLesson('u1-pattern');
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('pattern');
    expect(s.selectedLevel).toBe(1);
    expect(s.currentLessonId).toBe('u1-pattern');
    expect(s.screen).toBe('drill');
  });

  it('finishRound records best stars for the current lesson and clears it', () => {
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 2, correctCount: 5 });
    expect(useGameStore.getState().journey.lessonStars['u1-pattern']).toBe(2);
    expect(useGameStore.getState().currentLessonId).toBeNull();
  });

  it('replaying a lesson keeps the best stars (never lowers)', () => {
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 1, correctCount: 5 });
    expect(useGameStore.getState().journey.lessonStars['u1-pattern']).toBe(3);
  });

  it('startLesson on an unknown id is a no-op (stays on current screen)', () => {
    const before = useGameStore.getState().screen;
    useGameStore.getState().startLesson('does-not-exist');
    expect(useGameStore.getState().screen).toBe(before);
    expect(useGameStore.getState().currentLessonId).toBeNull();
  });
});

describe('boss (checkpoint) stinger queueing', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('finishRound after a checkpoint lesson with stars>=1 queues a win stinger', () => {
    useGameStore.getState().startLesson('u1-checkpoint');
    useGameStore.getState().finishRound({ drill: 'mixed', level: 1, stars: 1, correctCount: 3 });
    expect(useGameStore.getState().pendingStinger).toBe('win');
  });

  it('finishRound after a checkpoint lesson with 0 stars queues a lose stinger', () => {
    useGameStore.getState().startLesson('u1-checkpoint');
    useGameStore.getState().finishRound({ drill: 'mixed', level: 1, stars: 0, correctCount: 0 });
    expect(useGameStore.getState().pendingStinger).toBe('lose');
  });

  it("finishRound after a non-checkpoint lesson queues the 'cleared' stinger", () => {
    useGameStore.getState().startLesson('u1-pattern');
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 0, correctCount: 0 });
    expect(useGameStore.getState().pendingStinger).toBe('cleared');
  });

  it('finishRound with no active lesson leaves pendingStinger null', () => {
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    expect(useGameStore.getState().pendingStinger).toBeNull();
  });

  it('clearPendingStinger resets it to null', () => {
    useGameStore.getState().startLesson('u1-checkpoint');
    useGameStore.getState().finishRound({ drill: 'mixed', level: 1, stars: 3, correctCount: 5 });
    expect(useGameStore.getState().pendingStinger).toBe('win');
    useGameStore.getState().clearPendingStinger();
    expect(useGameStore.getState().pendingStinger).toBeNull();
  });

  it('persisted slice excludes pendingStinger', () => {
    useGameStore.getState().startLesson('u1-checkpoint');
    useGameStore.getState().finishRound({ drill: 'mixed', level: 1, stars: 3, correctCount: 5 });
    const getPartialize = (useGameStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions().partialize;
    const persisted = getPartialize!(useGameStore.getState()) as Record<string, unknown>;
    expect('pendingStinger' in persisted).toBe(false);
  });
});

describe('persist v9 (journey)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('migrate backfills an empty journey on a v8 save', () => {
    const v8 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    };
    const out = getMigrate()(v8, 8) as { journey: { lessonStars: Record<string, number> } };
    expect(out.journey).toEqual({ lessonStars: {} });
  });

  it('persisted slice excludes currentLessonId', () => {
    const getPartialize = (useGameStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions().partialize;
    const persisted = getPartialize!(useGameStore.getState()) as Record<string, unknown>;
    expect('currentLessonId' in persisted).toBe(false);
  });

  it('SEED is referenced so seed ids are stable', () => {
    expect(SEED.units[0].lessons[0].id).toBe('u1-pattern');
  });
});

describe('migrate -> v11 (audio mixer)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('migrate backfills default audio mixer on a v9 save that lacks soundEnabled', () => {
    const v9 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      journey: { lessonStars: {} },
    };
    const out = getMigrate()(v9, 9) as { audio: { master: { muted: boolean; level: number } } };
    expect(out.audio.master.muted).toBe(false);
    expect(out.audio.master.level).toBe(0.7);
  });

  it('migrate converts soundEnabled:false (v10) to master.muted:true', () => {
    const v10 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 0, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      journey: { lessonStars: {} },
      soundEnabled: false,
    };
    const out = getMigrate()(v10, 10) as { audio: { master: { muted: boolean } }; soundEnabled?: boolean };
    expect(out.audio.master.muted).toBe(true);
    expect(out.soundEnabled).toBeUndefined();
  });

  it('migrate converts soundEnabled:true (v10) to master.muted:false', () => {
    const v10 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 0, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      journey: { lessonStars: {} },
      soundEnabled: true,
    };
    const out = getMigrate()(v10, 10) as { audio: { master: { muted: boolean } }; soundEnabled?: boolean };
    expect(out.audio.master.muted).toBe(false);
    expect(out.soundEnabled).toBeUndefined();
  });
});

describe('migrate -> v13 (drop allMuted, fold into master.muted)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  const v12Save = (audio: Record<string, unknown>) => ({
    pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 0, happiness: 60,
      bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
      stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
      growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
    activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    journey: { lessonStars: {} }, audio,
  });

  it('a v12 save with allMuted:true folds into master.muted and drops the field', () => {
    const full = (): { level: number; muted: boolean } => ({ level: 1, muted: false });
    const out = getMigrate()(
      v12Save({ master: full(), sfx: full(), music: full(), voice: full(), allMuted: true }),
      12,
    ) as { audio: { master: { muted: boolean }; allMuted?: boolean } };
    expect(out.audio.master.muted).toBe(true);
    expect('allMuted' in out.audio).toBe(false);
  });

  it('a v12 save with allMuted:false leaves master.muted untouched and drops the field', () => {
    const full = (): { level: number; muted: boolean } => ({ level: 1, muted: false });
    const out = getMigrate()(
      v12Save({ master: full(), sfx: full(), music: full(), voice: full(), allMuted: false }),
      12,
    ) as { audio: { master: { muted: boolean }; allMuted?: boolean } };
    expect(out.audio.master.muted).toBe(false);
    expect('allMuted' in out.audio).toBe(false);
  });

  it('preserves an already-set master.muted (allMuted:false does not clear it)', () => {
    const full = (): { level: number; muted: boolean } => ({ level: 1, muted: false });
    const out = getMigrate()(
      v12Save({ master: { level: 1, muted: true }, sfx: full(), music: full(), voice: full(), allMuted: false }),
      12,
    ) as { audio: { master: { muted: boolean }; allMuted?: boolean } };
    expect(out.audio.master.muted).toBe(true);
    expect('allMuted' in out.audio).toBe(false);
  });
});

describe('migrate -> v12 (activeTrack)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('backfills activeTrack: null on a v11 save that lacks it, keeping other fields', () => {
    const v11 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 42, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: ['decor:beach'], activeBackground: 'decor:beach',
      journey: { lessonStars: { u1: 2 } }, audio: defaultAudioSettings(),
    };
    const out = getMigrate()(v11, 11) as {
      activeTrack: string | null; coins: number; owned: string[]; activeBackground: string | null;
    };
    expect(out.activeTrack).toBeNull();
    // other fields survive untouched
    expect(out.coins).toBe(42);
    expect(out.owned).toEqual(['decor:beach']);
    expect(out.activeBackground).toBe('decor:beach');
  });

  it('preserves an already-set activeTrack', () => {
    const v12 = {
      pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 0, happiness: 60,
        bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
        stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '' }],
      activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: ['music:lofi'], activeTrack: 'music:lofi',
      journey: { lessonStars: {} }, audio: defaultAudioSettings(),
    };
    const out = getMigrate()(v12, 12) as { activeTrack: string | null };
    expect(out.activeTrack).toBe('music:lofi');
  });
});

describe('audio mixer actions', () => {
  beforeEach(() => {
    useGameStore.setState({ audio: defaultAudioSettings() });
  });

  it('setChannelLevel clamps into 0..1', () => {
    useGameStore.getState().setChannelLevel('sfx', 1.5);
    expect(useGameStore.getState().audio.sfx.level).toBe(1);
    useGameStore.getState().setChannelLevel('music', -0.2);
    expect(useGameStore.getState().audio.music.level).toBe(0);
    useGameStore.getState().setChannelLevel('master', 0.3);
    expect(useGameStore.getState().audio.master.level).toBeCloseTo(0.3);
  });

  it('toggleChannelMute flips a single channel', () => {
    useGameStore.getState().toggleChannelMute('voice');
    expect(useGameStore.getState().audio.voice.muted).toBe(true);
    useGameStore.getState().toggleChannelMute('voice');
    expect(useGameStore.getState().audio.voice.muted).toBe(false);
  });
});

describe('stage-change detection', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  function hatchStarter() {
    useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true, xp: 0 })) }));
  }

  it('sets lastStageChange when XP crosses into the young stage (L16)', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(16));
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'young' });
  });

  it('reports the spanned stages for a multi-stage jump', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(36));
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'adult' });
  });

  it('leaves lastStageChange null when the level gain stays in the same stage', () => {
    hatchStarter();
    useGameStore.getState().addXpForTest(totalXpForLevel(5));
    expect(useGameStore.getState().lastStageChange).toBeNull();
  });

  it('hatch() sets an egg→baby stage change and routes to the evolution screen', () => {
    useGameStore.getState().hatch();
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'egg', to: 'baby' });
    expect(useGameStore.getState().screen).toBe('evolution');
  });

  it('clearStageChange resets it to null', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().clearStageChange();
    expect(useGameStore.getState().lastStageChange).toBeNull();
  });

  it('finishRound sets lastStageChange when the XP it grants crosses a stage', () => {
    // Put a hatched baby pet just below L16, so one round's XP tips it into young.
    const gain = xpPerCorrect(1); // finishRound below grants correctCount(1) * xpPerCorrect(level=1)
    useGameStore.setState((s) => ({
      pets: s.pets.map((p) => ({ ...p, hatched: true, xp: totalXpForLevel(16) - gain })),
    }));
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'young' });
  });
});

describe('boss flow', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('startBoss records the lesson id and routes to bossPrep', () => {
    useGameStore.getState().startBoss('u1-checkpoint');
    expect(useGameStore.getState().currentBossLessonId).toBe('u1-checkpoint');
    expect(useGameStore.getState().screen).toBe('bossPrep');
  });

  it('finishBoss win marks the checkpoint cleared and grants the first-clear egg', () => {
    const before = useGameStore.getState().pets.length;
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    expect(s.journey.lessonStars['u1-checkpoint']).toBeGreaterThanOrEqual(1);
    expect(s.pets.length).toBe(before + 1);
    expect(s.pendingStinger).toBe('win');
    expect(s.screen).toBe('reward');
    expect(s.currentBossLessonId).toBeNull();
  });

  it('a replay win grants no extra egg, only the coin trickle', () => {
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const afterFirst = useGameStore.getState().pets.length;
    const coinsAfterFirst = useGameStore.getState().coins;
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    expect(s.pets.length).toBe(afterFirst);
    expect(s.coins).toBe(coinsAfterFirst + 8);
  });

  it('finishBoss win populates lastReward so the reward screen renders', () => {
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const r = useGameStore.getState().lastReward;
    expect(r).not.toBeNull();
    expect(r!.stars).toBeGreaterThanOrEqual(1);
    expect(r!.coins).toBeGreaterThan(0);
  });
});


describe('finishBoss course completion', () => {
  beforeEach(() => {
    useGameStore.getState().resetForTest();
    useContentStore.getState().setCourse(SEED_COURSE, 'fallback');
  });

  it('marks the active course complete when clearing a final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBe(true);
  });

  it('does not complete the course when clearing a non-final boss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'gate-midcourse' });
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });

  it('does not complete on a loss', () => {
    useGameStore.setState({ currentCourseId: 'default', currentBossLessonId: 'final-course' });
    useGameStore.getState().finishBoss(false);
    expect(useGameStore.getState().courseComplete['default']).toBeUndefined();
  });
});

describe('persist migrate v15->16 (defId backfill)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  it('backfills defId on a legacy pet from its species', () => {
    const legacyPet = {
      id: 'p1', species: 'fire', hatched: true, xp: 0, happiness: 50,
      bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
      growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
      rarity: 'common', name: '',
    };
    const migrated = getMigrate()({ pets: [legacyPet], activePetId: 'p1' }, 15) as { pets: { defId: string }[] };
    expect(migrated.pets[0].defId).toBe(defaultDefForElement('fire').id);
  });

  it('already-set defId is not overwritten (idempotent)', () => {
    const legacyPet = {
      id: 'p1', species: 'water', hatched: true, xp: 0, happiness: 50,
      bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
      growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
      rarity: 'common', name: '', defId: 'def-water-1',
    };
    const migrated = getMigrate()({ pets: [legacyPet], activePetId: 'p1' }, 15) as { pets: { defId: string }[] };
    expect(migrated.pets[0].defId).toBe('def-water-1');
  });
});

describe('persist migrate v16->17 (caughtDefIds backfill)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  const makePetV16 = (id: string, defId: string) => ({
    id, defId, species: 'leaf', hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  });

  it('seeds caughtDefIds from the unique set of pets[].defId on a v16 save', () => {
    const v16 = {
      pets: [makePetV16('p1', 'def-leaf-1'), makePetV16('p2', 'def-fire-1')],
      activePetId: 'p1',
    };
    const out = getMigrate()(v16, 16) as { caughtDefIds: string[] };
    expect(out.caughtDefIds).toContain('def-leaf-1');
    expect(out.caughtDefIds).toContain('def-fire-1');
    expect(out.caughtDefIds).toHaveLength(2);
  });

  it('deduplicates when multiple pets share the same defId', () => {
    const v16 = {
      pets: [makePetV16('p1', 'def-leaf-1'), makePetV16('p2', 'def-leaf-1')],
      activePetId: 'p1',
    };
    const out = getMigrate()(v16, 16) as { caughtDefIds: string[] };
    expect(out.caughtDefIds).toEqual(['def-leaf-1']);
  });

  it('leaves an already-present caughtDefIds untouched, but remaps flat legacy ids (v17->v18)', () => {
    const v17 = {
      pets: [makePetV16('p1', 'def-leaf-1')],
      activePetId: 'p1',
      caughtDefIds: ['def-leaf-1', 'def-water-1'],
    };
    const out = getMigrate()(v17, 17) as { caughtDefIds: string[] };
    expect(out.caughtDefIds).toEqual(['def-leaf-1', 'def-water-1']);
  });
});

describe('persist migrate v17->18 (remap flat legacy element ids to chain roots)', () => {
  const getMigrate = () =>
    (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist.getOptions().migrate;

  const makePet = (id: string, defId: string, species = 'leaf') => ({
    id, defId, species, hatched: true, xp: 0, happiness: 50,
    bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
    stats: { hp: 1, atk: 1, def: 1, spd: 1, luk: 1 },
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
    rarity: 'common', name: '',
  });

  it('remaps a flat legacy defId on owned pets and in the caught-dex', () => {
    const v17 = {
      pets: [makePet('p1', 'def-leaf')],
      activePetId: 'p1',
      caughtDefIds: ['def-leaf'],
    };
    const out = getMigrate()(v17, 17) as { pets: { defId: string }[]; caughtDefIds: string[] };
    expect(out.pets[0].defId).toBe('def-leaf-1');
    expect(out.caughtDefIds).toEqual(['def-leaf-1']);
  });

  it('remaps a flat id seeded into caughtDefIds by the v16->v17 step, then de-dupes', () => {
    // A v16 save (no caughtDefIds): the dex is seeded from the pet's flat defId,
    // and the v17->v18 remap must run AFTER the seeding.
    const v16 = {
      pets: [makePet('p1', 'def-leaf')],
      activePetId: 'p1',
    };
    const out = getMigrate()(v16, 16) as { pets: { defId: string }[]; caughtDefIds: string[] };
    expect(out.pets[0].defId).toBe('def-leaf-1');
    expect(out.caughtDefIds).toEqual(['def-leaf-1']);
  });

  it('de-dupes when the caught list holds BOTH the flat and root form', () => {
    const v17 = {
      pets: [makePet('p1', 'def-leaf-1')],
      activePetId: 'p1',
      caughtDefIds: ['def-leaf', 'def-leaf-1'],
    };
    const out = getMigrate()(v17, 17) as { caughtDefIds: string[] };
    expect(out.caughtDefIds).toEqual(['def-leaf-1']);
  });

  it('passes non-flat ids through unchanged (imported / already-chained defs)', () => {
    const v17 = {
      pets: [makePet('p1', 'def-air-007-1', 'air'), makePet('p2', 'def-fire-2', 'fire')],
      activePetId: 'p1',
      caughtDefIds: ['def-air-007-1', 'def-fire-2'],
    };
    const out = getMigrate()(v17, 17) as { pets: { defId: string }[]; caughtDefIds: string[] };
    expect(out.pets[0].defId).toBe('def-air-007-1');
    expect(out.pets[1].defId).toBe('def-fire-2');
    expect(out.caughtDefIds).toEqual(['def-air-007-1', 'def-fire-2']);
  });
});

describe('caught dex set', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('freshState seeds the starter as caught', () => {
    const s = useGameStore.getState();
    // starter pet defId is the leaf chain root, def-leaf-1
    expect(selectCaughtSet(s).has('def-leaf-1')).toBe(true);
  });

  it('a gacha pull unions the pulled defId into caughtDefIds', () => {
    useGameStore.getState().addCoinsForTest(1000);
    const before = useGameStore.getState().caughtDefIds.length;
    useGameStore.getState().pullEgg();
    const after = useGameStore.getState();
    expect(after.caughtDefIds).toContain(after.lastPull!.defId);
    expect(after.caughtDefIds.length).toBeGreaterThanOrEqual(before);
  });

  it('a boss first-clear reward egg unions the egg defId into caughtDefIds', () => {
    // Mirror the setup from the 'boss flow' suite: startBoss then finishBoss(true).
    // The content store is already seeded with SEED_COURSE (which contains u1-checkpoint)
    // so no extra setup is required.
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    // finishBoss on a first-clear appends exactly one egg and records it in lastPull.
    const egg = s.lastPull;
    expect(egg).not.toBeNull();
    expect(s.caughtDefIds).toContain(egg!.defId);
  });

  it('PERSIST_VERSION is 18', () => {
    expect(PERSIST_VERSION).toBe(18);
  });
});

describe('finishBoss data-driven reward grant (P4c)', () => {
  // Seed a single-unit bundle with one checkpoint boss lesson. `rewardPetDefId`
  // is optional; setBundle round-trips arbitrary lesson fields through
  // bundleToDefaultCourse -> resolveCourseBundle so findLesson(bundle, id) finds it.
  function seedBossLesson(rewardPetDefId?: string) {
    const bundle: ContentBundle = {
      pool: { ...SEED.pool },
      units: [
        {
          id: 'reward-unit',
          title: 'Reward Unit',
          emoji: '⚔️',
          order: 1,
          lessons: [
            {
              id: 'reward-boss',
              kind: 'dragdrop',
              drill: 'mixed',
              level: 1,
              isCheckpoint: true,
              itemIds: ['mx-l1-1', 'mx-l1-2'],
              boss: { tierId: 'tier-1', element: 'fire', name: 'Test Rival', rivalSprite: { species: 'fire', stage: 'young' } },
              ...(rewardPetDefId ? { rewardPetDefId } : {}),
            },
          ],
        },
      ],
    };
    useContentStore.getState().setBundle(bundle, 'fallback');
    useGameStore.setState({ currentBossLessonId: 'reward-boss' });
  }

  beforeEach(() => useGameStore.getState().resetForTest());
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore registry after any mutation

  it('grants the exact reward def on first boss clear', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-1', element: 'fire', enabled: true }, ...BUILTIN_PET_DEFS]);
    seedBossLesson('reward-1');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    const granted = s.pets[s.pets.length - 1];
    expect(granted.defId).toBe('reward-1');
    expect(granted.species).toBe('fire'); // = def.element
    expect(s.lastHatch?.id).toBe(granted.id);
    expect(s.caughtDefIds).toContain('reward-1');
  });

  it('pool-picks an obtainable def when the boss has no rewardPetDefId', () => {
    seedBossLesson(); // no rewardPetDefId
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    const granted = s.pets[s.pets.length - 1];
    expect(obtainablePool().some((d) => d.id === granted.defId)).toBe(true);
    expect(s.lastHatch?.id).toBe(granted.id);
  });

  it('falls back to the starter def for a dangling rewardPetDefId', () => {
    seedBossLesson('does-not-exist');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    const granted = s.pets[s.pets.length - 1];
    expect(granted.defId).toBe(starterDef().id);
    expect(s.lastHatch).not.toBeNull();
  });

  it('clearHatch resets lastHatch to null', () => {
    seedBossLesson();
    useGameStore.getState().finishBoss(true);
    expect(useGameStore.getState().lastHatch).not.toBeNull();
    useGameStore.getState().clearHatch();
    expect(useGameStore.getState().lastHatch).toBeNull();
  });
});

describe('P4d def-chain evolution in the store', () => {
  beforeEach(() => useGameStore.getState().resetForTest());
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS.slice()));

  it('advances defId to evolvesToId on the baby->young stage-change and records the dex', () => {
    const base: PetDef = {
      id: 'p4d-base', name: 'Base', gen: 9, dexNo: 90, types: ['leaf'], element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, starter: true, evolvesToId: 'p4d-mid',
    };
    const mid: PetDef = {
      id: 'p4d-mid', name: 'Mid', gen: 9, dexNo: 91, types: ['fire'], element: 'fire',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, evolvesFromId: 'p4d-base',
    };
    setActivePetDefs([base, mid]);

    // Park a hatched baby just below L16 so one finishRound round tips it into young.
    const gain = xpPerCorrect(1);
    useGameStore.setState({
      pets: [{
        id: 'a', defId: 'p4d-base', species: 'leaf', hatched: true, xp: totalXpForLevel(16) - gain, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
      }],
      activePetId: 'a',
      caughtDefIds: ['p4d-base'],
    } as Partial<GameState>);

    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });

    const p = selectActivePet(useGameStore.getState());
    expect(p.defId).toBe('p4d-mid');
    expect(p.species).toBe('fire');
    expect(useGameStore.getState().caughtDefIds).toContain('p4d-mid');
  });

  it('hatch() (egg->baby) does not def-hop', () => {
    // hatch() only flips hatched:true — it never runs applyXp/evolvePetDef, so the
    // store's `from !== 'egg'` guard is belt-and-suspenders (the egg-stage no-op is
    // pinned at the unit level in evolution.test.ts).
    const base: PetDef = {
      id: 'p4d-h', name: 'H', gen: 9, dexNo: 92, types: ['leaf'], element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, starter: true, evolvesToId: 'p4d-h2',
    };
    const h2: PetDef = {
      id: 'p4d-h2', name: 'H2', gen: 9, dexNo: 93, types: ['fire'], element: 'fire',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, evolvesFromId: 'p4d-h',
    };
    setActivePetDefs([base, h2]);
    useGameStore.setState({
      pets: [{
        id: 'b', defId: 'p4d-h', species: 'leaf', hatched: false, xp: 0, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
      }],
      activePetId: 'b', caughtDefIds: ['p4d-h'],
    } as Partial<GameState>);

    useGameStore.getState().hatch();
    const p = selectActivePet(useGameStore.getState());
    expect(p.defId).toBe('p4d-h');
  });

  it('end-of-chain def (no evolvesToId) keeps its defId and adds nothing to the dex on baby->young', () => {
    const solo: PetDef = {
      id: 'p4d-solo', name: 'Solo', gen: 9, dexNo: 94, types: ['leaf'], element: 'leaf',
      statBands: BUILTIN_PET_DEFS[0].statBands, enabled: true, starter: true, // no evolvesToId -> end of chain
    };
    setActivePetDefs([solo]);

    // Park a hatched baby just below L16 so one finishRound round tips it into young.
    const gain = xpPerCorrect(1);
    useGameStore.setState({
      pets: [{
        id: 'c', defId: 'p4d-solo', species: 'leaf', hatched: true, xp: totalXpForLevel(16) - gain, happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 }, rarity: 'common', name: '',
      }],
      activePetId: 'c',
      caughtDefIds: ['p4d-solo'],
    } as Partial<GameState>);

    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 1 });

    // Crossed L16 (baby->young) but the def has no next hop: defId is unchanged and
    // nothing new is recorded in the dex.
    const p = selectActivePet(useGameStore.getState());
    expect(useGameStore.getState().lastStageChange).toEqual({ from: 'baby', to: 'young' });
    expect(p.defId).toBe('p4d-solo');
    expect(useGameStore.getState().caughtDefIds).toEqual(['p4d-solo']);
  });
});

describe('postCinematicScreen', () => {
  it('returns to the journey map (pickDrill) when a course is loaded (lesson context)', () => {
    expect(postCinematicScreen('default')).toBe('pickDrill');
  });

  it('returns to the pet room when no course is loaded (intro-hatch context)', () => {
    expect(postCinematicScreen(null)).toBe('petRoom');
  });
});

/** statBands where every stat in a tier is one fixed value, so a spawned pet's
 *  stats uniquely identify which rarity band the spawn used. */
function flatBands(): PetDef['statBands'] {
  const tier = (v: number) => ({ hp: [v, v], atk: [v, v], def: [v, v], spd: [v, v], luk: [v, v] } as PetDef['statBands']['common']);
  return { common: tier(10), rare: tier(20), epic: tier(80), legendary: tier(90) };
}

describe('starter rarity override', () => {
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore registry

  it('starter pet adopts the starter def rarity override and rolls stats from that band', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], rarity: 'epic', statBands: flatBands() }, ...BUILTIN_PET_DEFS.slice(1)]);
    useGameStore.getState().resetForTest(); // rebuilds the starter via freshPet()
    const starter = useGameStore.getState().pets.find((p) => p.id === STARTER_ID)!;
    expect(starter.rarity).toBe('epic');
    // epic band = 80 for every stat; proves stats came from statBands.epic, not .common (10).
    expect(Object.values(starter.stats).every((v) => v === 80)).toBe(true);
  });

  it('starter stays common when the starter def has no override', () => {
    setActivePetDefs(BUILTIN_PET_DEFS);
    useGameStore.getState().resetForTest();
    const starter = useGameStore.getState().pets.find((p) => p.id === STARTER_ID)!;
    expect(starter.rarity).toBe('common');
  });
});

describe('finishBoss reward rarity override', () => {
  function seedBossLesson(rewardPetDefId?: string) {
    const bundle: ContentBundle = {
      pool: { ...SEED.pool },
      units: [{
        id: 'rar-unit', title: 'Rarity Unit', emoji: '⚔️', order: 1,
        lessons: [{
          id: 'rar-boss', kind: 'dragdrop', drill: 'mixed', level: 1, isCheckpoint: true,
          itemIds: ['mx-l1-1', 'mx-l1-2'],
          boss: { tierId: 'tier-1', element: 'fire', name: 'Rival', rivalSprite: { species: 'fire', stage: 'young' } },
          ...(rewardPetDefId ? { rewardPetDefId } : {}),
        }],
      }],
    };
    useContentStore.getState().setBundle(bundle, 'fallback');
    useGameStore.setState({ currentBossLessonId: 'rar-boss' });
  }

  beforeEach(() => useGameStore.getState().resetForTest());
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS));

  it('forces the reward pet rarity from the def override and rolls stats from that band', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-leg', element: 'fire', enabled: true, rarity: 'legendary', statBands: flatBands() }, ...BUILTIN_PET_DEFS]);
    seedBossLesson('reward-leg');
    useGameStore.getState().finishBoss(true);
    const granted = useGameStore.getState().pets.at(-1)!;
    expect(granted.defId).toBe('reward-leg');
    expect(granted.rarity).toBe('legendary'); // was hardcoded 'common'
    // legendary band = 90 for every stat; proves stats came from statBands.legendary, not .common (10).
    expect(Object.values(granted.stats).every((v) => v === 90)).toBe(true);
  });

  it('reward pet stays common when the def has no override', () => {
    setActivePetDefs([{ ...BUILTIN_PET_DEFS[0], id: 'reward-plain', element: 'fire', enabled: true }, ...BUILTIN_PET_DEFS]);
    seedBossLesson('reward-plain');
    useGameStore.getState().finishBoss(true);
    const granted = useGameStore.getState().pets.at(-1)!;
    expect(granted.rarity).toBe('common');
  });
});

describe('reconcilePetDefs (hydration heal for dangling pet defIds)', () => {
  beforeEach(() => useGameStore.getState().resetForTest());
  afterEach(() => setActivePetDefs(BUILTIN_PET_DEFS)); // restore registry after any mutation

  it('remaps a pet whose defId is not in the active catalog to its element default root', () => {
    setActivePetDefs([...BUILTIN_PET_DEFS]); // catalog lacks the bogus id below
    const seed = useGameStore.getState().pets[0];
    useGameStore.setState({
      pets: [{ ...seed, species: 'water', defId: 'def-gone-forever' }],
    });
    useGameStore.getState().reconcilePetDefs();
    expect(useGameStore.getState().pets[0].defId).toBe(defaultDefForElement('water').id);
    // sanity: the element root really is the chain root, not a flat id
    expect(useGameStore.getState().pets[0].defId).toBe('def-water-1');
  });

  it('leaves a pet with a valid (present) defId unchanged', () => {
    setActivePetDefs([...BUILTIN_PET_DEFS]);
    const seed = useGameStore.getState().pets[0];
    useGameStore.setState({
      pets: [{ ...seed, species: 'fire', defId: 'def-fire-1' }],
    });
    useGameStore.getState().reconcilePetDefs();
    expect(useGameStore.getState().pets[0].defId).toBe('def-fire-1');
  });

  it('does not touch caughtDefIds even when it holds a dangling id', () => {
    setActivePetDefs([...BUILTIN_PET_DEFS]);
    const seed = useGameStore.getState().pets[0];
    useGameStore.setState({
      pets: [{ ...seed, species: 'water', defId: 'def-gone-forever' }],
      caughtDefIds: ['def-gone-forever', 'def-leaf-1'],
    });
    useGameStore.getState().reconcilePetDefs();
    expect(useGameStore.getState().caughtDefIds).toEqual(['def-gone-forever', 'def-leaf-1']);
  });
});
