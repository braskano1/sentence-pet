# Admin UI/UX Redesign — Phase 1 (Shell chrome) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `AdminShell` with the P0 primitive kit — add a playful accent `AdminHeader` and a real `Tabs` component, and wire the shared `SaveBar` + `ValidationSummary` for the course domain — presentation only, all existing logic preserved.

**Architecture:** Two new admin `ui/` primitives (`AdminHeader`, `Tabs`) join the P0 barrel. `AdminShell` swaps its three ad-hoc inline chunks (header `<div>`, `tabBtn` toggles, emerald Save + raw red `<ul>`) for these primitives plus the existing `SaveBar`/`ValidationSummary`/`Card`. The one branded flourish — a warm gradient title — lives behind an **admin-scoped** CSS var under a `.admin-root` wrapper on AdminShell's root, so the game's default Tailwind palette is never touched (no `@theme`).

**Tech Stack:** React + TypeScript, Tailwind v4 (`@import "tailwindcss"` only), Vitest + Testing Library, Vite.

**Branch:** `admin-uiux` (do NOT branch fresh). **Repo:** `D:/ai_projects/AI_design_thinking/sentence-pet` (Windows / PowerShell).

**Verify gate (run after each task's tests pass):** `npx vitest run` · `npx tsc -b` (NOT `--noEmit`) · `npx vite build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run.

**Hazards (carry forward):** Append to co-located `*.test.tsx`, never overwrite the file. Stage explicit files; never `git add -A`. No persist-version bump. Don't hand-edit `src/content/seed.ts`.

---

## File Structure

- **Create** `src/components/admin/ui/AdminHeader.tsx` — playful accent header: gradient title + `email · admin ✓` + ghost Sign out. Owns the admin-scoped gradient class consumption.
- **Create** `src/components/admin/ui/AdminHeader.test.tsx` — renders title/email, fires Sign out.
- **Create** `src/components/admin/ui/Tabs.tsx` — generic accessible tablist (`role="tablist"`/`role="tab"`, `aria-selected`, arrow-key roving).
- **Create** `src/components/admin/ui/Tabs.test.tsx` — render, active marking, click + arrow-key navigation.
- **Modify** `src/components/admin/ui/index.ts` — barrel-export `AdminHeader`, `Tabs` (+ `TabItem` type).
- **Modify** `src/components/admin/ui/index.test.ts` — add the two new names to the re-export assertion list.
- **Modify** `src/index.css` — add admin-scoped `.admin-root` CSS var + `.admin-title` gradient class (no `@theme`, no global change).
- **Modify** `src/components/admin/AdminShell.tsx` — wire all four primitives; root gets `admin-root`. Logic unchanged.
- **Modify** `src/components/admin/AdminShell.test.tsx` — append a tablist-semantics test; update the 3 existing tab-button queries from `role: 'button'` to `role: 'tab'` (Tabs now sets `role="tab"`).

---

## Task 1: AdminHeader primitive

**Files:**
- Create: `src/components/admin/ui/AdminHeader.tsx`
- Test: `src/components/admin/ui/AdminHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/AdminHeader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminHeader } from './AdminHeader';

describe('AdminHeader', () => {
  it('renders the console title', () => {
    render(<AdminHeader email="a@b.c" onSignOut={() => {}} />);
    expect(screen.getByRole('heading', { name: /sentence pet/i })).toBeInTheDocument();
  });

  it('shows the signed-in email with the admin marker', () => {
    render(<AdminHeader email="a@b.c" onSignOut={() => {}} />);
    expect(screen.getByText(/a@b\.c/)).toBeInTheDocument();
    expect(screen.getByText(/admin ✓/)).toBeInTheDocument();
  });

  it('fires onSignOut when Sign out is clicked', () => {
    const onSignOut = vi.fn();
    render(<AdminHeader email="a@b.c" onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('tolerates a missing email', () => {
    render(<AdminHeader email={null} onSignOut={() => {}} />);
    expect(screen.getByText(/admin ✓/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/AdminHeader.test.tsx`
Expected: FAIL — `Failed to resolve import './AdminHeader'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/AdminHeader.tsx
import { Button } from './Button';

/**
 * Playful accent header for the admin console — the one branded flourish.
 * The warm gradient title is driven by the admin-scoped `.admin-title` class
 * (vars live under `.admin-root`, set on AdminShell). Never relies on global theme.
 */
export function AdminHeader({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <h1 className="admin-title text-xl font-extrabold tracking-tight">
        Sentence Pet — Content
      </h1>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>
          {email} · <span className="font-medium text-emerald-600">admin ✓</span>
        </span>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/AdminHeader.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/ui/AdminHeader.tsx src/components/admin/ui/AdminHeader.test.tsx
git commit -m "feat(admin-ui): AdminHeader accent header primitive"
```

---

## Task 2: Tabs primitive

**Files:**
- Create: `src/components/admin/ui/Tabs.tsx`
- Test: `src/components/admin/ui/Tabs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Tabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './Tabs';

const TABS = [
  { id: 'pool', label: 'Pool' },
  { id: 'journey', label: 'Journey' },
  { id: 'bosses', label: 'Bosses' },
] as const;

describe('Tabs', () => {
  it('renders one tab per item inside a tablist', () => {
    render(<Tabs tabs={TABS} active="pool" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={TABS} active="journey" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /journey/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /pool/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onChange with the tab id when clicked', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="pool" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /bosses/i }));
    expect(onChange).toHaveBeenCalledWith('bosses');
  });

  it('moves selection with the right/left arrow keys (roving)', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="pool" onChange={onChange} />);
    const active = screen.getByRole('tab', { name: /pool/i });
    fireEvent.keyDown(active, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('journey');
    fireEvent.keyDown(active, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('bosses'); // wraps to last
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Tabs.test.tsx`
Expected: FAIL — `Failed to resolve import './Tabs'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Tabs.tsx
export type TabItem<T extends string> = { id: T; label: string };

/**
 * Accessible tablist for the admin console. Real `role="tab"` semantics with
 * `aria-selected` and roving arrow-key navigation. The active trigger is the
 * only one in the tab order (roving tabIndex). Tab *panels* are rendered by the
 * caller (this is a switcher, not a panel host).
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const activeIndex = tabs.findIndex((t) => t.id === active);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const next = (activeIndex + delta + tabs.length) % tabs.length;
    onChange(tabs[next].id);
  }

  return (
    <div role="tablist" className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Tabs.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/ui/Tabs.tsx src/components/admin/ui/Tabs.test.tsx
git commit -m "feat(admin-ui): Tabs accessible tablist primitive"
```

---

## Task 3: Barrel exports for the two new primitives

**Files:**
- Modify: `src/components/admin/ui/index.ts`
- Modify: `src/components/admin/ui/index.test.ts`

- [ ] **Step 1: Update the barrel-export test (failing first)**

In `src/components/admin/ui/index.test.ts`, add `'AdminHeader'` and `'Tabs'` to the names array so it reads:

```ts
    for (const name of [
      'Button', 'Field', 'TextInput', 'NumberInput', 'Select',
      'Checkbox', 'Card', 'SectionLabel', 'ValidationSummary', 'SaveBar',
      'AdminHeader', 'Tabs',
    ]) {
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/index.test.ts`
Expected: FAIL — `missing export: AdminHeader`.

- [ ] **Step 3: Add the exports to the barrel**

Append to `src/components/admin/ui/index.ts`:

```ts
export { AdminHeader } from './AdminHeader';
export { Tabs } from './Tabs';
export type { TabItem } from './Tabs';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/ui/index.ts src/components/admin/ui/index.test.ts
git commit -m "feat(admin-ui): barrel-export AdminHeader and Tabs"
```

---

## Task 4: Admin-scoped gradient styles

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the admin-scoped block**

Append to the END of `src/index.css` (after the evolution block). Scoped under `.admin-root` so it can never re-skin the game; `.admin-title` consumes the vars:

```css
/* --- Admin console (scoped; NEVER touches the game palette — no @theme) --- */
.admin-root {
  --admin-title-from: #f59e0b; /* amber-500 */
  --admin-title-to: #ec4899;   /* pink-500 */
}
.admin-title {
  background-image: linear-gradient(90deg, var(--admin-title-from), var(--admin-title-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

- [ ] **Step 2: Verify the build still compiles the CSS**

Run: `npx vite build`
Expected: build succeeds (CSS is plain; no test asserts on it).

- [ ] **Step 3: Commit**

```powershell
git add src/index.css
git commit -m "feat(admin-ui): admin-scoped gradient title vars (no global theme)"
```

---

## Task 5: Wire AdminShell with the primitives

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/admin/AdminShell.test.tsx`

This task is presentation-only. ALL store/auth/validation/save/import logic stays byte-for-byte identical — only the JSX (and the `tabBtn` helper, now deleted) changes.

- [ ] **Step 1: Update + extend AdminShell.test.tsx (failing first)**

Because `Tabs` uses real `role="tab"`, the three existing queries that find tab triggers by `role: 'button'` must move to `role: 'tab'`. Edit ONLY these query lines (do not rewrite the file):

In the `'shows Pool and Journey tabs and switches to Journey'` test, change:

```tsx
    expect(screen.getByRole('button', { name: /^pool$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^journey$/i }));
```
to:
```tsx
    expect(screen.getByRole('tab', { name: /^pool$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^journey$/i }));
```

In the `'Import tab commit…'` test, change:

```tsx
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
```
to:
```tsx
    fireEvent.click(screen.getByRole('tab', { name: /^import$/i }));
```

(The Save queries stay `role: 'button'` — `SaveBar`'s Save is a real button, not a tab.)

Then APPEND a new test inside the `describe('AdminShell', …)` block, before its closing `});`:

```tsx
  it('renders the tabs inside an accessible tablist', () => {
    render(<AdminShell />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^pets$/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify the suite fails**

Run: `npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: FAIL — the new tablist test errors (`Unable to find role="tablist"`) and the updated `role: 'tab'` queries fail against the current `<button>` toggles.

- [ ] **Step 3: Rewrite the AdminShell JSX to use the primitives**

Replace the full contents of `src/components/admin/AdminShell.tsx` with the version below. Imports gain the four primitives; the `tabBtn` helper is removed; the header, tab row, Save control, and error list become primitives; the root carries `admin-root`. Logic (`save`, `commitImport`, `validation`, state) is unchanged.

```tsx
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useContentStore } from '../../content/store';
import { validateCourse } from '../../content/validate';
import { getActivePetDefs } from '../../domain/petDef';
import { saveCourse } from '../../firebase/content';
import type { Course } from '../../content/course';
import { AdminHeader, Tabs, SaveBar, ValidationSummary, Card } from './ui';
import type { TabItem } from './ui';
import { PoolTab } from './PoolTab';
import { JourneyTab } from './JourneyTab';
import { BossesTab } from './BossesTab';
import { ImportTab } from './ImportTab';
import { PetsTab } from './PetsTab';

type Tab = 'pool' | 'journey' | 'bosses' | 'import' | 'pets';

const TABS: readonly TabItem<Tab>[] = [
  { id: 'pool', label: 'Pool' },
  { id: 'journey', label: 'Journey' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'import', label: 'Import' },
  { id: 'pets', label: 'Pets' },
];

export function AdminShell() {
  const { user, signOut } = useAuth();
  const liveCourse = useContentStore((s) => s.course);
  const setCourse = useContentStore((s) => s.setCourse);
  const [draft, setDraft] = useState<Course | null>(liveCourse);
  const [tab, setTab] = useState<Tab>('pool');
  const [status, setStatus] = useState('');

  if (!draft) return <p className="p-4 text-sm text-red-600">No course loaded.</p>;
  const currentDraft: Course = draft;
  const validation = validateCourse(currentDraft, { petDefIds: new Set(getActivePetDefs().map((d) => d.id)) });

  async function save() {
    if (!validation.ok) return;
    setStatus('saving…');
    try {
      await saveCourse(currentDraft);
      setCourse(currentDraft, 'live');
      setStatus('saved ✓');
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`);
    }
  }

  async function commitImport(c: Course) {
    setStatus('saving…');
    try {
      await saveCourse(c);
      setDraft(c);
      setCourse(c, 'live');
      setStatus('imported ✓');
    } catch (e) {
      setStatus(`import failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="admin-root mx-auto mt-6 flex max-w-4xl flex-col gap-4 p-4 text-base text-slate-800">
      <AdminHeader email={user?.email} onSignOut={() => signOut()} />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <span className="flex-1" />
        <SaveBar
          valid={validation.ok}
          status={status}
          onSave={save}
          errorCount={validation.errors.length}
        />
      </div>

      <ValidationSummary errors={validation.ok ? [] : validation.errors} />

      <Card>
        {tab === 'pool' && <PoolTab course={draft} onChange={setDraft} />}
        {tab === 'journey' && <JourneyTab course={draft} onChange={setDraft} />}
        {tab === 'bosses' && <BossesTab course={draft} onChange={setDraft} />}
        {tab === 'import' && <ImportTab onCommit={commitImport} />}
        {tab === 'pets' && <PetsTab />}
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/AdminShell.test.tsx`
Expected: PASS (all existing tests + the new tablist test).

- [ ] **Step 5: Full verify gate**

Run: `npx vitest run` then `npx tsc -b` then `npx vite build`
Expected: all green (re-run vitest once on a "Worker exited unexpectedly" Windows flake).

- [ ] **Step 6: Commit**

```powershell
git add src/components/admin/AdminShell.tsx src/components/admin/AdminShell.test.tsx
git commit -m "feat(admin-ui): wire AdminShell shell chrome with P0 primitives"
```

---

## Self-Review

**Spec coverage (P1 scope items 1–5 from the handoff):**
1. AdminHeader playful accent header → Task 1 + admin-scoped gradient Task 4. ✅
2. Tabs primitive replacing `tabBtn` → Task 2, wired Task 5. ✅
3. Course `SaveBar` replacing ad-hoc emerald Save + status string → Task 5 (`valid`/`status`/`onSave`/`errorCount`). ✅ (PetsTab keeps its own SaveBar — P2, untouched.)
4. `ValidationSummary` replacing raw red `<ul>` → Task 5. ✅
5. Card frame + bumped type (`text-base`) → Task 5 root + `<Card>` wrapper. ✅

**Tokens stay admin-scoped:** gradient is `.admin-root` var + `.admin-title` class, no `@theme`, root opts in via `admin-root`. ✅

**Type consistency:** `TabItem<T>`/`Tabs` props match between Task 2, barrel (Task 3), and AdminShell wiring (Task 5). `SaveBar`/`ValidationSummary`/`Card` props match their P0 signatures (`valid`,`status`,`onSave`,`errorCount`; `errors`; children). `AdminHeader` props (`email?`, `onSignOut`) match the Task 5 call site. ✅

**Logic preserved:** Task 5 keeps `save`/`commitImport`/`validation`/state identical; only JSX + deleted `tabBtn` change. ✅

**No placeholders:** every code step shows complete code; every run step shows expected output. ✅
