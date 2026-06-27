import type { ContentBundle } from './model';
import type { Course } from './course';
import type { ContentItem } from '../data/types';

/** Per-kind item checks. Self-dispatches on item.kind so every pool kind is
 *  validated structurally; shared checks (level, l1) run for all kinds. */
function validateItem(itemId: string, item: ContentItem, push: (m: string) => void): void {
  if (item.level < 1) push(`item ${itemId} level must be >= 1`);
  if (item.l1 && item.l1.th.trim() === '') push(`item ${itemId} l1.th is empty`);
  switch (item.kind) {
    case 'dragdrop':
      if (item.answer.length !== item.slots.length) push(`item ${itemId} answer/slots length mismatch`);
      for (const trap of item.traps ?? []) {
        if (trap.slot < 0 || trap.slot >= item.slots.length) push(`item ${itemId} trap slot out of range`);
      }
      break;
    case 'flashcard':
      if (item.front.trim() === '') push(`item ${itemId} flashcard front is empty`);
      if (item.back.trim() === '') push(`item ${itemId} flashcard back is empty`);
      break;
    case 'matching':
      if (item.pairs.length < 2) push(`item ${itemId} matching needs >= 2 pairs`);
      item.pairs.forEach((p, i) => {
        if (p.left.trim() === '' || p.right.trim() === '') push(`item ${itemId} pair ${i} incomplete`);
        if (p.l1 && p.l1.th.trim() === '') push(`item ${itemId} pair ${i} l1.th is empty`);
      });
      break;
    case 'fillblank': {
      const blanks = (item.template.match(/___/g) ?? []).length;
      if (blanks !== 1) push(`item ${itemId} fillblank template must have exactly one ___`);
      if (item.answer.trim() === '') push(`item ${itemId} fillblank answer is empty`);
      break;
    }
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
    }
  }
}

/** Structural invariants shared by legacy bundle + course. */
function validateBundleShape(bundle: ContentBundle, push: (m: string) => void): void {
  if (bundle.units.length === 0) push('journey has no units');

  const unitIds = bundle.units.map((u) => u.id);
  if (new Set(unitIds).size !== unitIds.length) push('duplicate unit ids');

  const lessonIds: string[] = [];
  for (const unit of bundle.units) {
    if (unit.lessons.length === 0) { push(`unit ${unit.id} has no lessons`); continue; }

    const checkpoints = unit.lessons.filter((l) => l.isCheckpoint);
    if (checkpoints.length !== 1) push(`unit ${unit.id} must have exactly one checkpoint`);
    if (!unit.lessons[unit.lessons.length - 1].isCheckpoint) push(`unit ${unit.id} checkpoint must be last`);

    for (const lesson of unit.lessons) {
      lessonIds.push(lesson.id);
      if (lesson.itemIds.length === 0) push(`lesson ${lesson.id} has no items`);
      for (const itemId of lesson.itemIds) {
        const item = bundle.pool[itemId];
        if (!item) { push(`lesson ${lesson.id} references unknown item ${itemId}`); continue; }
        validateItem(itemId, item, push);
      }
    }
  }

  if (new Set(lessonIds).size !== lessonIds.length) push('duplicate lesson ids across journey');
}

/** Legacy bundle validation. Used at author-save (block writes) and on live
 *  fetch / cache read (reject an invalid doc → keep the current bundle). */
export function validateContent(bundle: ContentBundle): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  validateBundleShape(bundle, (m) => errors.push(m));
  return { ok: errors.length === 0, errors };
}

/** Course validation: structural bundle checks (via a Course→ContentBundle
 *  projection) + gate/final-boss reference checks. */
export function validateCourse(course: Course): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  validateBundleShape({ pool: course.pool, units: course.units }, push);

  const unitIds = new Set(course.units.map((u) => u.id));
  const reviewBosses = [...course.gates, ...(course.finalBoss ? [course.finalBoss] : [])];
  for (const b of reviewBosses) {
    for (const uid of b.reviewsUnitIds ?? []) {
      if (!unitIds.has(uid)) push(`boss ${b.id} reviews unknown unit ${uid}`);
    }
    for (const pid of b.pinnedItemIds ?? []) {
      if (!course.pool[pid]) push(`boss ${b.id} pins unknown item ${pid}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
