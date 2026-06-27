import { GAME_CONFIG } from '../config/gameConfig';
import type { Species } from '../data/types';

const B = GAME_CONFIG.battle;

/** 4-cycle element wheel: each element BEATS the value it maps to. */
export const ELEMENT_BEATS: Record<Species, Species> = {
  fire: 'air',
  air: 'leaf',
  leaf: 'water',
  water: 'fire',
};

/** Damage multiplier for attacker's element vs defender's element. */
export function elementMultiplier(attacker: Species, defender: Species): number {
  if (ELEMENT_BEATS[attacker] === defender) return B.element.advantage;
  if (ELEMENT_BEATS[defender] === attacker) return B.element.disadvantage;
  return B.element.neutral;
}

/** Derived HP pool from the hp stat (decoupled from the atk scale). */
export function maxHpFromStat(hpStat: number): number {
  return hpStat * B.hpMultiplier;
}

/** Ratio defense: atk × C/(C+def). Never 0, never negative, diminishing returns. */
export function mitigatedBase(atk: number, def: number): number {
  return atk * (B.defConstant / (B.defConstant + def));
}

/** Crit chance from the luk stat, capped. */
export function critChance(lukStat: number): number {
  return Math.min(B.critCap, Math.max(0, lukStat * B.critPerLuk));
}

export interface HitParams {
  atkStat: number;
  defStat: number;
  attackerSpecies: Species;
  defenderSpecies: Species;
  crit: boolean;
}

/** Final integer damage for one hit (min 1). */
export function computeHit(p: HitParams): number {
  const base = mitigatedBase(p.atkStat, p.defStat);
  const crit = p.crit ? B.critMult : 1;
  const elem = elementMultiplier(p.attackerSpecies, p.defenderSpecies);
  return Math.max(1, Math.round(base * B.combatScalar * crit * elem));
}

/** Dodge probability from the spd delta, clamped to [0, cap]. */
export function dodgeChance(playerSpd: number, bossSpd: number): number {
  const raw = B.dodgeBase + (playerSpd - bossSpd) * B.dodgePerSpd;
  return Math.min(B.dodgeCap, Math.max(0, raw));
}

export function rollDodge(playerSpd: number, bossSpd: number, rng: () => number): boolean {
  return rng() < dodgeChance(playerSpd, bossSpd);
}

export function rollCrit(lukStat: number, rng: () => number): boolean {
  return rng() < critChance(lukStat);
}

export function firstStrike(playerSpd: number, bossSpd: number): boolean {
  return playerSpd > bossSpd;
}
