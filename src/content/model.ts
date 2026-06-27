import type { DrillItem, DrillType, Species, PetStage, ContentKind } from '../data/types';

/** Per-checkpoint boss: a rival pet (reused sprite) parameterised by tier + element. */
export interface CheckpointBoss {
  tierId: string;            // references a BossTier (src/domain/bossTiers.ts)
  element: Species;          // boss element for the matchup wheel
  name: string;              // display name
  rivalSprite: { species: Species; stage: Exclude<PetStage, 'egg'> }; // pet art reused as the boss
}

/** One node on the journey: references explicit pool item ids.
 *  isCheckpoint marks the unit's final node (the future B-3 boss seam). */
export interface Lesson {
  id: string;
  kind?: ContentKind;         // which activity screen renders + which pool items are valid
  drill: DrillType;           // dragdrop variant; only meaningful when kind === 'dragdrop' (validated in P2)
  level: number;
  itemIds: string[];
  isCheckpoint?: boolean;
  title?: string;
  boss?: CheckpointBoss;
}

/** A themed cluster of lessons. Cleared checkpoint unlocks the next unit. */
export interface Unit {
  id: string;
  title: string;
  emoji: string;
  order: number;
  l1Enabled?: boolean;        // set by the admin tool; consumed client-side to gate the TH/ENG (L1) toggle
  lessons: Lesson[];
}

/** Everything the player and admin operate on: a shared item pool + the journey. */
export interface ContentBundle {
  pool: Record<string, DrillItem>;
  units: Unit[];
}

/** Units sorted by order ascending (defensive copy). */
export function orderedUnits(bundle: ContentBundle): Unit[] {
  return [...bundle.units].sort((a, b) => a.order - b.order);
}

/** Resolve a lesson id to its unit + lesson, or undefined. */
export function findLesson(bundle: ContentBundle, id: string): { unit: Unit; lesson: Lesson } | undefined {
  for (const unit of bundle.units) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return undefined;
}

/** Resolve a lesson's itemIds to pool items, in order; unknown ids are skipped. */
export function itemsForLesson(bundle: ContentBundle, lesson: Lesson): DrillItem[] {
  return lesson.itemIds.map((id) => bundle.pool[id]).filter((i): i is DrillItem => i !== undefined);
}

/** Free-practice fallback: all pool items of a given drill + level. */
export function itemsForDrill(bundle: ContentBundle, drill: DrillType, level: number): DrillItem[] {
  return Object.values(bundle.pool).filter((i) => i.drill === drill && i.level === level);
}

/** The egg-hatch tutorial item: first pattern level-1 item in the pool. */
export function tutorialItem(bundle: ContentBundle): DrillItem | undefined {
  return Object.values(bundle.pool).find((i) => i.drill === 'pattern' && i.level === 1);
}

/** Tiles for an item's tray: answer words, then distractors, then trap words. */
export function trayWords(item: DrillItem): string[] {
  return [
    ...item.answer,
    ...(item.distractors ?? []),
    ...(item.traps ?? []).map((t) => t.word),
  ];
}
