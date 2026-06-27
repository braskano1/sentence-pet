import { create } from 'zustand';
import type { PetInstance } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { findTier } from '../domain/bossTiers';
import { displayStats } from '../config/petDisplay';
import {
  initBattle, applyPlayerHit, applyBossHit, type BattleSnapshot,
} from '../domain/battleSession';
import {
  computeHit, rollCrit, rollDodge, chargeFraction, lurchedFraction,
} from '../domain/battle';
import { GAME_CONFIG } from '../config/gameConfig';

/** A one-shot event the UI animates (bolt, crit, dodge, etc.). */
export type BattleEvent =
  | { kind: 'playerHit'; dmg: number; crit: boolean }
  | { kind: 'bossHit'; dmg: number }
  | { kind: 'dodge' }
  | { kind: 'miss' }
  | { kind: 'bossCharge' }
  | { kind: 'chargedHit'; dmg: number };

interface BattleState {
  snapshot: BattleSnapshot | null;
  pet: PetInstance | null;
  boss: CheckpointBoss | null;
  bossStats: { atk: number; def: number; spd: number } | null;
  itemsAnswered: number;
  lastEvent: BattleEvent | null;
  rng: () => number;
  charge: number;                     // 0..1 ring fill for the current item
  battlePhase: 'answering' | 'charged';
  begin: (pet: PetInstance, boss: CheckpointBoss, rng?: () => number) => void;
  onCorrect: () => void;
  onWrong: () => void;
  reset: () => void;
  tickCharge: (dtMs: number) => void;
  resolveSwipe: (success: boolean) => void;
}

const COUNTER_EVERY = 2; // P1 turn-based cadence (mirrors GAME_CONFIG.battle.bossCounterEveryNItems)
const TIMER = GAME_CONFIG.battle.timer;

export const useBattleStore = create<BattleState>((set) => ({
  snapshot: null,
  pet: null,
  boss: null,
  bossStats: null,
  itemsAnswered: 0,
  lastEvent: null,
  rng: Math.random,
  charge: 0,
  battlePhase: 'answering',

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
      charge: 0,
      battlePhase: 'answering',
    });
  },

  onCorrect: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      if (s.battlePhase === 'charged') return s; // charged attack must resolve via resolveSwipe first
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
        charge: 0,
        battlePhase: 'answering',
      };
    }),

  onWrong: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      if (s.battlePhase === 'charged') return s; // charged attack must resolve via resolveSwipe first
      const charge = lurchedFraction(s.charge, TIMER.wrongLurchFrac);
      const items = s.itemsAnswered + 1;
      if (items % COUNTER_EVERY !== 0) {
        return { itemsAnswered: items, charge, lastEvent: { kind: 'miss' } };
      }
      const ds = displayStats(s.pet);
      if (rollDodge(ds.spd, s.bossStats!.spd, s.rng)) {
        return { itemsAnswered: items, charge, lastEvent: { kind: 'dodge' } };
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
        charge,
        lastEvent: { kind: 'bossHit', dmg },
      };
    }),

  tickCharge: (dtMs) =>
    set((s) => {
      if (!s.snapshot || s.snapshot.outcome || s.battlePhase !== 'answering') return s;
      const elapsed = s.charge * TIMER.chargeMs + dtMs;
      const charge = chargeFraction(elapsed, TIMER.chargeMs);
      if (charge >= 1) {
        return { charge: 1, battlePhase: 'charged', lastEvent: { kind: 'bossCharge' } };
      }
      return { charge };
    }),

  resolveSwipe: (success) =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss || s.battlePhase !== 'charged') return s;
      const ds = displayStats(s.pet);
      const dodged = success || rollDodge(ds.spd, s.bossStats!.spd, s.rng);
      if (dodged) {
        return { charge: 0, battlePhase: 'answering', lastEvent: { kind: 'dodge' } };
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
        charge: 0,
        battlePhase: 'answering',
        lastEvent: { kind: 'chargedHit', dmg },
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
    charge: 0,
    battlePhase: 'answering',
  }),
}));
