import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { ImportTab } from './ImportTab';

function validBook(): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  add('Course', [['id', 'title', 'emoji'], ['c1', 'Course One', '📘']]);
  add('Units', [['id', 'title', 'emoji', 'order', 'l1Enabled'], ['u1', 'Unit One', '🐣', 1, false]]);
  add('Items', [['id', 'kind', 'level', 'unit', 'node', 'thaiHint', 'variant', 'slots', 'answer'],
    ['d1', 'dragdrop', 1, 'u1', 'u1-n1', 'ฉันวิ่ง', 'pattern', 'Pronoun,Verb', 'I,run']]);
  add('Bosses', [['id', 'scope', 'reviewsUnits', 'reviewCount', 'pinnedItemIds'], ['f', 'final', 'u1', 6, 'd1']]);
  return book;
}

describe('ImportTab', () => {
  it('previews a valid workbook and commits it', async () => {
    const onCommit = vi.fn();
    render(<ImportTab onCommit={onCommit} readWorkbook={async () => validBook()} />);
    fireEvent.change(screen.getByLabelText(/excel file/i), { target: { files: [new File([''], 'c.xlsx')] } });
    await screen.findByText(/Unit One/);
    const commit = screen.getByRole('button', { name: /commit/i });
    expect(commit).not.toBeDisabled();
    fireEvent.click(commit);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].id).toBe('c1');
  });

  it('blocks commit and shows errors for an invalid workbook', async () => {
    const onCommit = vi.fn();
    const book = validBook();
    delete book.Sheets.Bosses; // no final boss → validateCourse fails
    book.SheetNames = book.SheetNames.filter((n) => n !== 'Bosses');
    render(<ImportTab onCommit={onCommit} readWorkbook={async () => book} />);
    fireEvent.change(screen.getByLabelText(/excel file/i), { target: { files: [new File([''], 'c.xlsx')] } });
    await screen.findByText(/missing required sheet/i);
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled();
  });

  it('shows a friendly error when the reader throws', async () => {
    const onCommit = vi.fn();
    render(<ImportTab onCommit={onCommit} readWorkbook={async () => { throw new Error('not an xlsx'); }} />);
    fireEvent.change(screen.getByLabelText(/excel file/i), { target: { files: [new File(['garbage'], 'bad.xlsx')] } });
    await screen.findByText(/could not read file/i);
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled();
  });
});
