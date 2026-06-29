import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course } from '../../content/course';
import { parseWorkbookToCourse } from '../../content/excelImport';
import { validateCourse } from '../../content/validate';
import { getActivePetDefs } from '../../domain/petDef';
import { Card, Field, Button, ValidationSummary } from './ui';

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
    try {
      const wb = await readWorkbook(file);
      const { course: parsed, errors: parseErrors } = parseWorkbookToCourse(wb);
      const validation = parsed
        ? validateCourse(parsed, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) })
        : { ok: false, errors: [] };
      setCourse(parsed);
      setErrors([...parseErrors, ...validation.errors]);
    } catch (err) {
      setCourse(null);
      setErrors([`Could not read file: ${err instanceof Error ? err.message : String(err)}`]);
    }
  }

  const canCommit = course !== null && errors.length === 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Field label="Excel file (.xlsx)">
        <input type="file" accept=".xlsx"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      </Field>

      <ValidationSummary errors={errors} />

      {course && (
        <Card>
          <p className="font-semibold text-slate-800">{course.emoji} {course.title} <span className="text-slate-400">({course.id})</span></p>
          <ul className="mt-1">
            {course.units.map((u) => (
              <li key={u.id}>{u.emoji} {u.title} — {u.lessons.reduce((n, l) => n + l.itemIds.length, 0)} items</li>
            ))}
          </ul>
          <p className="mt-1">Gates: {course.gates.length} · Final boss: {course.finalBoss ? course.finalBoss.boss.name : 'none'}</p>
        </Card>
      )}

      <Button className="self-start" disabled={!canCommit} onClick={() => course && onCommit(course)}>Commit import</Button>
    </div>
  );
}
