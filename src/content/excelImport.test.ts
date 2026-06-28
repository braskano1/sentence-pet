import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookToCourse } from './excelImport';

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
});
