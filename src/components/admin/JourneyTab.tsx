import { useState } from 'react';
import type { Course } from '../../content/course';
import type { Lesson, Unit } from '../../content/model';
import type { ContentItem, ContentKind } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { Field, TextInput, NumberInput, Select, Checkbox } from './ui';

/** Pool item ids whose kind matches a node's kind — the items admins may assign to it. */
export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}

export function JourneyTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    course.units[0]?.lessons[0]?.id ?? null,
  );

  function setUnits(units: Unit[]) { onChange({ ...course, units }); }

  function patchUnit(unitId: string, patch: Partial<Unit>) {
    setUnits(course.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  }

  function patchLesson(unitId: string, lessonId: string, patch: Partial<Lesson>) {
    setUnits(course.units.map((u) => u.id !== unitId ? u : {
      ...u, lessons: u.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    }));
  }

  function toggleItem(unitId: string, lesson: Lesson, itemId: string) {
    const itemIds = lesson.itemIds.includes(itemId)
      ? lesson.itemIds.filter((id) => id !== itemId)
      : [...lesson.itemIds, itemId];
    patchLesson(unitId, lesson.id, { itemIds });
  }

  const selected = course.units.flatMap((u) => u.lessons.map((l) => ({ u, l })))
    .find(({ l }) => l.id === selectedLessonId);

  return (
    <div className="flex gap-4 text-sm">
      <div className="flex w-56 flex-col gap-3">
        {course.units.map((unit) => (
          <div key={unit.id} className="rounded-lg border border-slate-200 p-2">
            <TextInput aria-label={`unit ${unit.id} title`} className="w-full font-semibold" value={unit.title}
              onChange={(e) => patchUnit(unit.id, { title: e.target.value })} />
            <TextInput aria-label="emoji" className="mt-1 w-16" value={unit.emoji}
              onChange={(e) => patchUnit(unit.id, { emoji: e.target.value })} />
            <div className="mt-2 flex flex-col gap-0.5">
              {unit.lessons.map((l) => (
                <button key={l.id} type="button" onClick={() => setSelectedLessonId(l.id)}
                  className={`rounded px-1 text-left ${l.id === selectedLessonId ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-50'}`}>
                  {l.id}{l.isCheckpoint ? ' ★' : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {selected && (
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-slate-800">Lesson: {selected.l.id}</p>
            <Field label="kind">
              <Select value={selected.l.kind ?? 'dragdrop'}
                onChange={(e) => {
                  const kind = e.target.value as ContentKind;
                  patchLesson(selected.u.id, selected.l.id, {
                    kind,
                    itemIds: selected.l.itemIds.filter((id) => course.pool[id]?.kind === kind),
                  });
                }}>
                {['flashcard', 'matching', 'dragdrop', 'fillblank'].map((k) => <option key={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="drill">
              <Select value={selected.l.drill}
                onChange={(e) => patchLesson(selected.u.id, selected.l.id, { drill: e.target.value as Lesson['drill'] })}>
                {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="level">
              <NumberInput value={selected.l.level}
                onValueChange={(n) => { if (n !== null) patchLesson(selected.u.id, selected.l.id, { level: n }); }} />
            </Field>
            <Checkbox label="checkpoint" checked={!!selected.l.isCheckpoint}
              onChange={(e) => patchLesson(selected.u.id, selected.l.id, { isCheckpoint: e.target.checked })} />
            <Checkbox label="L1 enabled (TH/ENG toggle)" checked={!!selected.u.l1Enabled}
              onChange={(e) => patchUnit(selected.u.id, { l1Enabled: e.target.checked })} />
            <p className="mt-2 font-semibold text-slate-800">Items in lesson</p>
            <div className="flex flex-col gap-1">
              {eligibleItemIds(course.pool, selected.l.kind ?? 'dragdrop').map((id) => {
                const it = course.pool[id];
                const meta = `${isDragDrop(it) ? it.drill : it.kind}·${it.level}`;
                return (
                  <Checkbox key={id} aria-label={`item ${id}`} label={`${id} (${meta})`}
                    checked={selected.l.itemIds.includes(id)}
                    onChange={() => toggleItem(selected.u.id, selected.l, id)} />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
