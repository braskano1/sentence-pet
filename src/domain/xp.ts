import { GAME_CONFIG } from '../config/gameConfig';
import type { PetStage } from '../data/types';

export function xpPerCorrect(level: number): number {
  return GAME_CONFIG.xp.perLevelMultiplier * level;
}

/** First level of each non-egg stage. Add/retune a stage = one line here. */
export const STAGE_LEVEL = { baby: 1, young: 16, adult: 36 } as const;

export const STAGE_ORDER: PetStage[] = ['egg', 'baby', 'young', 'adult'];

export const STAGE_NAME: Record<PetStage, string> = {
  egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult',
};

/** True when `to` is a later stage than `from`. */
export function stageUp(from: PetStage, to: PetStage): boolean {
  return STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
}

export function stageForLevel(level: number): Exclude<PetStage, 'egg'> {
  if (level >= STAGE_LEVEL.adult) return 'adult';
  if (level >= STAGE_LEVEL.young) return 'young';
  return 'baby';
}

export function stageForXp(xp: number, hatched: boolean): PetStage {
  if (!hatched) return 'egg';
  return stageForLevel(levelForXp(xp));
}

const { maxLevel, curve } = GAME_CONFIG.xp;

/** XP needed to go from `level` to `level+1`. Infinity once at/over the cap. */
export function xpToNext(level: number): number {
  if (level >= maxLevel) return Infinity;
  return Math.round(curve.base * level ** curve.growth);
}

/** Total cumulative XP required to *be* `level` (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** Current level (1..maxLevel) for a total XP amount. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < maxLevel && xp >= totalXpForLevel(level + 1)) level++;
  return level;
}

export interface XpProgress {
  level: number;   // 1..maxLevel
  into: number;    // xp earned into the current level
  span: number;    // xp the current level spans (Infinity at max)
  toNext: number;  // xp remaining to next level (0 at max)
  atMax: boolean;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const atMax = level >= maxLevel;
  const into = xp - totalXpForLevel(level);
  const span = xpToNext(level);
  return { level, into, span, toNext: atMax ? 0 : span - into, atMax };
}
