import type { DrillItem } from '../data/types';
import type { CheckpointBoss, ContentBundle, Unit } from './model';

/** A boss node. `checkpoint` is per-unit (today). `gated` reviews 2–3 prior
 *  units. `final` ends the course. Review bosses sample items from reviewsUnitIds. */
export type BossScope = 'checkpoint' | 'gated' | 'final';

export interface BossNode {
  id: string;
  title: string;
  scope: BossScope;
  afterUnitId?: string;        // gated: which unit this gate sits after (trail placement)
  reviewsUnitIds?: string[];   // gated/final: units sourced for review items
  reviewCount?: number;        // gated/final: how many review items to sample
  pinnedItemIds?: string[];    // gated/final: always-included items; rest sampled
  boss: CheckpointBoss;        // reuse existing CheckpointBoss (tierId/element/name/rivalSprite)
  onClear?: 'completeCourse';  // final only
}

/** A course: a shared item pool, ordered units, multi-unit gates, and a final boss.
 *  finalBoss is optional in P1 (migrated legacy courses have none); P3 enforces it. */
export interface Course {
  id: string;
  title: string;
  emoji?: string;
  l1Ready?: boolean;
  pool: Record<string, DrillItem>;
  units: Unit[];
  gates: BossNode[];
  finalBoss?: BossNode;
}

/** Lightweight entry for the course-select screen (no pool/units payload). */
export interface CourseIndexEntry {
  id: string;
  title: string;
  emoji?: string;
  l1Ready?: boolean;
  locked?: boolean;
}

/** Adapt a Course to the legacy ContentBundle the player/model code consumes. */
export function activeBundle(course: Course): ContentBundle {
  return { pool: course.pool, units: course.units };
}

/** Units sorted by order ascending (defensive copy).
 *  Mirrors model.ts `orderedUnits` but takes a Course; consolidate to one in P3. */
export function courseUnits(course: Course): Unit[] {
  return [...course.units].sort((a, b) => a.order - b.order);
}
