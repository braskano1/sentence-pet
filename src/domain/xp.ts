import { GAME_CONFIG } from '../config/gameConfig';
import type { PetStage } from '../data/types';

export function xpForLevel(level: number): number {
  return GAME_CONFIG.xp.perLevelMultiplier * level;
}

export function stageForXp(xp: number, hatched: boolean): PetStage {
  if (!hatched) return 'egg';
  const { young, adult } = GAME_CONFIG.xp.evolution;
  if (xp >= adult) return 'adult';
  if (xp >= young) return 'young';
  return 'baby';
}
