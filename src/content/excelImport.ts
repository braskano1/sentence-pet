import * as XLSX from 'xlsx';
import type { Course, BossNode } from './course';
import type { Unit, Lesson, CheckpointBoss } from './model';
import type { ContentItem, ContentKind, DragDropItem, PosLabel, Species, PetStage } from '../data/types';

// xlsx@0.18.5 has published prototype-pollution + ReDoS advisories that apply only to
// untrusted input. This parser runs admin-only, post-auth (see ImportDrawer call sites), so
// neither is reachable here. Revisit if the import surface ever accepts pre-auth files.

type Row = Record<string, unknown>;

const REQUIRED_SHEETS = ['Course', 'Units', 'Items', 'Bosses'] as const;

function sheetRows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  return ws ? (XLSX.utils.sheet_to_json(ws, { defval: '' }) as Row[]) : [];
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim();
const num = (v: unknown): number => Number(v);
const bool = (v: unknown): boolean => v === true || str(v).toLowerCase() === 'true';
const csv = (v: unknown): string[] =>
  str(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Raw course slices parsed from whatever sheets a workbook contains. Tolerant:
 *  a missing sheet yields an empty slice, not an error. Pure: no IO, no validation. */
export interface WorkbookSlices {
  pool: Record<string, ContentItem>;
  units: Unit[];
  gates: BossNode[];
  finalBoss?: BossNode;
  errors: string[];
}

/** Parse every sheet present in `wb` into its slice. Sheets that are absent are skipped. */
export function parseWorkbookSlices(wb: XLSX.WorkBook): WorkbookSlices {
  const errors: string[] = [];
  const hasUnitsSheet = wb.SheetNames.includes('Units');

  // ── Units ────────────────────────────────────────────────────────────────
  const units: Unit[] = [];
  sheetRows(wb, 'Units').forEach((r, i) => {
    const id = str(r.id);
    if (!id) {
      errors.push(`Units row ${i + 2}: id is required`);
      return;
    }
    units.push({
      id,
      title: str(r.title),
      emoji: str(r.emoji),
      order: num(r.order) || i + 1,
      l1Enabled: bool(r.l1Enabled),
      lessons: [],
    });
  });

  // ── Items → pool + node grouping ─────────────────────────────────────────
  // Each row's `node` column groups items into a Lesson within a unit.
  const pool: Record<string, ContentItem> = {};
  const nodeItems = new Map<string, { unit: string; kind: ContentKind; level: number; ids: string[] }>();

  sheetRows(wb, 'Items').forEach((r, i) => {
    const id = str(r.id);
    const kind = str(r.kind) as ContentKind;
    if (!id) {
      errors.push(`Items row ${i + 2}: id is required`);
      return;
    }
    const level = num(r.level) || 1;
    const l1th = str(r.l1_th);
    const l1 = l1th ? { l1: { th: l1th } } : {};

    let item: ContentItem | null = null;

    switch (kind) {
      case 'dragdrop': {
        const drillVal = str(r.variant) || 'pattern';
        const ddItem: DragDropItem = {
          id,
          kind: 'dragdrop',
          level,
          thaiHint: str(r.thaiHint),
          drill: drillVal as DragDropItem['drill'],
          slots: csv(r.slots) as PosLabel[],
          answer: csv(r.answer),
        };
        const distractors = csv(r.distractors);
        if (distractors.length) ddItem.distractors = distractors;
        if (bool(r.hidePos)) ddItem.hidePos = true;
        if (str(r.punct) === '?') ddItem.endPunct = '?';
        item = ddItem;
        break;
      }
      case 'flashcard':
        item = {
          id,
          kind: 'flashcard',
          level,
          ...l1,
          front: str(r.front),
          back: str(r.back),
          ...(str(r.audio) ? { audio: str(r.audio) } : {}),
          ...(str(r.image) ? { image: str(r.image) } : {}),
          ...(str(r.image) && str(r.imageCaption).toLowerCase() === 'false' ? { imageCaption: false } : {}),
        };
        break;
      case 'fillblank': {
        const alternates = csv(r.alternates);
        item = {
          id,
          kind: 'fillblank',
          level,
          ...l1,
          template: str(r.template),
          answer: str(r.answer),
          ...(alternates.length ? { alternates } : {}),
        };
        break;
      }
      case 'matching': {
        const pairs = Object.keys(r)
          .filter((k) => /^pair\d+$/.test(k))
          .map((k) => str(r[k]))
          .filter(Boolean)
          .map((cell) => {
            const [left, right, th, ...rest] = cell.split('|');
            // Segments 3+ are `key=value` (images/captions). Split on the FIRST
            // `=` so urls containing `=` survive; segments without `=` are ignored.
            const kv: Record<string, string> = {};
            for (const seg of rest) {
              const eq = seg.indexOf('=');
              if (eq === -1) continue;
              kv[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
            }
            return {
              left: str(left),
              right: str(right),
              ...(str(th) ? { l1: { th: str(th) } } : {}),
              ...(kv.li ? { leftImage: kv.li } : {}),
              ...(kv.ri ? { rightImage: kv.ri } : {}),
              ...(kv.li && kv.lc?.toLowerCase() === 'false' ? { leftImageCaption: false } : {}),
              ...(kv.ri && kv.rc?.toLowerCase() === 'false' ? { rightImageCaption: false } : {}),
            };
          });
        item = { id, kind: 'matching', level, ...l1, pairs };
        break;
      }
      default:
        errors.push(`Items row ${i + 2}: unknown kind "${str(r.kind)}"`);
        return;
    }

    if (pool[id]) { errors.push(`Items row ${i + 2}: duplicate id "${id}"`); return; }
    pool[id] = item;
    const nodeId = str(r.node) || `${str(r.unit)}-${kind}`;
    const grp = nodeItems.get(nodeId) ?? { unit: str(r.unit), kind, level, ids: [] };
    if (nodeItems.has(nodeId) && grp.unit !== str(r.unit)) {
      errors.push(`Items row ${i + 2}: node "${nodeId}" spans units "${grp.unit}" and "${str(r.unit)}"`);
      return;
    }
    grp.ids.push(id);
    nodeItems.set(nodeId, grp);
  });

  // ── Attach lessons to units ───────────────────────────────────────────────
  // One Lesson per node group; last node per unit becomes the checkpoint.
  for (const [nodeId, grp] of nodeItems) {
    const unit = units.find((u) => u.id === grp.unit);
    // Tolerant: an Items-only workbook (no Units sheet) just doesn't attach lessons.
    // But when a Units sheet IS present, an item referencing a missing unit is an error.
    if (!unit) {
      if (hasUnitsSheet) errors.push(`Items node ${nodeId}: unknown unit "${grp.unit}"`);
      continue;
    }
    const lesson: Lesson = {
      id: nodeId,
      kind: grp.kind,
      drill: 'pattern',
      level: grp.level,
      itemIds: grp.ids,
    };
    unit.lessons.push(lesson);
  }
  for (const unit of units) {
    if (unit.lessons.length) unit.lessons[unit.lessons.length - 1].isCheckpoint = true;
  }

  // ── Bosses → gates + finalBoss ────────────────────────────────────────────
  const gates: BossNode[] = [];
  let finalBoss: BossNode | undefined;

  const bossCfg = (): CheckpointBoss => ({
    tierId: 'tier-1',
    element: 'leaf' as Species,
    name: 'Boss',
    rivalSprite: { species: 'leaf' as Species, stage: 'adult' as Exclude<PetStage, 'egg'> },
  });

  sheetRows(wb, 'Bosses').forEach((r, i) => {
    const id = str(r.id);
    const scope = str(r.scope);
    if (!id) {
      errors.push(`Bosses row ${i + 2}: id is required`);
      return;
    }
    const reviewsUnits = csv(r.reviewsUnits);
    const pinnedItemIds = csv(r.pinnedItemIds);
    const reviewCountVal = num(r.reviewCount);

    const common = {
      id,
      title: id,
      ...(reviewsUnits.length ? { reviewsUnitIds: reviewsUnits } : {}),
      ...(reviewCountVal ? { reviewCount: reviewCountVal } : {}),
      ...(pinnedItemIds.length ? { pinnedItemIds } : {}),
      ...(str(r.rewardPetDefId) ? { rewardPetDefId: str(r.rewardPetDefId) } : {}),
      boss: bossCfg(),
    };

    if (scope === 'final') {
      finalBoss = { ...common, scope: 'final', onClear: 'completeCourse' };
    } else if (scope === 'gated') {
      const afterUnitId = str(r.afterUnit);
      if (!afterUnitId) errors.push(`Bosses row ${i + 2}: gated boss requires afterUnit`);
      gates.push({ ...common, scope: 'gated', afterUnitId });
    } else {
      errors.push(`Bosses row ${i + 2}: unknown scope "${scope}"`);
    }
  });

  return { pool, units, gates, finalBoss, errors };
}

/** Parse a SheetJS workbook into a Course. Pure: no IO, no validation side effects.
 *  Returns { course: null } when a required sheet is missing or the Course row is fatal. */
export function parseWorkbookToCourse(wb: XLSX.WorkBook): { course: Course | null; errors: string[] } {
  const errors: string[] = [];

  for (const s of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(s)) errors.push(`missing required sheet "${s}"`);
  }
  if (errors.length) return { course: null, errors };

  const courseRow = sheetRows(wb, 'Course')[0];
  if (!courseRow || !str(courseRow.id)) {
    errors.push('Course row 2: id is required');
    return { course: null, errors };
  }

  const slices = parseWorkbookSlices(wb);

  const course: Course = {
    id: str(courseRow.id),
    title: str(courseRow.title),
    ...(str(courseRow.emoji) ? { emoji: str(courseRow.emoji) } : {}),
    ...(courseRow.l1Ready !== '' ? { l1Ready: bool(courseRow.l1Ready) } : {}),
    pool: slices.pool,
    units: slices.units,
    gates: slices.gates,
    ...(slices.finalBoss ? { finalBoss: slices.finalBoss } : {}),
  };

  return { course, errors: [...errors, ...slices.errors] };
}
