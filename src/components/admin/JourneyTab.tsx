import { useEffect, useState } from 'react';
import type { Course } from '../../content/course';
import type { Lesson, Unit } from '../../content/model';
import type { ContentItem, ContentKind } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { Card, Field, TextInput, NumberInput, Select, Checkbox, Button, AssignList } from './ui';
import { LessonTree } from './journeyTab/LessonTree';
import type { TreeSelection } from './journeyTab/LessonTree';

/** Pool item ids whose kind matches a node's kind — the items admins may assign to it. */
export function eligibleItemIds(pool: Record<string, ContentItem>, kind: ContentKind): string[] {
  return Object.values(pool).filter((i) => i.kind === kind).map((i) => i.id);
}

export function JourneyTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const firstUnit = course.units[0];
  const [selected, setSelected] = useState<TreeSelection | null>(
    firstUnit?.lessons[0] ? { type: 'lesson', id: firstUnit.lessons[0].id }
    : firstUnit ? { type: 'unit', id: firstUnit.id }
    : null,
  );
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [selected]);

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

  function addUnit() {
    let n = 1;
    while (course.units.some((u) => u.id === `unit-${n}`)) n++;
    const id = `unit-${n}`;
    const unit: Unit = { id, title: `Unit ${n}`, emoji: '📘', order: course.units.length + 1, lessons: [] };
    setUnits([...course.units, unit]);
    setSelected({ type: 'unit', id });
  }
  function deleteUnit(unitId: string) {
    const rest = course.units.filter((u) => u.id !== unitId);
    setUnits(rest);
    setSelected(rest[0]?.lessons[0] ? { type: 'lesson', id: rest[0].lessons[0].id }
      : rest[0] ? { type: 'unit', id: rest[0].id } : null);
    setConfirming(false);
  }
  function targetUnit(): Unit | undefined {
    if (selected?.type === 'unit') return course.units.find((u) => u.id === selected.id);
    if (selected?.type === 'lesson') return course.units.find((u) => u.lessons.some((l) => l.id === selected.id));
    return course.units[0];
  }
  function addLesson() {
    const unit = targetUnit();
    if (!unit) return;
    let n = 1;
    const taken = new Set(course.units.flatMap((u) => u.lessons.map((l) => l.id)));
    while (taken.has(`${unit.id}-l${n}`)) n++;
    const id = `${unit.id}-l${n}`;
    const lesson: Lesson = { id, kind: 'dragdrop', drill: 'pattern', level: 1, itemIds: [] };
    patchUnit(unit.id, { lessons: [...unit.lessons, lesson] });
    setSelected({ type: 'lesson', id });
  }
  function deleteLesson(unitId: string, lessonId: string) {
    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) return;
    const rest = unit.lessons.filter((l) => l.id !== lessonId);
    patchUnit(unitId, { lessons: rest });
    setSelected(rest[0] ? { type: 'lesson', id: rest[0].id } : { type: 'unit', id: unitId });
    setConfirming(false);
  }

  const unitSel = selected?.type === 'unit' ? course.units.find((u) => u.id === selected.id) ?? null : null;
  const lessonCtx = selected?.type === 'lesson'
    ? course.units.flatMap((u) => u.lessons.map((l) => ({ u, l }))).find(({ l }) => l.id === selected.id) ?? null
    : null;

  return (
    <div className="flex gap-4 text-sm">
      <LessonTree units={course.units} selected={selected} onSelect={setSelected}
        onAddUnit={addUnit} onAddLesson={addLesson} />

      <div className="flex-1">
        {unitSel && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800">{unitSel.title}</h2>
              <span className="font-mono text-xs text-slate-400">unit · {unitSel.id}</span>
            </div>
            <Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Title">
                  <TextInput aria-label={`unit ${unitSel.id} title`} value={unitSel.title}
                    onChange={(e) => patchUnit(unitSel.id, { title: e.target.value })} />
                </Field>
                <Field label="Emoji">
                  <TextInput aria-label={`unit ${unitSel.id} emoji`} value={unitSel.emoji}
                    onChange={(e) => patchUnit(unitSel.id, { emoji: e.target.value })} />
                </Field>
                <Field label="Order">
                  <NumberInput value={unitSel.order ?? 0}
                    onValueChange={(v) => { if (v !== null) patchUnit(unitSel.id, { order: v }); }} />
                </Field>
              </div>
            </Card>
            <Checkbox label="L1 enabled (TH/ENG toggle for the whole unit)" checked={!!unitSel.l1Enabled}
              onChange={(e) => patchUnit(unitSel.id, { l1Enabled: e.target.checked })} />
            {confirming ? (
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => deleteUnit(unitSel.id)}>Confirm delete</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete unit</Button>
            )}
          </div>
        )}

        {lessonCtx && (() => {
          const { u, l } = lessonCtx;
          const kind = l.kind ?? 'dragdrop';
          const eligible = Object.values(course.pool).filter((it) => it.kind === kind);
          return (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">{l.title ?? 'Lesson'}</h2>
                <span className="font-mono text-xs text-slate-400">{l.id} · {u.title}</span>
              </div>
              <Card>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Kind">
                    <Select value={kind}
                      onChange={(e) => {
                        const k = e.target.value as ContentKind;
                        patchLesson(u.id, l.id, { kind: k, itemIds: l.itemIds.filter((id) => course.pool[id]?.kind === k) });
                      }}>
                      {['flashcard', 'matching', 'dragdrop', 'fillblank'].map((k) => <option key={k}>{k}</option>)}
                    </Select>
                  </Field>
                  <Field label="Drill">
                    <Select value={l.drill}
                      onChange={(e) => patchLesson(u.id, l.id, { drill: e.target.value as Lesson['drill'] })}>
                      {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
                    </Select>
                  </Field>
                  <Field label="Level">
                    <NumberInput value={l.level}
                      onValueChange={(n) => { if (n !== null) patchLesson(u.id, l.id, { level: n }); }} />
                  </Field>
                </div>
              </Card>
              <Checkbox label="Checkpoint ★" checked={!!l.isCheckpoint}
                onChange={(e) => patchLesson(u.id, l.id, { isCheckpoint: e.target.checked })} />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Items in lesson · {l.itemIds.length} assigned · {kind} only
                </p>
                <AssignList
                  items={eligible}
                  getKey={(it) => it.id}
                  ariaLabel={(it) => `item ${it.id}`}
                  isSelected={(it) => l.itemIds.includes(it.id)}
                  onToggle={(it) => toggleItem(u.id, l, it.id)}
                  searchText={(it) => `${it.id} ${isDragDrop(it) ? it.drill : it.kind}`}
                  renderLabel={(it) => `${it.id} (${isDragDrop(it) ? it.drill : it.kind}·${it.level})`}
                  placeholder={`Search ${kind} items…`}
                  emptyHint="No matching items in the pool."
                />
              </div>
              {confirming ? (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => deleteLesson(u.id, l.id)}>Confirm delete</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>Delete lesson</Button>
              )}
            </div>
          );
        })()}

        {!unitSel && !lessonCtx && (
          <Card><p className="text-slate-500">Select a unit or lesson, or add one.</p></Card>
        )}
      </div>
    </div>
  );
}
