import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { GAME_CONFIG } from '../config/gameConfig';

function reset() {
  useGameStore.getState().resetForTest();
}

describe('gameStore', () => {
  beforeEach(reset);

  it('starts on the egg screen, not hatched', () => {
    const s = useGameStore.getState();
    expect(s.screen).toBe('egg');
    expect(s.pet.hatched).toBe(false);
    expect(s.pet.xp).toBe(0);
  });

  it('hatch() marks hatched and moves to petRoom', () => {
    useGameStore.getState().hatch();
    const s = useGameStore.getState();
    expect(s.pet.hatched).toBe(true);
    expect(s.screen).toBe('petRoom');
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

  it('finishRound (pattern) adds xp, protein food, coins and decays stats', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'pattern', level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.pet.xp).toBe(50);
    expect(s.inventory.protein).toBe(5);
    expect(s.pet.coins).toBe(25);
    expect(s.pet.bars.protein).toBe(55);
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

  it('feed(group) moves that food into its bar and clears only that group', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ drill: 'wordChoice', level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().feed('veggie');
    const s = useGameStore.getState();
    expect(s.inventory.veggie).toBe(0);
    expect(s.pet.bars.veggie).toBe(100);
    expect(s.pet.bars.protein).toBe(55);
  });

  it('xp at/over young threshold reports young stage', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().addXpForTest(1000);
    expect(useGameStore.getState().stage()).toBe('young');
  });

  describe('buyTreat', () => {
    const snack = GAME_CONFIG.shop.treats[0]; // price 15, +15 happiness

    it('spends coins and raises happiness', () => {
      const s = useGameStore.getState();
      s.resetForTest();
      s.addCoinsForTest(100);
      useGameStore.getState().buyTreat(snack);
      const pet = useGameStore.getState().pet;
      expect(pet.coins).toBe(85);
      expect(pet.happiness).toBe(GAME_CONFIG.happiness.start + 15); // 60 + 15 = 75
    });

    it('is a no-op when unaffordable', () => {
      const s = useGameStore.getState();
      s.resetForTest(); // coins 0
      useGameStore.getState().buyTreat(snack);
      const pet = useGameStore.getState().pet;
      expect(pet.coins).toBe(0);
      expect(pet.happiness).toBe(GAME_CONFIG.happiness.start);
    });
  });
});

describe('species', () => {
  it('freshPet defaults to leaf before hatch', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().pet.species).toBe('leaf');
  });

  it('hatch assigns a valid species', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().hatch();
    expect(['leaf', 'fire', 'air', 'water']).toContain(useGameStore.getState().pet.species);
  });
});

describe('migrate v2 -> v3', () => {
  it('backfills species=leaf and keeps inventory backfill', () => {
    const persist = (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist;
    const migrated = persist.getOptions().migrate(
      { pet: { hatched: true, xp: 0, coins: 5, happiness: 60, bars: { protein: 1 } }, inventory: { protein: 2 } },
      2,
    ) as { pet: { species: string }; inventory: Record<string, number> };
    expect(migrated.pet.species).toBe('leaf');
    expect(migrated.inventory.veggie).toBe(0);
  });
});
