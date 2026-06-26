import type { Unit, Lesson } from '../content/model';

export type LessonStars = Record<string, number>;

/** A lesson is cleared iff its id is present in the stars map. */
export function lessonCleared(stars: LessonStars, lessonId: string): boolean {
  return Object.prototype.hasOwnProperty.call(stars, lessonId);
}

/** Cleared / total lesson counts for a unit's progress badge. */
export function unitProgress(unit: Unit, stars: LessonStars): { cleared: number; total: number } {
  const cleared = unit.lessons.filter((l) => lessonCleared(stars, l.id)).length;
  return { cleared, total: unit.lessons.length };
}

/** The unit immediately before `unit` by order, or undefined for the first. */
function previousUnit(journey: Unit[], unit: Unit): Unit | undefined {
  const ordered = [...journey].sort((a, b) => a.order - b.order);
  const idx = ordered.findIndex((u) => u.id === unit.id);
  return idx > 0 ? ordered[idx - 1] : undefined;
}

/** First unit always open; later units gated on the previous unit's checkpoint. */
export function isUnitUnlocked(journey: Unit[], unit: Unit, stars: LessonStars): boolean {
  const prev = previousUnit(journey, unit);
  if (!prev) return true;
  const checkpoint = prev.lessons.find((l) => l.isCheckpoint);
  return checkpoint ? lessonCleared(stars, checkpoint.id) : true;
}

/** Unit-gated: all non-checkpoint lessons of an unlocked unit are open.
 *  The checkpoint opens once every non-checkpoint lesson in the unit is cleared. */
export function isLessonUnlocked(journey: Unit[], unit: Unit, lesson: Lesson, stars: LessonStars): boolean {
  if (!isUnitUnlocked(journey, unit, stars)) return false;
  if (!lesson.isCheckpoint) return true;
  return unit.lessons.filter((l) => !l.isCheckpoint).every((l) => lessonCleared(stars, l.id));
}
