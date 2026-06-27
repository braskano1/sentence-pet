import { describe, it, expect } from 'vitest';
import { initBattle, applyPlayerHit, applyBossHit, type BattleSnapshot } from './battleSession';

const snap = (over: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
  bossHp: 400, bossHpMax: 400, petHp: 800, petHpMax: 800, outcome: null, ...over,
});

describe('initBattle', () => {
  it('starts both bars full with no outcome', () => {
    const s = initBattle({ bossHpPool: 400, petHpStat: 100 });
    expect(s).toEqual({ bossHp: 400, bossHpMax: 400, petHp: 800, petHpMax: 800, outcome: null });
  });
});

describe('applyPlayerHit', () => {
  it('reduces boss hp, clamps at 0, sets win when boss falls', () => {
    expect(applyPlayerHit(snap(), 120).bossHp).toBe(280);
    const dead = applyPlayerHit(snap({ bossHp: 100 }), 250);
    expect(dead.bossHp).toBe(0);
    expect(dead.outcome).toBe('win');
  });
  it('is a no-op once the battle is resolved', () => {
    const won = snap({ bossHp: 0, outcome: 'win' });
    expect(applyPlayerHit(won, 50)).toBe(won);
  });
});

describe('applyBossHit', () => {
  it('reduces pet hp, clamps at 0, sets lose when pet faints', () => {
    expect(applyBossHit(snap(), 200).petHp).toBe(600);
    const dead = applyBossHit(snap({ petHp: 80 }), 90);
    expect(dead.petHp).toBe(0);
    expect(dead.outcome).toBe('lose');
  });
});
