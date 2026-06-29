# Admin UI/UX Redesign — P4: Journey / Pool / Import / ItemEditor re-skin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the four remaining admin tabs that still use raw `<label>/<input>/<select>/<button>` — `ItemEditor.tsx`, `PoolTab.tsx`, `JourneyTab.tsx`, `ImportTab.tsx` — with the P0 primitive kit (Card/SectionLabel/Field/TextInput/NumberInput/Select/Checkbox/Button/ValidationSummary), matching the Neutral-SaaS look of the already-re-skinned PetsTab/BossesTab.

**Architecture:** Presentation-only. ALL data flow / handlers preserved byte-for-byte. **Label strings stay IDENTICAL to the current code** (they are already acceptable field names: `id`, `kind`, `level`, `front`, `back`, `template`, `answer`, `hidePos`, `drill`, etc.), so every existing `getByLabelText`/`getByRole(name:)` query keeps matching — the existing co-located tests ARE the regression gate (they prove accessible names survive the re-skin). No new tests required unless a label string changes (it must not). The only non-obvious accessible-name carriers to preserve: JourneyTab item checkbox `aria-label={\`item ${id}\`}`, JourneyTab unit emoji `aria-label="emoji"`.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, Tailwind, Vite.

---

## Selector strings the existing tests query (MUST stay reachable verbatim)

**ItemEditor.test.tsx:** `getByLabelText(/front/i)`, `/back/i`, `/hidePos/i`, `/template/i`, `/answer/i`, `/^kind/i`.
→ Keep Field labels exactly: `front`, `back`, `hidePos` (a Checkbox — label="hidePos"), `template`, `answer`, `kind`.

**PoolTab.test.tsx:** `getByText('a')` (item id in rail), `getByRole('button', { name: /new item/i })`.
→ Keep the id visible as text; keep the "+ New item" Button text.

**JourneyTab.test.tsx:** `getByDisplayValue('One')` (unit title input value), `getByText('u1-l1')` (lesson button), `getByRole('checkbox', { name: /item b/i })` (→ `aria-label="item b"`), `getByLabelText(/kind/i)`, `getByRole('checkbox', { name: /l1 enabled/i })`.
→ Keep title as a text input (value-queried), lesson buttons as text, item checkbox `aria-label`, Field label `kind`, Checkbox label `L1 enabled (TH/ENG toggle)`.

**ImportTab.test.tsx:** `getByLabelText(/excel file/i)` (file Field label), `findByText(/Unit One/)`, `findByText(/missing required sheet/i)`, `findByText(/could not read file/i)`, `getByRole('button', { name: /commit/i })`.
→ Keep the file Field label `Excel file (.xlsx)`, render the preview text, render each error as text (ValidationSummary renders `• {e}` li — substring-matchable), keep the "Commit import" Button text.

## Conventions (carry forward)
- Import primitives from the **`./ui` barrel** (one line), matching `PetForm.tsx`/`BossesTab.tsx`.
- `Field` wraps exactly ONE control, never a `Checkbox`. `Checkbox` is self-labeling (standalone). `NumberInput.onValueChange(n: number|null)` → guard `if (n !== null)`.
- Stage explicit files; never `git add -A`. Append to `*.test.tsx`, never overwrite.
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet` (the PowerShell tool's cwd resolves to the wrong project).
- Verify gate: `npx vitest run`, `npx tsc -b` (NOT `--noEmit`), `npx vite build`. Windows "Worker exited unexpectedly" flake → re-run.

---

## Task 1: Re-skin `ItemEditor.tsx`

**Files:** Modify `src/components/admin/ItemEditor.tsx` (140 lines). Test (existing, must stay green): `src/components/admin/ItemEditor.test.tsx`.

- [ ] **Step 1: Rewrite the file verbatim.** Preserve `POS`/`KINDS`/`csv`/`blankOf` and all `onChange` expressions exactly; only swap raw `<label>/<input>/<select>` for `Field`+`TextInput`/`NumberInput`/`Select` and the hidePos checkbox for `Checkbox`. Note `level` now uses `NumberInput` (empty field → no change, vs the old `Number('')→0`; acceptable, untested).

```tsx
import type {
  ContentItem,
  DragDropItem,
  FlashcardItem,
  MatchingItem,
  FillBlankItem,
  MatchingPair,
  PosLabel,
} from '../../data/types';
import { Field, TextInput, NumberInput, Select, Checkbox, Button } from './ui';

