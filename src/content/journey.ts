// src/content/journey.ts
import type { Course, BossNode } from './course';
import { activeBundle } from './course';
import type { ContentBundle, Unit, Lesson } from './model';
import { sampleReviewItems } from './review';

/** Synthetic-unit id namespace, kept distinct from authored unit ids. */
export const BOSS_UNIT_PREFIX = 'boss-unit:';

/** Highest authored unit order (0 when there are no units). */
function maxOrder(course: Course): number {
  return course.units.reduce((m, u) => Math.max(m, u.order), 0);
}

/** Build a synthetic single-checkpoint unit wrapping a gated/final boss node.
 *  The lesson id IS the node id, so journey stars + completion key by node. */
function bossUnit(course: Course, node: BossNode, rng: () => number, order: number, emoji: string): Unit {
  const itemIds = sampleReviewItems(course, node, rng);
  const lesson: Lesson = {
    id: node.id,
    kind: 'dragdrop',          // battle engine is dragdrop-only
    drill: 'mixed',
    level: 1,
    itemIds,
    isCheckpoint: true,
    title: node.title,
    boss: node.boss,
    ...(node.onClear ? { onClear: node.onClear } : {}),
  };
  return { id: `${BOSS_UNIT_PREFIX}${node.id}`, title: node.title, emoji, order, lessons: [lesson] };
}

/**
 * Adapt a Course to the ContentBundle the player runtime consumes, materialising
 * gated/final bosses as synthetic checkpoint units. Gated bosses are placed after
 * their `afterUnitId` (order +0.5); the final boss is appended (max +1). All
 * downstream code sorts by `order`, so placement, unlock gating, and the battle
 * flow work without further changes. Pure given a deterministic `rng`.
 */
export function resolveCourseBundle(course: Course, rng: () => number): ContentBundle {
  const base = activeBundle(course);
  const extra: Unit[] = [];

  for (const gate of course.gates) {
    const after = course.units.find((u) => u.id === gate.afterUnitId);
    const order = (after?.order ?? maxOrder(course)) + 0.5;
    extra.push(bossUnit(course, gate, rng, order, '⚔️'));
  }
  if (course.finalBoss) {
    extra.push(bossUnit(course, course.finalBoss, rng, maxOrder(course) + 1, '👑'));
  }

  return { pool: base.pool, units: [...base.units, ...extra] };
}
