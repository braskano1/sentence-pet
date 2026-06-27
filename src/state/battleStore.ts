import { create } from 'zustand';
import type { PetInstance } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { findTier } from '../domain/bossTiers';
import { displayStats } from '../config/petDisplay';
import {
  initBattle, applyPlayerHit, applyBossHit, type BattleSnapshot,
} from '../domain/battleSession';
import { computeHit, rollCrit, rollDodge } from '../domain/battle';

/** A one-shot event the UI animates (bolt, crit, dodge, etc.). */
export type BattleEvent =
  | { kind: 'playerHit'; dmg: number; crit: boolean }
  | { kind: 'bossHit'; dmg: number }
  | { kind: 'dodge' }
  | { kind: 'miss' };

interface BattleState {
  snapshot: BattleSnapshot | null;
  pet: PetInstance | null;
  boss: CheckpointBoss | null;
  bossStats: { atk: number; def: number; spd: number } | null;
  itemsAnswered: number;
  lastEvent: BattleEvent | null;
  rng: () => number;
  begin: (pet: PetInstance, boss: CheckpointBoss, rng?: () => number) => void;
  onCorrect: () => void;
  onWrong: () => void;
  reset: () => void;
}

const COUNTER_EVERY = 2; // P1 turn-based cadence (mirrors GAME_CONFIG.battle.bossCounterEveryNItems)

export const useBattleStore = create<BattleState>((set) => ({
  snapshot: null,
  pet: null,
  boss: null,
  bossStats: null,
  itemsAnswered: 0,
  lastEvent: null,
  rng: Math.random,

  begin: (pet, boss, rng = Math.random) => {
    const tier = findTier(boss.tierId);
    if (!tier) return;
    const ds = displayStats(pet);
    set({
      pet,
      boss,
      bossStats: { atk: tier.atk, def: tier.def, spd: tier.spd },
      snapshot: initBattle({ bossHpPool: tier.hpPool, petHpStat: ds.hp }),
      itemsAnswered: 0,
      lastEvent: null,
      rng,
    });
  },

  onCorrect: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      const ds = displayStats(s.pet);
      const crit = rollCrit(ds.luk, s.rng);
      const dmg = computeHit({
        atkStat: ds.atk,
        defStat: s.bossStats!.def,
        attackerSpecies: s.pet.species,
        defenderSpecies: s.boss.element,
        crit,
      });
      return {
        snapshot: applyPlayerHit(s.snapshot, dmg),
        itemsAnswered: s.itemsAnswered + 1,
        lastEvent: { kind: 'playerHit', dmg, crit },
      };
    }),

  onWrong: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      const items = s.itemsAnswered + 1;
      if (items % COUNTER_EVERY !== 0) {
        return { itemsAnswered: items, lastEvent: { kind: 'miss' } };
      }
      const ds = displayStats(s.pet);
      if (rollDodge(ds.spd, s.bossStats!.spd, s.rng)) {
        return { itemsAnswered: items, lastEvent: { kind: 'dodge' } };
      }
      const dmg = computeHit({
        atkStat: s.bossStats!.atk,
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
      return {
        snapshot: applyBossHit(s.snapshot, dmg),
        itemsAnswered: items,
        lastEvent: { kind: 'bossHit', dmg },
      };
    }),

  reset: () => set({
    snapshot: null,
    pet: null,
    boss: null,
    bossStats: null,
    itemsAnswered: 0,
    lastEvent: null,
    rng: Math.random,
  }),
}));
