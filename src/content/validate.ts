import type { ContentBundle } from './model';

/** Validate a bundle's structural invariants. Used at author-save (block writes)
 *  and on live fetch (reject an invalid live doc → keep the current bundle). */
export function validateContent(bundle: ContentBundle): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

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
        if (item.answer.length !== item.slots.length) push(`item ${itemId} answer/slots length mismatch`);
        for (const trap of item.traps ?? []) {
          if (trap.slot < 0 || trap.slot >= item.slots.length) push(`item ${itemId} trap slot out of range`);
        }
      }
    }
  }

  if (new Set(lessonIds).size !== lessonIds.length) push('duplicate lesson ids across journey');

  return { ok: errors.length === 0, errors };
}