const POS: PosLabel[] = ['Pronoun', 'Verb', 'Object'];
const KINDS: ContentItem['kind'][] = ['flashcard', 'matching', 'dragdrop', 'fillblank'];

const csv = (s: string) => s.split(',').map((w) => w.trim()).filter(Boolean);

function blankOf(kind: ContentItem['kind'], id: string, level: number): ContentItem {
  switch (kind) {
    case 'flashcard':
      return { id, kind, level, front: '', back: '' };
    case 'matching':
      return { id, kind, level, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    case 'dragdrop':
      return { id, kind, level, drill: 'pattern', thaiHint: '', slots: [], answer: [] };
    case 'fillblank':
      return { id, kind, level, template: '___', answer: '' };
  }
}

export function ItemEditor({ item, onChange }: { item: ContentItem; onChange: (i: ContentItem) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="id">
        <TextInput value={item.id} onChange={(e) => onChange({ ...item, id: e.target.value })} />
      </Field>
      <Field label="kind">
        <Select value={item.kind}
          onChange={(e) => onChange(blankOf(e.target.value as ContentItem['kind'], item.id, item.level))}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="level">
        <NumberInput value={item.level}
          onValueChange={(n) => { if (n !== null) onChange({ ...item, level: n }); }} />
      </Field>

      {item.kind === 'flashcard' && <FlashcardForm item={item} onChange={onChange} />}
      {item.kind === 'matching' && <MatchingForm item={item} onChange={onChange} />}
      {item.kind === 'dragdrop' && <DragDropForm item={item} onChange={onChange} />}
      {item.kind === 'fillblank' && <FillBlankForm item={item} onChange={onChange} />}
    </div>
  );
}

/** Shared optional Thai helper input (flashcard/matching/fillblank). */
function L1Input({ value, onChange }: { value: string; onChange: (th: string) => void }) {
  return (
    <Field label="th (l1)">
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function FlashcardForm({ item, onChange }: { item: FlashcardItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FlashcardItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="front"><TextInput value={item.front} onChange={(e) => set({ front: e.target.value })} /></Field>
      <Field label="back"><TextInput value={item.back} onChange={(e) => set({ back: e.target.value })} /></Field>
      <Field label="audio">
        <TextInput value={item.audio ?? ''}
          onChange={(e) => set({ audio: e.target.value.trim() ? e.target.value : undefined })} />
      </Field>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => set({ l1: th.trim() ? { th } : undefined })} />
    </>
  );
}

function MatchingForm({ item, onChange }: { item: MatchingItem; onChange: (i: ContentItem) => void }) {
  const setPairs = (pairs: MatchingPair[]) => onChange({ ...item, pairs });
  const setPair = (i: number, patch: Partial<MatchingPair>) =>
    setPairs(item.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => onChange({ ...item, l1: th.trim() ? { th } : undefined })} />
      <div className="flex flex-col gap-2">
        {item.pairs.map((p, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label="left"><TextInput value={p.left} onChange={(e) => setPair(i, { left: e.target.value })} /></Field>
            <Field label="right"><TextInput value={p.right} onChange={(e) => setPair(i, { right: e.target.value })} /></Field>
            <Field label="th">
              <TextInput value={p.l1?.th ?? ''}
                onChange={(e) => setPair(i, { l1: e.target.value.trim() ? { th: e.target.value } : undefined })} />
            </Field>
            <Button variant="danger" aria-label={`remove pair ${i + 1}`}
              onClick={() => setPairs(item.pairs.filter((_, idx) => idx !== i))}>×</Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="self-start"
        onClick={() => setPairs([...item.pairs, { left: '', right: '' }])}>+ pair</Button>
    </>
  );
}

function DragDropForm({ item, onChange }: { item: DragDropItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<DragDropItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="drill">
        <Select value={item.drill} onChange={(e) => set({ drill: e.target.value as DragDropItem['drill'] })}>
          {['pattern', 'wordChoice', 'grammar', 'mixed'].map((d) => <option key={d}>{d}</option>)}
        </Select>
      </Field>
      <Field label="thaiHint"><TextInput value={item.thaiHint} onChange={(e) => set({ thaiHint: e.target.value })} /></Field>
      <Field label="slots (csv)">
        <TextInput value={item.slots.join(',')} onChange={(e) => set({ slots: csv(e.target.value) as PosLabel[] })} />
      </Field>
      <Field label="answer (csv)">
        <TextInput value={item.answer.join(',')} onChange={(e) => set({ answer: csv(e.target.value) })} />
      </Field>
      <Field label="distractors (csv)">
        <TextInput value={(item.distractors ?? []).join(',')} onChange={(e) => set({ distractors: csv(e.target.value) })} />
      </Field>
      <Checkbox label="hidePos" checked={!!item.hidePos}
        onChange={(e) => set({ hidePos: e.target.checked || undefined })} />
      <p className="text-xs text-slate-500">POS options: {POS.join(', ')}. Traps edited as JSON later.</p>
    </>
  );
}

function FillBlankForm({ item, onChange }: { item: FillBlankItem; onChange: (i: ContentItem) => void }) {
  const set = (patch: Partial<FillBlankItem>) => onChange({ ...item, ...patch });
  return (
    <>
      <Field label="template"><TextInput value={item.template} onChange={(e) => set({ template: e.target.value })} /></Field>
      <Field label="answer"><TextInput value={item.answer} onChange={(e) => set({ answer: e.target.value })} /></Field>
      <Field label="alternates (csv)">
        <TextInput value={(item.alternates ?? []).join(',')} onChange={(e) => set({ alternates: csv(e.target.value) })} />
      </Field>
      <L1Input value={item.l1?.th ?? ''} onChange={(th) => set({ l1: th.trim() ? { th } : undefined })} />
    </>
  );
}
```

- [ ] **Step 2:** `npx vitest run src/components/admin/ItemEditor.test.tsx` → all 4 PASS.
- [ ] **Step 3:** Full gate: `npx vitest run` (all green), `npx tsc -b` (clean), `npx vite build` (clean).
- [ ] **Step 4:** `git add src/components/admin/ItemEditor.tsx` && `git commit -m "feat(admin): re-skin ItemEditor with primitives"`

---

## Task 2: Re-skin `PoolTab.tsx`

**Files:** Modify `src/components/admin/PoolTab.tsx` (61 lines). Test (existing): `src/components/admin/PoolTab.test.tsx`. Depends on Task 1 (renders `ItemEditor`).

- [ ] **Step 1: Rewrite verbatim.** Preserve `freshId`/`addItem`/`updateItem`/`removeItem` and the `selected` state exactly; re-skin the master-detail rail (buttons → `Button`, item rows styled, Delete → `Button variant="danger"`).

```tsx
import { useState } from 'react';
import type { Course } from '../../content/course';
import type { ContentItem, DrillItem } from '../../data/types';
import { isDragDrop } from '../../data/types';
import { ItemEditor } from './ItemEditor';
import { Button } from './ui';

export function PoolTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const ids = Object.keys(course.pool);
  const [selected, setSelected] = useState<string | null>(ids[0] ?? null);

  function freshId(): string {
    let n = 1;
    while (course.pool[`item-${n}`]) n++;
    return `item-${n}`;
  }

  function addItem() {
    const id = freshId();
    const fresh: DrillItem = { id, kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: '', slots: ['Pronoun', 'Verb'], answer: ['', ''] };
    onChange({ ...course, pool: { ...course.pool, [id]: fresh } });
    setSelected(id);
  }

  function updateItem(next: ContentItem) {
    const pool = { ...course.pool };
    delete pool[selected!];
    pool[next.id] = next;
    onChange({ ...course, pool });
    setSelected(next.id);
  }

  function removeItem(id: string) {
    const pool = { ...course.pool };
    delete pool[id];
    onChange({ ...course, pool });
    setSelected(Object.keys(pool)[0] ?? null);
  }

  return (
    <div className="flex gap-4">
      <ul className="flex w-48 flex-col gap-1">
        <li>
          <Button onClick={addItem} className="w-full">+ New item</Button>
        </li>
        {ids.map((id) => {
          const it = course.pool[id];
          const meta = `${isDragDrop(it) ? it.drill : it.kind}·${it.level}`;
          return (
            <li key={id}>
              <button type="button" onClick={() => setSelected(id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${id === selected ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-50'}`}>
                <span>{id}</span>
                <span className="text-xs text-slate-400">{meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex-1">
        {selected && course.pool[selected] && (
          <div className="flex flex-col gap-3">
            <ItemEditor item={course.pool[selected]} onChange={updateItem} />
            <Button variant="danger" className="self-start" onClick={() => removeItem(selected)}>Delete item</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** `npx vitest run src/components/admin/PoolTab.test.tsx` → all 3 PASS.
- [ ] **Step 3:** Full gate (vitest run / tsc -b / vite build) — all clean.
- [ ] **Step 4:** `git add src/components/admin/PoolTab.tsx` && `git commit -m "feat(admin): re-skin PoolTab master-detail rail"`

---

## Task 3: Re-skin `JourneyTab.tsx`

**Files:** Modify `src/components/admin/JourneyTab.tsx` (105 lines). Test (existing): `src/components/admin/JourneyTab.test.tsx`. **Keep the `eligibleItemIds` named export** (the test imports it).

- [ ] **Step 1: Rewrite verbatim.** Preserve `eligibleItemIds`, `setUnits`/`patchUnit`/`patchLesson`/`toggleItem`, the `selected` derivation and the kind-change item-prune logic exactly. Unit title stays a text input (`getByDisplayValue('One')`); keep emoji `aria-label="emoji"` and item checkbox `aria-label={\`item ${id}\`}`.

```tsx
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
```

- [ ] **Step 2:** `npx vitest run src/components/admin/JourneyTab.test.tsx` → all PASS (incl. `eligibleItemIds` unit tests, `/item b/i`, `/kind/i`, `/l1 enabled/i`).
- [ ] **Step 3:** Full gate — all clean.
- [ ] **Step 4:** `git add src/components/admin/JourneyTab.tsx` && `git commit -m "feat(admin): re-skin JourneyTab with primitives"`

---

## Task 4: Re-skin `ImportTab.tsx`

**Files:** Modify `src/components/admin/ImportTab.tsx` (67 lines). Test (existing): `src/components/admin/ImportTab.test.tsx`. Keep `onCommit`/`readWorkbook` props + `onFile`/`canCommit` logic exactly.

- [ ] **Step 1: Rewrite verbatim.** File input → `Field label="Excel file (.xlsx)"`; error list → `ValidationSummary errors={errors}` (renders `• {e}`, substring-matchable by the tests); preview → `Card`; commit → `Button` (keeps disabled + "Commit import" text).

```tsx
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
```

- [ ] **Step 2:** `npx vitest run src/components/admin/ImportTab.test.tsx` → all 3 PASS (preview/commit, invalid-workbook error, reader-throws error).
- [ ] **Step 3:** Full gate — all clean.
- [ ] **Step 4:** `git add src/components/admin/ImportTab.tsx` && `git commit -m "feat(admin): re-skin ImportTab with primitives"`

---

## Verification checklist (whole phase)
- [ ] `npx vitest run` — all green (1060+ unit; the 4 tabs' existing tests all pass UNCHANGED)
- [ ] `npx tsc -b` clean; `npx vite build` clean
- [ ] Every preserved selector string still reachable (front/back/hidePos/template/answer/^kind; new item; item b/kind/l1 enabled + One/u1-l1; excel file/Unit One/missing required sheet/could not read file/commit)
- [ ] No `git add -A`; no persist bump; no global `@theme`; no save added (Pool/Journey via `onChange`, Import via `onCommit`)
- [ ] `eligibleItemIds` still exported from JourneyTab
- [ ] Manual smoke (optional): `npm run emulators` + `npm run dev:admin` → `/#admin` → Pool / Journey / Import tabs

## Self-review notes
- Spec coverage: all four raw-label tabs re-skinned (Tasks 1–4); primitives from `./ui` barrel; Pool/Journey master-detail; Import uses ValidationSummary; save model unchanged (no save added).
- Type consistency: `NumberInput.onValueChange(n: number|null)` guarded `if (n !== null)`; `Checkbox` standalone (never inside Field); `Field` wraps one control; `eligibleItemIds` signature unchanged.
- Placeholder scan: none.
- Label-string preservation: every Field/Checkbox label kept byte-identical to the current code; only additive `aria-label`s (`unit <id> title`, plus the already-present `emoji` and `item <id>`).
