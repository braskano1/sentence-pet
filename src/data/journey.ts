import type { DrillType } from './types';

/** One node on the journey: a named pointer to a (drill, level) round.
 *  isCheckpoint marks the unit's final node — the forward hook where the
 *  Phase B-3 boss battle will later swap in for the Mixed round. */
export interface Lesson {
  id: string;
  drill: DrillType;
  level: number;
  isCheckpoint?: boolean;
}

/** A themed cluster of lessons. Cleared checkpoint unlocks the next unit. */
export interface Unit {
  id: string;
  title: string;
  emoji: string;
  order: number;
  lessons: Lesson[];
}

/** Seed journey. Wraps existing WORD_BANK content so the journey ships
 *  playable; theme-specific items arrive with the admin backend later. */
export const JOURNEY: Unit[] = [
  {
    id: 'u1-basics',
    title: 'Basics',
    emoji: '🐣',
    order: 1,
    lessons: [
      { id: 'u1-pattern', drill: 'pattern', level: 1 },
      { id: 'u1-wordchoice', drill: 'wordChoice', level: 1 },
      { id: 'u1-grammar', drill: 'grammar', level: 1 },
      { id: 'u1-checkpoint', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
  {
    id: 'u2-next-steps',
    title: 'Next Steps',
    emoji: '🌱',
    order: 2,
    lessons: [
      { id: 'u2-pattern', drill: 'pattern', level: 2 },
      { id: 'u2-grammar', drill: 'grammar', level: 2 },
      { id: 'u2-checkpoint', drill: 'mixed', level: 1, isCheckpoint: true },
    ],
  },
];

/** Units sorted by order (defensive; JOURNEY is authored sorted). */
export function orderedUnits(): Unit[] {
  return [...JOURNEY].sort((a, b) => a.order - b.order);
}

/** Resolve a lesson id to its unit + lesson, or undefined. */
export function findLesson(id: string): { unit: Unit; lesson: Lesson } | undefined {
  for (const unit of JOURNEY) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return undefined;
}
