import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { SURFACE_TEMPLATES, COURSE_WORKBOOK_SURFACES, buildWorkbook } from './importTemplates';
import { importItems, importBosses, importUnits } from './surfaceImport';
import { importPets } from './petImport';
import { parseWorkbookToCourse, parseWorkbookSlices } from './excelImport';
import { validateCourse, validatePetDefs } from './validate';
import { BUILTIN_PET_DEFS } from '../domain/petDef';
import { mergeById } from './mergeById';

describe('buildWorkbook', () => {
  it('emits one sheet per requested surface, header row = the spec columns', () => {
    const wb = buildWorkbook(['Pets']);
    expect(wb.SheetNames).toEqual(['Pets']);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Pets'], { header: 1 }) as string[][];
    expect(aoa[0]).toEqual(SURFACE_TEMPLATES.Pets.columns);
  });

  it('Items template round-trips through importItems with no errors', () => {
    expect(importItems(buildWorkbook(['Items'])).errors).toEqual([]);
  });
  it('Bosses template round-trips through importBosses with no errors', () => {
    expect(importBosses(buildWorkbook(['Bosses'])).errors).toEqual([]);
  });
  // Units without an Items sheet have lessons:[] and would fail validateCourse — structural
  // unit+item coverage lives in the 'whole-course workbook' test below.
  it('Units template round-trips through importUnits with no errors', () => {
    expect(importUnits(buildWorkbook(['Units'])).errors).toEqual([]);
  });
  it('Pets template imports + merges into a validatePetDefs-clean catalog', () => {
    const { entities, errors } = importPets(buildWorkbook(['Pets']));
    expect(errors).toEqual([]);
    const merged = mergeById([...BUILTIN_PET_DEFS], entities, (d) => d.id).merged;
    expect(validatePetDefs(merged)).toEqual({ ok: true, errors: [] });
  });

  it('whole-course workbook parses + passes validateCourse', () => {
    expect(COURSE_WORKBOOK_SURFACES).toEqual(['Course', 'Units', 'Items', 'Bosses']);
    const { course, errors } = parseWorkbookToCourse(buildWorkbook(COURSE_WORKBOOK_SURFACES));
    expect(errors).toEqual([]);
    expect(course).not.toBeNull();
    expect(validateCourse(course!)).toEqual({ ok: true, errors: [] });
  });

  it('Items template carries flashcard + matching image fields through import', () => {
    const pool = parseWorkbookSlices(buildWorkbook(['Items'])).pool;
    const card = Object.values(pool).find((i) => i.kind === 'flashcard') as { image?: string };
    expect(card.image).toBeTruthy();
    const match = Object.values(pool).find((i) => i.kind === 'matching') as {
      pairs: { leftImage?: string; leftImageCaption?: boolean }[];
    };
    expect(match.pairs[0].leftImage).toBeTruthy();
    expect(match.pairs[0].leftImageCaption).toBe(false);
  });
});
