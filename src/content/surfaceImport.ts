import type * as XLSX from 'xlsx';
import type { ContentItem } from '../data/types';
import type { Unit } from './model';
import type { BossNode } from './course';
import { parseWorkbookSlices } from './excelImport';

export interface SurfaceImport<T> {
  entities: T[];
  errors: string[];
}

// parseWorkbookSlices prefixes every error with its source sheet name ("Items …",
// "Units …", "Bosses …"), so each surface adapter can surface only the errors that
// belong to its own sheet and ignore noise from unrelated sheets in the same file.
function surface<T>(entities: T[], allErrors: string[], prefix: string, emptyMsg: string): SurfaceImport<T> {
  const errors = allErrors.filter((e) => e.startsWith(prefix));
  if (entities.length === 0 && errors.length === 0) return { entities, errors: [emptyMsg] };
  return { entities, errors };
}

/** Pool items from an Items sheet (other sheets ignored). */
export function importItems(wb: XLSX.WorkBook): SurfaceImport<ContentItem> {
  const slices = parseWorkbookSlices(wb);
  return surface(Object.values(slices.pool), slices.errors, 'Items', 'No item rows found. The file needs an "Items" sheet.');
}

/** Boss nodes (gates then finalBoss) from a Bosses sheet. */
export function importBosses(wb: XLSX.WorkBook): SurfaceImport<BossNode> {
  const slices = parseWorkbookSlices(wb);
  const entities = [...slices.gates, ...(slices.finalBoss ? [slices.finalBoss] : [])];
  return surface(entities, slices.errors, 'Bosses', 'No boss rows found. The file needs a "Bosses" sheet.');
}

/** Units (with lessons derived from any Items sheet) from a Units sheet. */
export function importUnits(wb: XLSX.WorkBook): SurfaceImport<Unit> {
  const slices = parseWorkbookSlices(wb);
  return surface(slices.units, slices.errors, 'Units', 'No unit rows found. The file needs a "Units" sheet.');
}
