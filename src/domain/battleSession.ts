import { maxHpFromStat } from './battle';

export type BattleOutcome = 'win' | 'lose' | null;

export interface BattleSnapshot {
  bossHp: number;
  bossHpMax: number;
  petHp: number;
  petHpMax: number;
  outcome: BattleOutcome;
}

export function initBattle(args: { bossHpPool: number; petHpStat: number }): BattleSnapshot {
  const petHpMax = maxHpFromStat(args.petHpStat);
  return {
    bossHp: args.bossHpPool,
    bossHpMax: args.bossHpPool,
    petHp: petHpMax,
    petHpMax,
    outcome: null,
  };
}

export function applyPlayerHit(s: BattleSnapshot, dmg: number): BattleSnapshot {
  if (s.outcome) return s;
  const bossHp = Math.max(0, s.bossHp - dmg);
  return { ...s, bossHp, outcome: bossHp === 0 ? 'win' : null };
}

export function applyBossHit(s: BattleSnapshot, dmg: number): BattleSnapshot {
  if (s.outcome) return s;
  const petHp = Math.max(0, s.petHp - dmg);
  return { ...s, petHp, outcome: petHp === 0 ? 'lose' : null };
}
