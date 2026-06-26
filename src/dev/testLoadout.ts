// DEV-only. Builds a representative "returning player with progress" store state.
// Imported only by DevPanel, so it is tree-shaken out of production builds.
import { makePet, rollStatsForRarity } from '../domain/pets';
import { totalXpForLevel } from '../domain/xp';
import { GAME_CONFIG } from '../config/gameConfig';
import type { PetInstance } from '../data/types';

const DECOR_ID = 'decor:forest-path';

/** A mid-game progress snapshot: two hatched pets, coins, journey progress, a decorated room. */
export function devTestLoadout(opts: { clearedLessonIds?: string[]; rng?: () => number } = {}) {
  const rng = opts.rng ?? Math.random;
  const cleared = opts.clearedLessonIds ?? [];
  const rarities = GAME_CONFIG.gacha.rarities;

  const pet1: PetInstance = {
    ...makePet({
      id: 'dev-pet-1', species: 'leaf', rarity: 'rare', name: 'Sprout', hatched: true,
      stats: rollStatsForRarity('rare', rng, rarities),
    }),
    xp: totalXpForLevel(12),
  };
  const pet2: PetInstance = makePet({
    id: 'dev-pet-2', species: 'fire', rarity: 'epic', name: 'Ember', hatched: true,
    stats: rollStatsForRarity('epic', rng, rarities),
  });

  const lessonStars: Record<string, number> = {};
  cleared.forEach((id, i) => { lessonStars[id] = i === 0 ? 3 : 2; });

  return {
    screen: 'petRoom' as const,
    pets: [pet1, pet2],
    activePetId: pet1.id,
    coins: 500,
    inventory: { protein: 5, veggie: 5, vitamin: 5, treat: 5 },
    selectedDrill: 'pattern' as const,
    selectedLevel: 1,
    lastReward: null,
    lastPull: null,
    owned: [DECOR_ID],
    activeBackground: DECOR_ID,
    lastLevelUp: null,
    journey: { lessonStars },
    currentLessonId: null,
  };
}
