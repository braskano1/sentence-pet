# Admin UI/UX Redesign — P3: BossesTab re-skin + fix leaky labels

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `src/components/admin/BossesTab.tsx` with the P0 primitive kit (Card/SectionLabel/Field/TextInput/NumberInput/Select/Checkbox/Button) and replace every leaky raw test-selector label string with a human-readable visible label, moving the selector string into `aria-label` so existing tests pass unchanged.

**Architecture:** Presentation-only. ALL data flow / handlers preserved byte-for-byte: `emptyBoss`, `patchGate`/`addGate`/`deleteGate`/`patchFinal`, the `BossFields` `onPatch` mechanics, `usePetDefs()` reward dropdown (lists ALL defs), reviewCount NaN guard. Group each boss editor's fields into Cards: **Boss · Sprite · Reward · Reviews · Pins**. Each control gets a friendly visible label via `Field`/`Checkbox`; the original selector string lives on the control's `aria-label` (aria-label wins over the wrapping `<label>`, so the control's accessible name stays the selector string and `getByLabelText` keeps matching).

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, Tailwind, Vite.

---

## Label contract (the headline task)

`BossFields` builds `labelPrefix = node.scope === 'final' ? 'final boss' : \`gate ${node.id}\``.

**Selector strings the tests actually query (MUST stay reachable verbatim):**
- `getByRole('button', { name: /add gate/i })` → Button text `+ Add gate`
- `getByRole('button', { name: /delete gate g1/i })` → Button `aria-label={\`delete gate ${g.id}\`}` (already an aria-label — keep)
- `getByLabelText(/final boss name/i)` → name input accessible name = `${labelPrefix} name`
- `getByLabelText(/final boss reward/i)` and `/gate g1 reward/i` → reward select accessible name = `${labelPrefix} reward`

**All other label strings are NOT queried** but are preserved as `aria-label` anyway (belt-and-suspenders / future-proof): `tierId`, `element`, `sprite species`, `sprite stage`, `reviewCount`, per-unit `reviews ${u.id}`, per-item `pins ${id}`, gate-row `gate ${g.id} afterUnit`.

**Visible-label → aria-label map (per boss, `P` = labelPrefix):**

| Field | Visible label | `aria-label` |
|---|---|---|
| name | `Name` | `${P} name` |
| tierId | `Tier` | `${P} tierId` |
| element | `Element` | `${P} element` |
| sprite species | `Sprite species` | `${P} sprite species` |
| sprite stage | `Sprite stage` | `${P} sprite stage` |
| reward | `Reward pet` | `${P} reward` |
| reviewCount | `Review count` | `${P} reviewCount` |
| reviews checkbox (per unit `u`) | `u.title ?? u.id` | `${P} reviews ${u.id}` |
| pins checkbox (per item `id`) | `id` | `${P} pins ${id}` |
| gate-row afterUnit | `After unit` | `gate ${g.id} afterUnit` |

**Card grouping inside `BossFields`:**
- **Boss** card: Name, Tier, Element
- **Sprite** card: Sprite species, Sprite stage
- **Reward** card: Reward pet
- **Reviews** card: Review count + reviews-unit checkbox set
- **Pins** card: pinned-item checkbox set

Gate header row (outside `BossFields`, gated only): `<strong>{g.id}</strong>`, an **After unit** `Field`+`Select`, a Delete `Button variant="danger"`.

**Why aria-label wins:** `Field` renders `<label><span>{label}</span>{control}</label>` → the control's accessible name is the span text UNLESS the control has its own `aria-label`, which takes precedence. So put friendly text in `Field label=` and the selector string in `aria-label=` on the inner `TextInput`/`Select`/`NumberInput`. For `Checkbox` (self-labeling, spreads props to the input), pass friendly `label=` and `aria-label=` (the latter overrides the visible span for the accessible name).

---

## Task 1: Append label-contract tests

**Files:**
- Test: `src/components/admin/BossesTab.test.tsx` (APPEND — never overwrite; clobber hazard)

- [ ] **Step 1: Append a new `describe` block at the end of the file (before the final closing nothing — it's a flat file; add after the last `});` of the top-level `describe`... actually append INSIDE the top-level `describe('BossesTab', ...)` block, before its closing `});`).**

Add these tests. They assert friendly visible labels render AND the leaky selector strings are no longer VISIBLE text (only reachable as accessible names):

```tsx
  describe('label contract (P3)', () => {
    it('renders friendly visible labels, not raw selector strings', () => {
      render(<BossesTab course={course()} onChange={vi.fn()} />);
      // friendly visible text present
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('Tier')).toBeTruthy();
      expect(screen.getByText('Reward pet')).toBeTruthy();
      expect(screen.getByText('Review count')).toBeTruthy();
      // leaky raw strings no longer rendered as visible text
      expect(screen.queryByText('final boss name')).toBeNull();
      expect(screen.queryByText('final boss reward')).toBeNull();
      expect(screen.queryByText('final boss reviewCount')).toBeNull();
    });

    it('keeps selector strings reachable as accessible names', () => {
      render(<BossesTab course={course()} onChange={vi.fn()} />);
      // accessible-name contract preserved via aria-label
      expect(screen.getByLabelText(/final boss name/i)).toBeTruthy();
      expect(screen.getByLabelText(/final boss reward/i)).toBeTruthy();
      expect(screen.getByLabelText(/final boss tierId/i)).toBeTruthy();
    });

    it('shows the gate-row After unit with friendly label', () => {
      const c = course();
      c.gates = [{ id: 'g1', title: 'G', scope: 'gated', afterUnitId: 'u1', reviewsUnitIds: ['u1'],
        boss: { tierId: 't', element: 'leaf', name: 'G', rivalSprite: { species: 'leaf', stage: 'adult' } } }];
      render(<BossesTab course={c} onChange={vi.fn()} />);
      expect(screen.getByText('After unit')).toBeTruthy();
      expect(screen.getByLabelText(/gate g1 afterUnit/i)).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Run the new tests — expect FAIL (current code renders raw strings as visible text, no friendly labels).**

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: the three new tests FAIL (`Name`/`Tier`/`Reward pet` not found; `final boss name` still visible). Existing tests still PASS.

- [ ] **Step 3: Commit the failing tests.**

```bash
git add src/components/admin/BossesTab.test.tsx
git commit -m "test(admin): label-contract tests for BossesTab re-skin"
```

---

## Task 2: Re-skin `BossesTab.tsx`

**Files:**
- Modify: `src/components/admin/BossesTab.tsx` (full rewrite of presentation; logic preserved)

- [ ] **Step 1: Rewrite the file** — keep imports for types/`usePetDefs`, ADD primitive imports, replace `BossFields` JSX with Cards + Field/Checkbox using the visible-label→aria-label map, re-skin the gate header + section headers + buttons. Preserve `SPECIES`/`STAGES`/`emptyBoss`/`patchGate`/`addGate`/`deleteGate`/`patchFinal`/`poolIds` exactly.

```tsx
import type { Course, BossNode } from '../../content/course';
import type { Species, PetStage } from '../../data/types';
import { usePetDefs } from '../../state/usePetDefs';
import { Card, SectionLabel } from './ui/Card';
import { Field } from './ui/Field';
import { TextInput } from './ui/TextInput';
import { NumberInput } from './ui/NumberInput';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';

const SPECIES: Species[] = ['leaf', 'fire', 'air', 'water'];
const STAGES: Exclude<PetStage, 'egg'>[] = ['baby', 'young', 'adult'];

function emptyBoss(): BossNode['boss'] {
  return { tierId: 'tier-1', element: 'leaf', name: 'New Boss', rivalSprite: { species: 'leaf', stage: 'adult' } };
}

/** Reusable review/boss fields shared by gated + final editors. */
function BossFields({ node, units, poolIds, onPatch }: {
  node: BossNode;
  units: { id: string; title?: string }[];
  poolIds: string[];
  onPatch: (patch: Partial<BossNode>) => void;
}) {
  const labelPrefix = node.scope === 'final' ? 'final boss' : `gate ${node.id}`;
  const petDefs = usePetDefs();
  const reviews = node.reviewsUnitIds ?? [];
  const pinned = node.pinnedItemIds ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <SectionLabel>Boss</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <TextInput aria-label={`${labelPrefix} name`} value={node.boss.name}
              onChange={(e) => onPatch({ boss: { ...node.boss, name: e.target.value } })} />
          </Field>
          <Field label="Tier">
            <TextInput aria-label={`${labelPrefix} tierId`} value={node.boss.tierId}
              onChange={(e) => onPatch({ boss: { ...node.boss, tierId: e.target.value } })} />
          </Field>
          <Field label="Element">
            <Select aria-label={`${labelPrefix} element`} value={node.boss.element}
              onChange={(e) => onPatch({ boss: { ...node.boss, element: e.target.value as Species } })}>
              {SPECIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Sprite</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Sprite species">
            <Select aria-label={`${labelPrefix} sprite species`} value={node.boss.rivalSprite.species}
              onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, species: e.target.value as Species } } })}>
              {SPECIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Sprite stage">
            <Select aria-label={`${labelPrefix} sprite stage`} value={node.boss.rivalSprite.stage}
              onChange={(e) => onPatch({ boss: { ...node.boss, rivalSprite: { ...node.boss.rivalSprite, stage: e.target.value as Exclude<PetStage, 'egg'> } } })}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>Reward</SectionLabel>
        <Field label="Reward pet" hint="Lists all pet defs — an authored reward may grant a non-gacha def.">
          <Select aria-label={`${labelPrefix} reward`} value={node.rewardPetDefId ?? ''}
            onChange={(e) => onPatch({ rewardPetDefId: e.target.value || undefined })}>
            <option value="">— none (random) —</option>
            {petDefs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </Card>

      <Card>
        <SectionLabel>Reviews</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Review count">
            <NumberInput aria-label={`${labelPrefix} reviewCount`} value={node.reviewCount ?? 0}
              onValueChange={(n) => { if (n !== null) onPatch({ reviewCount: n }); }} />
          </Field>
          <div className="flex flex-wrap gap-3">
            {units.map((u) => (
              <Checkbox key={u.id} label={u.title ?? u.id} aria-label={`${labelPrefix} reviews ${u.id}`}
                checked={reviews.includes(u.id)}
                onChange={() => onPatch({ reviewsUnitIds: reviews.includes(u.id) ? reviews.filter((x) => x !== u.id) : [...reviews, u.id] })} />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Pins</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {poolIds.map((id) => (
            <Checkbox key={id} label={id} aria-label={`${labelPrefix} pins ${id}`}
              checked={pinned.includes(id)}
              onChange={() => onPatch({ pinnedItemIds: pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id] })} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function BossesTab({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const poolIds = Object.keys(course.pool);

  function patchGate(id: string, patch: Partial<BossNode>) {
    onChange({ ...course, gates: course.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function addGate() {
    let n = 1;
    while (course.gates.some((g) => g.id === `gate-${n}`)) n++;
    const gate: BossNode = {
      id: `gate-${n}`, title: `Gate ${n}`, scope: 'gated',
      afterUnitId: course.units[0]?.id, reviewsUnitIds: [], reviewCount: 5, boss: emptyBoss(),
    };
    onChange({ ...course, gates: [...course.gates, gate] });
  }
  function deleteGate(id: string) {
    onChange({ ...course, gates: course.gates.filter((g) => g.id !== id) });
  }
  function patchFinal(patch: Partial<BossNode>) {
    const base: BossNode = course.finalBoss ?? {
      id: `${course.id}-final`, title: 'Final Boss', scope: 'final', reviewsUnitIds: [], reviewCount: 6,
      boss: emptyBoss(), onClear: 'completeCourse',
    };
    onChange({ ...course, finalBoss: { ...base, ...patch, scope: 'final', onClear: 'completeCourse' } });
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800">Gated bosses</h2>
          <Button onClick={addGate}>+ Add gate</Button>
        </div>
        <div className="flex flex-col gap-4">
          {course.gates.map((g) => (
            <div key={g.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center gap-3">
                <strong className="text-slate-800">{g.id}</strong>
                <Field label="After unit">
                  <Select aria-label={`gate ${g.id} afterUnit`} value={g.afterUnitId ?? ''}
                    onChange={(e) => patchGate(g.id, { afterUnitId: e.target.value })}>
                    {course.units.map((u) => <option key={u.id} value={u.id}>{u.title} ({u.id})</option>)}
                  </Select>
                </Field>
                <Button variant="danger" aria-label={`delete gate ${g.id}`} onClick={() => deleteGate(g.id)}
                  className="ml-auto">Delete</Button>
              </div>
              <BossFields node={g} units={course.units} poolIds={poolIds} onPatch={(p) => patchGate(g.id, p)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Final boss</h2>
        {course.finalBoss
          ? <BossFields node={course.finalBoss} units={course.units} poolIds={poolIds} onPatch={patchFinal} />
          : <Button onClick={() => patchFinal({})}>+ Add final boss</Button>}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run the full BossesTab test file — expect ALL PASS (old + new).**

Run: `npx vitest run src/components/admin/BossesTab.test.tsx`
Expected: all tests PASS. (Windows "Worker exited unexpectedly" flake → re-run.)

- [ ] **Step 3: Full gate.**

Run: `npx vitest run` then `npx tsc -b` then `npx vite build`
Expected: all green, tsc clean, build clean.

- [ ] **Step 4: Commit.**

```bash
git add src/components/admin/BossesTab.tsx
git commit -m "feat(admin): re-skin BossesTab with primitives + friendly labels"
```

---

## Verification checklist (whole phase)
- [ ] `npx vitest run` — all green (1057+ unit; the 3 new BossesTab tests included)
- [ ] `npx tsc -b` — clean
- [ ] `npx vite build` — clean
- [ ] Existing BossesTab tests pass UNCHANGED (add gate / delete gate g1 / final boss name / final boss reward / gate g1 reward)
- [ ] No `git add -A` — staged explicit files only
- [ ] No persist bump, no global `@theme`, no save added to BossesTab (course `onChange` only)
- [ ] Manual smoke (optional): `npm run emulators` + `npm run dev:admin` → `/#admin` → 🔑 Dev admin → Bosses tab

## Self-review notes
- Spec coverage: re-skin (✓ Task 2 Cards + primitives), leaky labels (✓ visible/aria map, Task 1 tests + Task 2), preserve logic (✓ handlers copied verbatim), separate save model (✓ no save added, `onChange` only).
- Type consistency: `onValueChange(n: number|null)` guard matches NumberInput API; `Checkbox` requires `label` + spreads `aria-label`; `Field` wraps one control (Checkbox NOT inside Field).
- Placeholder scan: none.
