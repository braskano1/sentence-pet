import type { DrillType } from '../../data/types';
import type { Unit, Lesson } from '../../content/model';
import { DRILL_FOOD, FOOD_META } from '../../data/food';
import { isLessonUnlocked, lessonCleared, unitProgress } from '../../domain/journeyProgress';
import type { LessonStars } from '../../domain/journeyProgress';

/** Display name per drill, shown under the current node and in folded bars. */
export const DRILL_LABEL: Record<DrillType, string> = {
  pattern: 'Sentence Pattern',
  wordChoice: 'Word Choice',
  grammar: 'Grammar',
  mixed: 'Mixed Review',
};

export interface DrillTint { bg: string; ring: string; ink: string; }

/** Soft per-drill tile tints (bg + ring + readable ink). */
export const DRILL_TINT: Record<DrillType, DrillTint> = {
  pattern: { bg: 'bg-orange-100', ring: 'ring-orange-200', ink: 'text-orange-700' },
  wordChoice: { bg: 'bg-green-100', ring: 'ring-green-200', ink: 'text-green-700' },
  grammar: { bg: 'bg-sky-100', ring: 'ring-sky-200', ink: 'text-sky-700' },
  mixed: { bg: 'bg-pink-100', ring: 'ring-pink-200', ink: 'text-pink-700' },
};

/** The food emoji a drill's lesson farms. */
export function foodEmoji(drill: DrillType): string {
  return FOOD_META[DRILL_FOOD[drill]].emoji;
}

/** Total stars earned across a unit's lessons. */
export function unitStars(unit: Unit, stars: LessonStars): number {
  return unit.lessons.reduce((sum, l) => sum + (stars[l.id] ?? 0), 0);
}

/** The single global "you are here": first unlocked, not-cleared lesson in journey order. */
export function currentLessonId(units: Unit[], stars: LessonStars): string | null {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (isLessonUnlocked(units, unit, lesson, stars) && !lessonCleared(stars, lesson.id)) {
        return lesson.id;
      }
    }
  }
  return null;
}

/** A unit is fully done when it has lessons and every one is cleared. */
export function unitDone(unit: Unit, stars: LessonStars): boolean {
  const { cleared, total } = unitProgress(unit, stars);
  return total > 0 && cleared === total;
}

/** Serpentine horizontal offset class by node index (left / center / right / center). */
export function serpentineOffset(index: number): string {
  return ['-translate-x-16', 'translate-x-0', 'translate-x-16', 'translate-x-0'][index % 4];
}

/** Accessible label for a lesson node. Phrasing preserved from the original JourneyMap. */
export function lessonLabel(unit: Unit, lesson: Lesson, stars: LessonStars, open: boolean): string {
  const what = lesson.isCheckpoint ? 'checkpoint' : `${lesson.drill} lesson`;
  const status = lessonCleared(stars, lesson.id)
    ? `cleared, ${stars[lesson.id]} stars`
    : open
      ? 'not started'
      : 'locked';
  return `${unit.title}: ${what}, ${status}`;
}
