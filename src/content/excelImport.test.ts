import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookToCourse, parseWorkbookSlices } from './excelImport';

/** Build a WorkBook from a map of sheetName → array-of-arrays (first row = headers). */
function wb(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

function validBook(): XLSX.WorkBook {
  return wb({
    Course: [['id', 'title', 'emoji', 'l1Ready'], ['c1', 'Course One', '📘', true]],
    Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]],
    Items: [
      ['id', 'kind', 'level', 'unit', 'node', 'l1_th', 'front', 'back', 'audio', 'template', 'answer', 'alternates', 'variant', 'slots', 'distractors', 'hidePos', 'thaiHint'],
      ['d1', 'dragdrop', 1, 'u1', 'u1-n1', '', '', '', '', '', 'I,run', '', 'pattern', 'Pronoun,Verb', '', false, 'ฉันวิ่ง'],
      ['c1card', 'flashcard', 1, 'u1', 'u1-n1', 'แมว', 'cat', 'แมว', '', '', '', '', '', '', '', '', ''],
    ],
    Bosses: [
      ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'],
      ['final-1', 'final', '', 'u1', 6, 'd1'],
    ],
  });
}

describe('parseWorkbookToCourse', () => {
  it('parses a valid workbook into a Course with no errors', () => {
    const { course, errors } = parseWorkbookToCourse(validBook());
    expect(errors).toEqual([]);
    expect(course).not.toBeNull();
    expect(course!.id).toBe('c1');
    expect(course!.units).toHaveLength(1);
    expect(Object.keys(course!.pool)).toContain('d1');
    expect(course!.finalBoss?.scope).toBe('final');
  });

  it('reports a missing required sheet with its name', () => {
    const book = validBook();
    delete book.Sheets.Units;
    book.SheetNames = book.SheetNames.filter((n) => n !== 'Units');
    const { course, errors } = parseWorkbookToCourse(book);
    expect(course).toBeNull();
    expect(errors.join()).toMatch(/Units/);
  });

  it('reports a malformed Items row with sheet + row number', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [['id', 'kind', 'level', 'unit', 'node'], ['', 'dragdrop', 1, 'u1', 'u1-n1']], // empty id
      Bosses: [['id', 'scope', 'reviewsUnits', 'reviewCount'], ['f', 'final', 'u1', 6]],
    });
    const { errors } = parseWorkbookToCourse(book);
    expect(errors.some((e) => /Items/.test(e) && /row 2/.test(e))).toBe(true);
  });

  it('keeps thaiHint on dragdrop items (required field)', () => {
    const { course } = parseWorkbookToCourse(validBook());
    const d1 = course!.pool.d1;
    expect(d1.kind).toBe('dragdrop');
    if (d1.kind === 'dragdrop') expect(d1.thaiHint).toBe('ฉันวิ่ง');
  });

  it('sets onClear on finalBoss and omits it on gated bosses', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'slots', 'answer'],
              ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'hint', 'Verb', 'run']],
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount'],
        ['gate-1', 'gated', 'u1', 'u1', 3],
        ['final-1', 'final', '', 'u1', 6],
      ],
    });
    const { course } = parseWorkbookToCourse(book);
    expect(course!.finalBoss?.onClear).toBe('completeCourse');
    expect(course!.gates[0]).not.toHaveProperty('onClear');
    expect(course!.gates[0].afterUnitId).toBe('u1');
    expect(course!.gates[0].scope).toBe('gated');
  });

  it('marks only the last lesson per unit as isCheckpoint', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'slots', 'answer'],
        ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'hint', 'Verb', 'run'],
        ['d2', 'dragdrop', 1, 'u1', 'u1-n2', 'hint', 'Verb', 'walk'],
      ],
      Bosses: [['id', 'scope', 'reviewsUnits', 'reviewCount'], ['f1', 'final', 'u1', 6]],
    });
    const { course } = parseWorkbookToCourse(book);
    const lessons = course!.units[0].lessons;
    expect(lessons).toHaveLength(2);
    expect(lessons[0].isCheckpoint).toBeUndefined();
    expect(lessons[1].isCheckpoint).toBe(true);
  });

  it('reports duplicate item ids', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'slots', 'answer'],
        ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'hint', 'Verb', 'run'],
        ['d1', 'dragdrop', 1, 'u1', 'u1-n2', 'hint', 'Verb', 'walk'],
      ],
      Bosses: [['id', 'scope', 'reviewsUnits', 'reviewCount'], ['f1', 'final', 'u1', 6]],
    });
    const { errors } = parseWorkbookToCourse(book);
    expect(errors.some((e) => /duplicate id/.test(e))).toBe(true);
  });

  it('reports a node id that spans two units', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U1', '🐣', 1, false], ['u2', 'U2', '🌱', 2, false]],
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'slots', 'answer'],
        ['d1', 'dragdrop', 1, 'u1', 'shared', 'hint', 'Verb', 'run'],
        ['d2', 'dragdrop', 1, 'u2', 'shared', 'hint', 'Verb', 'walk'],
      ],
      Bosses: [['id', 'scope', 'reviewsUnits', 'reviewCount'], ['f1', 'final', 'u1', 6]],
    });
    const { errors } = parseWorkbookToCourse(book);
    expect(errors.some((e) => /spans units/.test(e))).toBe(true);
  });

  it('parses rewardPetDefId from a Bosses row (blank omits it)', () => {
    const book = wb({
      Course: [['id', 'title'], ['c1', 'C']],
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'U', '🐣', 1, false]],
      Items: [['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'slots', 'answer'],
              ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'hint', 'Verb', 'run']],
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'rewardPetDefId'],
        ['gate-1', 'gated', 'u1', 'u1', 3, ''],
        ['final-1', 'final', '', 'u1', 6, 'leaf-1'],
      ],
    });
    const { course } = parseWorkbookToCourse(book);
    expect(course!.finalBoss!.rewardPetDefId).toBe('leaf-1');
    expect(course!.gates[0].rewardPetDefId).toBeUndefined();
  });
});

