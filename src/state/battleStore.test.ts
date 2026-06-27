import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import { makePet } from '../domain/pets';
import type { CheckpointBoss } from '../content/model';
import { BOSS_TIERS } from '../domain/bossTiers';

const boss: CheckpointBoss = {
  tierId: 'tier-1', element: 'fire', name: 'Ember Rival',
  rivalSprite: { species: 'fire', stage: 'young' },
};
const pet = makePet({
  id: 'p1', species: 'water',
  stats: { hp: 100, atk: 100, def: 50, spd: 60, luk: 0 },
  rarity: 'common',
});

describe('battleStore', () => {
  beforeEach(() => useBattleStore.getState().reset());

  it('begin sets up full bars from pet + tier', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99);
    const s = useBattleStore.getState();
    expect(s.snapshot?.bossHpMax).toBe(BOSS_TIERS[0].hpPool);
    expect(s.snapshot?.petHpMax).toBe(800); // hp 100 × 8
    expect(s.lastEvent).toBeNull();
  });

  it('a correct answer damages the boss (water beats fire = ×1.5)', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → no crit
    useBattleStore.getState().onCorrect();
    const s = useBattleStore.getState();
    expect(s.snapshot!.bossHp).toBeLessThan(BOSS_TIERS[0].hpPool);
    expect(s.lastEvent?.kind).toBe('playerHit');
  });

  it('a wrong answer on the counter-cadence item makes the boss attack', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → boss hit lands (no dodge)
    useBattleStore.getState().onWrong(); // item 1 → miss (not on every-2 cadence)
    useBattleStore.getState().onWrong(); // item 2 → boss attacks
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(800);
    expect(['bossHit', 'dodge']).toContain(s.lastEvent?.kind);
  });
});
