import * as XLSX from 'xlsx';

/** Serialize a workbook to .xlsx and trigger a browser download. The app's first xlsx WRITE. */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
