import { GAME_CONFIG } from '../config/gameConfig';
import type { PetStage } from '../data/types';

export function xpPerCorrect(level: number): number {
  return GAME_CONFIG.xp.perLevelMultiplier * level;
}

export function stageForXp(xp: number, hatched: boolean): PetStage {
  if (!hatched) return 'egg';
  // Temporary hardcoded stage thresholds (to be replaced with level-based model)
  const young = 1000;
  const adult = 3000;
  if (xp >= adult) return 'adult';
  if (xp >= young) return 'young';
  return 'baby';
}
