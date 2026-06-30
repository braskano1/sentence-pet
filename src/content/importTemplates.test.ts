import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { SURFACE_TEMPLATES, COURSE_WORKBOOK_SURFACES, buildWorkbook } from './importTemplates';
import { importItems, importBosses, importUnits } from './surfaceImport';
import { importPets } from './petImport';
import { parseWorkbookToCourse } from './excelImport';
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
});
