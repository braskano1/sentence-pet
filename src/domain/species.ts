import { GAME_CONFIG } from '../config/gameConfig';
import type { PetMood, Species } from '../data/types';

export const SPECIES: readonly Species[] = ['leaf', 'fire', 'air', 'water'] as const;

/** Uniform 1-of-4. `rng` injectable for deterministic tests. */
export function pickSpecies(rng: () => number = Math.random): Species {
  return SPECIES[Math.floor(rng() * SPECIES.length)];
}

/** Happy when happiness reaches the configured fraction of max, else sad. */
export function moodFor(happiness: number, max: number): PetMood {
  return happiness >= max * GAME_CONFIG.mood.happyThreshold ? 'happy' : 'sad';
}
