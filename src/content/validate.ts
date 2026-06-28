import type { ContentBundle } from './model';
import type { Course } from './course';
import type { ContentItem, PetDef, Rarity } from '../data/types';
import { SPECIES } from '../domain/species';

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
  const reviewBosses = [
    ...course.gates.map((b) => ({ b, isFinal: false })),
    ...(course.finalBoss ? [{ b: course.finalBoss, isFinal: true }] : []),
  ];
  for (const { b, isFinal } of reviewBosses) {
    // Existing reference checks.
    for (const uid of b.reviewsUnitIds ?? []) {
      if (!unitIds.has(uid)) push(`boss ${b.id} reviews unknown unit ${uid}`);
    }
    for (const pid of b.pinnedItemIds ?? []) {
      if (!course.pool[pid]) push(`boss ${b.id} pins unknown item ${pid}`);
    }
    // Review bosses must actually review something.
    if (!b.reviewsUnitIds || b.reviewsUnitIds.length === 0) push(`boss ${b.id} reviews no units`);
    if (b.reviewCount !== undefined && b.reviewCount < 1) push(`boss ${b.id} reviewCount must be >= 1`);
    // Scope-specific structure.
    if (isFinal) {
      if (b.scope !== 'final') push(`final boss ${b.id} must have scope 'final'`);
      if (b.onClear !== 'completeCourse') push(`final boss ${b.id} must set onClear 'completeCourse'`);
    } else {
      if (b.scope !== 'gated') push(`gate ${b.id} must have scope 'gated'`);
      if (!b.afterUnitId) push(`gate ${b.id} missing afterUnitId`);
      else if (!unitIds.has(b.afterUnitId)) push(`gate ${b.id} afterUnitId ${b.afterUnitId} is unknown`);
    }
  }

  // P3b: every course must carry a final boss (safe — bundleToDefaultCourse synthesizes one).
  if (!course.finalBoss) push(`course ${course.id} has no final boss`);

  // P3b: two gates after the same unit both resolve to order N+0.5 (a tie the resolver can't place).
  const afterIds = course.gates.map((g) => g.afterUnitId).filter((x): x is string => !!x);
  if (new Set(afterIds).size !== afterIds.length) push('duplicate gate afterUnitId');

  return { ok: errors.length === 0, errors };
}

const RARITY_KEYS: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const PETDEF_STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luk'] as const;

/** Structural validation for the pet-def catalog. Mirrors validateCourse's gate-before-save discipline. */
export function validatePetDefs(defs: PetDef[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const push = (m: string) => errors.push(m);

  const ids = defs.map((d) => d.id);
  if (new Set(ids).size !== ids.length) push('duplicate pet-def ids');

  for (const d of defs) {
    if (!d.id || d.id.trim() === '') push('pet-def has empty id');
    if (!d.name || d.name.trim() === '') push(`pet-def ${d.id} name is empty`);
    if (!SPECIES.includes(d.element)) push(`pet-def ${d.id} element ${String(d.element)} is not one of the fixed four`);
    for (const r of RARITY_KEYS) {
      const band = d.statBands?.[r];
      if (!band) { push(`pet-def ${d.id} missing stat bands for rarity ${r}`); continue; }
      for (const stat of PETDEF_STAT_KEYS) {
        const range = band[stat];
        if (!range) { push(`pet-def ${d.id} ${r}.${stat} band missing`); continue; }
        const [min, max] = range;
        if (typeof min !== 'number' || typeof max !== 'number') push(`pet-def ${d.id} ${r}.${stat} band not numeric`);
        else if (min > max) push(`pet-def ${d.id} ${r}.${stat} band min > max`);
        else if (min < 0) push(`pet-def ${d.id} ${r}.${stat} band min < 0`);
      }
    }
  }

  const starters = defs.filter((d) => d.starter).length;
  if (starters !== 1) push(`expected exactly one starter pet-def, found ${starters}`);
  if (!defs.some((d) => d.enabled)) push('no pet-def is enabled');

  return { ok: errors.length === 0, errors };
}
