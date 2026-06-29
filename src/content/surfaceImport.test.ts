import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { importItems, importBosses, importUnits } from './surfaceImport';

function bookWith(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

describe('surfaceImport', () => {
  it('importItems returns pool items from an Items sheet', () => {
    const wb = bookWith({
      Items: [
        ['id', 'kind', 'level', 'unit', 'node', 'front', 'back'],
        ['f1', 'flashcard', 1, 'u1', 'u1-n1', 'hello', 'สวัสดี'],
      ],
    });
    const { entities, errors } = importItems(wb);
    expect(entities.map((i) => i.id)).toEqual(['f1']);
    expect(errors).toEqual([]);
  });

  it('importItems errors when there are no item rows', () => {
    const { entities, errors } = importItems(bookWith({ Units: [['id'], ['u1']] }));
    expect(entities).toEqual([]);
    expect(errors[0]).toMatch(/no item rows/i);
  });

  it('importBosses flattens gates + finalBoss', () => {
    const wb = bookWith({
      Bosses: [
        ['id', 'scope', 'afterUnit', 'reviewCount'],
        ['g1', 'gated', 'u1', 4],
        ['f', 'final', '', 6],
      ],
    });
    const { entities } = importBosses(wb);
    expect(entities.map((n) => n.id)).toEqual(['g1', 'f']);
    expect(entities.find((n) => n.id === 'f')?.scope).toBe('final');
  });

  it('importUnits returns units', () => {
    const wb = bookWith({ Units: [['id', 'title', 'order'], ['u1', 'Unit One', 1]] });
    const { entities, errors } = importUnits(wb);
    expect(entities.map((u) => u.id)).toEqual(['u1']);
    expect(errors).toEqual([]);
  });

  it('importBosses errors on an empty bosses sheet', () => {
    const { entities, errors } = importBosses(bookWith({ Items: [['id'], ['x']] }));
    expect(entities).toEqual([]);
    expect(errors[0]).toMatch(/no boss rows/i);
  });

  it('importItems surfaces a real Items parse error instead of "no rows"', () => {
    const wb = bookWith({
      Items: [['id', 'kind', 'level'], ['x1', 'notakind', 1]],
    });
    const { entities, errors } = importItems(wb);
    expect(entities).toEqual([]);                     // unknown kind → not added to pool
    expect(errors.join(' ')).toMatch(/unknown kind/i); // real error surfaced
    expect(errors.join(' ')).not.toMatch(/no item rows/i);
  });

  it('importBosses ignores unrelated Items-sheet errors', () => {
    const wb = bookWith({
      Items: [['id', 'kind', 'level'], ['x1', 'notakind', 1]], // malformed, but irrelevant to bosses
      Bosses: [['id', 'scope', 'afterUnit', 'reviewCount'], ['g1', 'gated', 'u1', 4]],
    });
    const { entities, errors } = importBosses(wb);
    expect(entities.map((n) => n.id)).toEqual(['g1']);
    expect(errors).toEqual([]); // Items "unknown kind" noise filtered out
  });
});