function bookWith(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

describe('parseWorkbookSlices (tolerant)', () => {
  it('parses an Items-only workbook into pool, ignoring absent sheets', () => {
    const wb = bookWith({
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'variant', 'slots', 'answer'],
        ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'ฉันวิ่ง', 'pattern', 'Pronoun,Verb', 'I,run'],
      ],
    });
    const slices = parseWorkbookSlices(wb);
    expect(Object.keys(slices.pool)).toEqual(['d1']);
    expect(slices.units).toEqual([]);
    expect(slices.gates).toEqual([]);
    expect(slices.finalBoss).toBeUndefined();
    expect(slices.errors).toEqual([]);
  });

  it('parses a Bosses-only workbook into gates + finalBoss', () => {
    const wb = bookWith({
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'],
        ['g1', 'gated', 'u1', 'u1', 4, ''],
        ['f', 'final', '', 'u1', 6, ''],
      ],
    });
    const slices = parseWorkbookSlices(wb);
    expect(slices.gates.map((g) => g.id)).toEqual(['g1']);
    expect(slices.finalBoss?.id).toBe('f');
  });

  it('parses a Units-only workbook into units (no lessons)', () => {
    const wb = bookWith({
      Units: [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]],
    });
    const slices = parseWorkbookSlices(wb);
    expect(slices.units.map((u) => u.id)).toEqual(['u1']);
    expect(slices.units[0].lessons).toEqual([]);
  });

  it('reports unknown-unit only when a Units sheet is present', () => {
    // Items reference unit "u9" which is not in the Units sheet → error
    const withUnits = bookWith({
      Units: [['id', 'title', 'order'], ['u1', 'Unit One', 1]],
      Items: [['id', 'kind', 'level', 'unit', 'node', 'front', 'back'],
        ['f1', 'flashcard', 1, 'u9', 'u9-n1', 'a', 'b']],
    });
    expect(parseWorkbookSlices(withUnits).errors.some((e) => /unknown unit/i.test(e))).toBe(true);

    // Same Items but NO Units sheet → tolerant, no unknown-unit error
    const noUnits = bookWith({
      Items: [['id', 'kind', 'level', 'unit', 'node', 'front', 'back'],
        ['f1', 'flashcard', 1, 'u9', 'u9-n1', 'a', 'b']],
    });
    expect(parseWorkbookSlices(noUnits).errors.some((e) => /unknown unit/i.test(e))).toBe(false);
  });
});
