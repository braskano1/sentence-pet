// src/content/review.ts
import type { Course, BossNode } from './course';
import { isDragDrop } from '../data/types';

/** Fisher–Yates using an injected RNG (deterministic in tests). Pure: copies input. */
function shuffleWith<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** True iff `id` resolves in the pool AND is a dragdrop item (the only kind the
 *  battle engine renders). Guards undefined before the isDragDrop type guard. */
function isReviewable(course: Course, id: string): boolean {
  const item = course.pool[id];
  return !!item && isDragDrop(item);
}

/**
 * Resolve the dragdrop item ids a gated/final boss battles.
 * Pinned ids (existing + dragdrop) come first and are always included; the
 * remainder is sampled from the union of `reviewsUnitIds` units' lesson itemIds
 * (dragdrop, deduped, minus pinned), shuffled by `rng`, capped at `reviewCount`.
 * With no `reviewCount`, every reviewable item is returned.
 */
export function sampleReviewItems(course: Course, node: BossNode, rng: () => number): string[] {
  const pinned = (node.pinnedItemIds ?? []).filter((id) => isReviewable(course, id));
  const pinnedSet = new Set(pinned);

  const reviewUnits = new Set(node.reviewsUnitIds ?? []);
  const candidates = [
    ...new Set(
      course.units
        .filter((u) => reviewUnits.has(u.id))
        .flatMap((u) => u.lessons.flatMap((l) => l.itemIds))
        .filter((id) => isReviewable(course, id) && !pinnedSet.has(id)),
    ),
  ];

  const want = node.reviewCount ?? pinned.length + candidates.length;
  const fill = shuffleWith(candidates, rng).slice(0, Math.max(0, want - pinned.length));
  return [...pinned, ...fill];
}
