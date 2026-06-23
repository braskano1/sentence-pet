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

  it('finishRound adds xp, food inventory, coins and decays stats', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ level: 1, stars: 3, correctCount: 5 });
    const s = useGameStore.getState();
    expect(s.pet.xp).toBe(50);                 // 5 correct * (10*level=10)
    expect(s.inventory.protein).toBe(5);        // 1 food per correct
    expect(s.pet.coins).toBe(25);               // 10 + 5*3
    expect(s.pet.bars.protein).toBe(55);        // 60 - 5 decay
    expect(s.lastReward).toEqual({ level: 1, stars: 3, food: 5, coins: 25 });
  });

  it('feedAll moves protein inventory into the bar and clears it', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().finishRound({ level: 1, stars: 3, correctCount: 5 });
    useGameStore.getState().feedAll();
    const s = useGameStore.getState();
    expect(s.inventory.protein).toBe(0);
    expect(s.pet.bars.protein).toBe(100);       // 55 + 75 capped at 100
  });

  it('xp at/over young threshold reports young stage', () => {
    useGameStore.getState().hatch();
    useGameStore.getState().addXpForTest(1000);
    expect(useGameStore.getState().stage()).toBe('young');
  });
});
