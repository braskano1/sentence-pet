import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Course, CourseIndexEntry } from '../../content/course';
import { parseWorkbookToCourse } from '../../content/excelImport';
import { SearchableList, Field, TextInput, Button, SectionLabel } from './ui';
import { courseCounts } from './coursesTab/courseCounts';

async function defaultReadWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

export function CoursesTab({
  course,
  onChange,
  index,
  onCreate,
  onDelete,
  onSwitch,
  onImport,
  readWorkbook = defaultReadWorkbook,
}: {
  course: Course;                                    // the active (draft) course
  onChange: (c: Course) => void;                     // edit active course meta
  index: readonly CourseIndexEntry[];                // all courses
  onCreate: (meta: { title: string }) => void;
  onDelete: (id: string) => void;
  onSwitch: (id: string) => void;
  onImport: (c: Course) => void;                     // whole-course xlsx commit
  readWorkbook?: (file: File) => Promise<XLSX.WorkBook>;
}) {
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const counts = courseCounts(course);

  async function onFile(file: File) {
    try {
      const wb = await readWorkbook(file);
      const { course: parsed } = parseWorkbookToCourse(wb);
      if (parsed) onImport(parsed);
    } catch {
      // P2: surfacing import parse/read errors in this surface is deferred to P5.
      // Swallow here so a bad file does not throw an unhandled rejection.
    }
  }

  return (
    <div className="flex gap-6">
      <SearchableList
        items={index}
        total={index.length}
        countNoun="course"
        getKey={(c) => c.id}
        selectedKey={course.id}
        onSelect={(id) => { if (id !== course.id) onSwitch(id); }}
        searchText={(c) => `${c.title} ${c.id}`}
        query={query}
        onQuery={setQuery}
        placeholder="Search courses..."
        renderRow={(c) => (
          <span className="flex items-center gap-2">
            {c.emoji && <span aria-hidden>{c.emoji}</span>}
            <span className="flex-1">{c.title}</span>
            {c.id === course.id && (
              <span className="text-xs font-semibold uppercase text-indigo-600">editing</span>
            )}
          </span>
        )}
        footer={
          <div className="flex flex-col gap-2">
            {creating ? (
              <div className="flex flex-col gap-2">
                <Field label="New course title">
                  <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={!newTitle.trim()}
                    onClick={() => { onCreate({ title: newTitle.trim() }); setCreating(false); setNewTitle(''); }}>
                    Create
                  </Button>
                  <Button variant="ghost" onClick={() => { setCreating(false); setNewTitle(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" onClick={() => setCreating(true)}>+ New course</Button>
            )}
            <label className="cursor-pointer text-sm text-indigo-600 hover:underline">
              ⬇ New from file...
              <input type="file" accept=".xlsx" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            </label>
          </div>
        }
      />

      <div className="flex-1">
        <SectionLabel>Course</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Title"><TextInput value={course.title} onChange={(e) => onChange({ ...course, title: e.target.value })} /></Field>
          <Field label="Emoji"><TextInput value={course.emoji ?? ''} onChange={(e) => onChange({ ...course, emoji: e.target.value })} /></Field>
          <Field label="Course id"><TextInput value={course.id} readOnly /></Field>
        </div>

        <SectionLabel>Contents</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Units" value={counts.units} />
          <Stat label="Lessons" value={counts.lessons} />
          <Stat label="Items" value={counts.items} />
          <Stat label="Bosses" value={counts.bosses} />
        </div>

        <SectionLabel>Manage</SectionLabel>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-700">Delete this course.</p>
          <p className="text-red-600">Removes all course content. Pets are unaffected. Cannot be undone.</p>
          {confirming ? (
            <div className="mt-2 flex gap-2">
              <Button variant="danger" onClick={() => onDelete(course.id)}>Confirm delete</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          ) : (
            <Button className="mt-2" variant="danger" onClick={() => setConfirming(true)}>Delete course</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-2xl font-bold tabular-nums text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
