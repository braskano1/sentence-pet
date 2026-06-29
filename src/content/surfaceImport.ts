import type * as XLSX from 'xlsx';
import type { ContentItem } from '../data/types';
import type { Unit } from './model';
import type { BossNode } from './course';
import { parseWorkbookSlices } from './excelImport';

export interface SurfaceImport<T> {
  entities: T[];
  errors: string[];
}

/** Pool items from an Items sheet (other sheets ignored). */
export function importItems(wb: XLSX.WorkBook): SurfaceImport<ContentItem> {
  const slices = parseWorkbookSlices(wb);
  const entities = Object.values(slices.pool);
  if (entities.length === 0) {
    return { entities, errors: ['No item rows found — the file needs an "Items" sheet.'] };
  }
  return { entities, errors: [...slices.errors] };
}

/** Boss nodes (gates then finalBoss) from a Bosses sheet. */
export function importBosses(wb: XLSX.WorkBook): SurfaceImport<BossNode> {
  const slices = parseWorkbookSlices(wb);
  const entities = [...slices.gates, ...(slices.finalBoss ? [slices.finalBoss] : [])];
  if (entities.length === 0) {
    // No boss entities: suppress unrelated sheet errors and emit a surface-specific message.
    return { entities, errors: ['No boss rows found — the file needs a "Bosses" sheet.'] };
  }
  return { entities, errors: [...slices.errors] };
}

/** Units (with lessons derived from any Items sheet) from a Units sheet. */
export function importUnits(wb: XLSX.WorkBook): SurfaceImport<Unit> {
  const slices = parseWorkbookSlices(wb);
  const entities = slices.units;
  if (entities.length === 0) {
    return { entities, errors: ['No unit rows found — the file needs a "Units" sheet.'] };
  }
  return { entities, errors: [...slices.errors] };
}
