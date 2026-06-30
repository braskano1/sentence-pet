import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import { downloadWorkbook } from './downloadWorkbook';

const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;

describe('downloadWorkbook', () => {
  beforeEach(() => {
    // jsdom lacks these — stub them.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:fake');
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = origRevoke;
  });

  it('serializes the workbook, clicks an anchor, and revokes the url', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id'], ['x']]), 'Items');

    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = click;
      return el;
    });

    downloadWorkbook(wb, 'items-template.xlsx');

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    spy.mockRestore();
  });
});
