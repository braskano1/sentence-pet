import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course } from '../../content/course';
import { parseWorkbookToCourse } from '../../content/excelImport';
import { validateCourse } from '../../content/validate';

/** Default reader: File → SheetJS WorkBook. Injectable for tests. */
async function defaultReadWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

export function ImportTab({ onCommit, readWorkbook = defaultReadWorkbook }: {
  onCommit: (c: Course) => void;
  readWorkbook?: (file: File) => Promise<XLSX.WorkBook>;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFile(file: File) {
    const wb = await readWorkbook(file);
    const { course: parsed, errors: parseErrors } = parseWorkbookToCourse(wb);
    const validation = parsed ? validateCourse(parsed) : { ok: false, errors: [] };
    setCourse(parsed);
    setErrors([...parseErrors, ...validation.errors]);
  }

  const canCommit = course !== null && errors.length === 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label>Excel file (.xlsx)
        <input type="file" accept=".xlsx" aria-label="excel file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      </label>

      {errors.length > 0 && (
        <ul aria-live="polite" className="rounded bg-red-50 p-2 text-red-700">
          {errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      {course && (
        <div className="rounded border p-2">
          <p className="font-semibold">{course.emoji} {course.title} <span className="text-slate-400">({course.id})</span></p>
          <ul>
            {course.units.map((u) => (
              <li key={u.id}>{u.emoji} {u.title} — {u.lessons.reduce((n, l) => n + l.itemIds.length, 0)} items</li>
            ))}
          </ul>
          <p>Gates: {course.gates.length} · Final boss: {course.finalBoss ? course.finalBoss.boss.name : 'none'}</p>
        </div>
      )}

      <button type="button" disabled={!canCommit} onClick={() => course && onCommit(course)}
        className="self-start rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">Commit import</button>
    </div>
  );
}
