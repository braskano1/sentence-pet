import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

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

  it('startDrill selects the drill and opens the drill screen', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().startDrill('wordChoice');
    const s = useGameStore.getState();
    expect(s.selectedDrill).toBe('wordChoice');
    expect(s.screen).toBe('drill');
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
});
